const { PrismaClient, Prisma } = require("@prisma/client");
const prisma = new PrismaClient();

const ACCENT_FROM =
  "ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ" +
  "áàâãäéèêëíìîïóòôõöúùûüçñ";

const ACCENT_TO =
  "AAAAAEEEEIIIIOOOOOUUUUCN" +
  "aaaaaeeeeiiiiooooouuuucn";


function normNoAccentUpper(s = "") {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "DE","DA","DO","DAS","DOS","E","EM","PARA","NA","NO","NAS","NOS","A","O","AS","OS",
  "NAO"
]);

function tokensFromPhrase(phrase) {
  const n = normNoAccentUpper(phrase);
  return n
    .split(" ")
    .map(t => t.trim())
    .filter(t => t.length >= 4 && !STOPWORDS.has(t))
    .slice(0, 8);
}

function safeToken(t) {
  const s = normNoAccentUpper(t);
  return s.replace(/[^A-Z0-9 ]/g, "").trim();
}


module.exports = {

    async getAllIdsAccentInsensitive(filters) {
        const { cnae, cria } = filters;

        const termos = [
            ...(Array.isArray(cnae) ? cnae : cnae ? [cnae] : []),
            ...(Array.isArray(cria) ? cria : cria ? [cria] : [])
        ]
            .map(v => v && v.trim())
            .filter(Boolean)
            .map(normNoAccentUpper);

        if (termos.length === 0) {
            return [];
        }

        const orSql = termos.map(t => Prisma.sql`
      translate(upper(coalesce("cria", '')), ${ACCENT_FROM}, ${ACCENT_TO}) LIKE ${'%' + t + '%'}
      OR
      translate(upper(coalesce("segmento1", '')), ${ACCENT_FROM}, ${ACCENT_TO}) LIKE ${'%' + t + '%'}
    `);

        const rows = await prisma.$queryRaw(Prisma.sql`
      SELECT "id"
      FROM "clientes"
      WHERE (${Prisma.join(orSql, Prisma.sql` OR `)})
    `);

        return rows.map(r => String(r.id));
    },



    normalizeText(text) {
        if (!text) return "";
        return text
            .toUpperCase()
            .replace(/[ÀÁÂÃÄÅ]/g, "A")
            .replace(/[ÈÉÊË]/g, "E")
            .replace(/[ÌÍÎÏ]/g, "I")
            .replace(/[ÒÓÔÕÖ]/g, "O")
            .replace(/[ÙÚÛÜ]/g, "U")
            .replace(/[Ç]/g, "C")
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/-/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    },

_buildWhere(filters) {
  const { city, state, cnpj, name } = filters;
  const where = { AND: [] };

  const limparArray = (valor) => {
    if (!valor) return [];
    const array = Array.isArray(valor) ? valor : [valor];
    return array
      .map(x => (typeof x === "string" ? x.trim() : x))
      .filter(item => item && item !== "");
  };

  const statesLimpos = limparArray(state);
  if (statesLimpos.length > 0) {
    where.AND.push({
      OR: statesLimpos.map(val => ({
        a1Estc: { equals: val.trim(), mode: "insensitive" }
      }))
    });
  }

  const citiesLimpas = limparArray(city);
  if (citiesLimpas.length > 0) {
    const cityConditions = [];
    citiesLimpas.forEach(val => {
      const original = val.trim().normalize("NFC");
      const normalizado = this.normalizeText(val);

      cityConditions.push({ a1Munc: { equals: original, mode: "insensitive" } });
      if (normalizado && normalizado !== original.toUpperCase()) {
        cityConditions.push({ a1Munc: { equals: normalizado, mode: "insensitive" } });
      }
    });
    where.AND.push({ OR: cityConditions });
  }

  const cnpjsLimpos = limparArray(cnpj).map(c => String(c).replace(/\D/g, ""));
  if (cnpjsLimpos.length > 0) {
    where.AND.push({ a1Cgc: { in: cnpjsLimpos } });
  }

  if (typeof name === "string" && name.trim().length > 0) {
    where.AND.push({
      a1Nome: { contains: name.trim(), mode: "insensitive" }
    });
  }

  return where;
},

async getAllIds(filters) {
  console.log("🧩 [Service] filters recebidos:", JSON.stringify(filters, null, 2));

  const { cnae = [], cria = [], city = [], state = [], cnpj = [], name = "" } = filters;

  const hasActivity = (Array.isArray(cnae) && cnae.length > 0) || (Array.isArray(cria) && cria.length > 0);
  const hasBaseFilters =
    (Array.isArray(city) && city.length > 0) ||
    (Array.isArray(state) && state.length > 0) ||
    (Array.isArray(cnpj) && cnpj.length > 0) ||
    (typeof name === "string" && name.trim().length > 0);

  if (!hasActivity && !hasBaseFilters) {
    const farms = await prisma.clientes.findMany({ select: { id: true } });
    return farms.map(f => String(f.id));
  }
  if (!hasActivity) {
    const where = this._buildWhere({ city, state, cnpj, name, cnae: [], cria: [] });
    const farms = await prisma.clientes.findMany({
      where,
      select: { id: true }
    });
    return farms.map(f => String(f.id));
  }

  const baseWhere = this._buildWhere({ city, state, cnpj, name, cnae: [], cria: [] });
  const baseIds = await prisma.clientes.findMany({
    where: baseWhere,
    select: { id: true }
  });

  if (baseIds.length === 0) return [];

  const termosOriginais = [...cnae, ...cria].filter(Boolean);

  const termosTokens = termosOriginais.map((termo) => {
    const toks = tokensFromPhrase(termo).map(safeToken).filter(Boolean);
    return toks.length ? toks : [safeToken(termo)];
  });

  let paramIndex = 3;
  const params = [];

  const termBlocksSql = termosTokens.map((tokens) => {
    const criaAnd = tokens.map((t) => {
      params.push(t);
      const p = `$${paramIndex++}`;
      return `cria_n LIKE '%' || ${p} || '%'`;
    }).join(" AND ");

    const segAnd = tokens.map((t) => {
      params.push(t);
      const p = `$${paramIndex++}`;
      return `seg_n LIKE '%' || ${p} || '%'`;
    }).join(" AND ");

    return `((${criaAnd}) OR (${segAnd}))`;
  }).join(" OR ");

  const query = `
    WITH base AS (
      SELECT
        "id",
        upper(translate(coalesce("cria", ''), $1, $2)) AS cria_n,
        upper(translate(coalesce("segmento1", ''), $1, $2)) AS seg_n
      FROM "clientes"
    )
    SELECT "id"
    FROM base
    WHERE ${termBlocksSql}
  `;

  const activityRows = await prisma.$queryRawUnsafe(query, ACCENT_FROM, ACCENT_TO, ...params);

  const baseSet = new Set(baseIds.map(x => x.id.toString()));
  const final = activityRows
    .map(r => r.id.toString())
    .filter(id => baseSet.has(id));

  return final;
},

async getByIds(idsList) {
  return await prisma.clientes.findMany({
    where: {
      id: { in: idsList }
    }
  });
},


    async getCrias() {

        const categories = await prisma.clientes.findMany({

            distinct: ['cria'],

            select: {

                cria: true

            },

            where: {

                cria: {

                    not: null,

                    notIn: ['']

                }

            },

            orderBy: {

                cria: 'asc'

            }

        });



        const listaLimpa = categories

            .map(item => item.cria.toUpperCase())

            .filter(item => item !== null && item.trim() !== "");



        return [...new Set(listaLimpa)].sort();

    }
};