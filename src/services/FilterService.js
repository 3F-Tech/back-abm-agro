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
  "DE", "DA", "DO", "DAS", "DOS", "E", "EM", "PARA", "NA", "NO", "NAS", "NOS", "A", "O", "AS", "OS",
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

const axios = require('axios');
const GeocodingService = require('./GeocodingService');

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_VERSION = process.env.META_API_VERSION || 'v19.0';
const META_TOKEN = process.env.META_ACCESS_TOKEN;

function normalizeAccountId(accountId) {
  if (!accountId) return '';
  const trimmed = String(accountId).trim();
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
}

async function fetchAllPages(firstUrl) {
  const all = [];
  let url = firstUrl;

  while (url) {
    const { data } = await axios.get(url, { timeout: 60_000 });
    if (Array.isArray(data?.data)) all.push(...data.data);
    url = data?.paging?.next || null;
  }

  return all;
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

  },

  async getCampaigns({ accountId, effectiveStatus }) {
    const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
    const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

    if (!META_ACCESS_TOKEN) {
      throw new Error('META_ACCESS_TOKEN não definido no servidor');
    }

    // aceita "6129..." e "act_6129..."
    const act = String(accountId || '').trim().startsWith('act_')
      ? String(accountId).trim()
      : `act_${String(accountId || '').trim()}`;

    if (!act || act === 'act_') {
      throw new Error('accountId inválido/ausente');
    }

    const base = `https://graph.facebook.com/${META_GRAPH_VERSION}/${act}/campaigns`;

    const fields = [
      'id',
      'name',
      'status'
    ].join(',');

    const params = new URLSearchParams();
    params.set('access_token', META_ACCESS_TOKEN);
    params.set('fields', fields);
    params.set('limit', '500');

    if (effectiveStatus && effectiveStatus.length > 0) {
      params.set('effective_status', JSON.stringify(effectiveStatus));
    }

    let url = `${base}?${params.toString()}`;
    const all = [];

    while (url) {
      try {
        const { data } = await axios.get(url, { timeout: 60_000 });

        if (Array.isArray(data?.data)) all.push(...data.data);
        url = data?.paging?.next || null;

      } catch (err) {
        const status = err?.response?.status;
        const body = err?.response?.data;

        console.error('[MetaCampaign] axios error:', {
          message: err?.message,
          code: err?.code,
          status,
          body,
          url,
        });

        throw new Error(
          status
            ? `Meta API error HTTP ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`
            : `Meta API request failed: ${err?.message}`
        );
      }
    }

    return all.map(c => ({
      id: c?.id,
      name: c?.name,
      status: c?.status,
      effective_status: c?.effective_status,
      objective: c?.objective,
      created_time: c?.created_time,
      updated_time: c?.updated_time,
    }));
  },

  async createAdset(adsetData) {
    if (!META_TOKEN) {
      throw new Error("ERRO CRÍTICO: Variável de ambiente META_ACCESS_TOKEN não configurada.");
    }

    let coords;

    // Se location foi fornecido, usa diretamente
    if (adsetData.location && adsetData.location.lat && adsetData.location.lng) {
      coords = {
        lat: adsetData.location.lat,
        lng: adsetData.location.lng
      };
      console.log(`[Service] Usando coordenadas fornecidas: ${coords.lat}, ${coords.lng}`);
    } else {
      // Caso contrário, converte o endereço
      coords = await GeocodingService.getCoordinatesFromAddress(adsetData.address);
      console.log(`[Service] Coordenadas obtidas via geocoding: ${coords.lat}, ${coords.lng}`);
    }

    const metaPayload = {
      name: adsetData.name,
      campaign_id: adsetData.campaign_id,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'CONVERSIONS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      daily_budget: 3000,
      status: 'PAUSED',
      targeting: {
        geo_locations: {
          custom_locations: [
            {
              latitude: coords.lat,
              longitude: coords.lng,
              radius: adsetData.radius,
              distance_unit: "kilometer"
            }
          ]
        },
        age_min: 18,
        age_max: 65
      }
    };

    try {
      const url = `https://graph.facebook.com/${META_VERSION}/act_${adsetData.account_id}/adsets`;

      const response = await axios.post(url, metaPayload, {
        params: {
          access_token: META_TOKEN
        }
      });

      return {
        id: response.data.id,
        success: true,
        geo_info: coords
      };

    } catch (error) {
      console.error('[Service] Erro API Meta:', error.response?.data?.error?.message || error.message);
      throw error;
    }
  },

  /**
   * Cria um novo segmento de público no banco de dados
   * @param {Object} data - Objeto contendo name, description, created_by, targeting
   */
  async createAudienceSegment(data) {
    let formattedCoords = null;

    // Prioridade 1: Se location foi fornecido diretamente
    if (data.location) {
      try {
        const locations = Array.isArray(data.location) ? data.location : [data.location];
        formattedCoords = locations
          .filter(loc => loc.lat && loc.lng)
          .map(loc => `${loc.lat},${loc.lng}`)
          .join(';');
        console.log('[Service] Usando coordenadas fornecidas diretamente');
      } catch (error) {
        console.error("Erro ao processar locations fornecidas:", error.message);
      }
    }
    // Prioridade 2: Se não tiver location mas tiver endereço, converte
    else if (data.address) {
      try {
        const addresses = Array.isArray(data.address) ? data.address : [data.address];
        const coordsList = await Promise.all(
          addresses.map(addr => GeocodingService.getCoordinatesFromAddress(addr))
        );
        formattedCoords = coordsList.map(c => `${c.lat},${c.lng}`).join(';');
        console.log('[Service] Coordenadas obtidas via geocoding');
      } catch (error) {
        console.error("Erro ao converter endereços no savePublic:", error.message);
      }
    }

    const payload = {
      name: data.name,
      description: data.description || null,
      created_by: data.created_by || 'system',
      cidade: data.city || null,
      estado: data.state || null,
      cnae: data.cnae ? (Array.isArray(data.cnae) ? data.cnae.join(', ') : String(data.cnae)) : null,
      locations: formattedCoords,
    };

    try {
      const newSegment = await prisma.audience_segment.create({
        data: payload
      });

      return newSegment;

    } catch (error) {
      console.error("Erro no Service createAudienceSegment:", error);
      throw error;
    }
  },

};