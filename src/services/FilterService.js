const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { Readable } = require('stream');
const crypto = require('crypto');

// Cache para contagens pesadas (5 minutos)
const countCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getFilterHash(where) {
  const str = JSON.stringify(where);
  return crypto.createHash('md5').update(str).digest('hex');
}

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
    const { cnae } = filters;

    const termos = [
      ...(Array.isArray(cnae) ? cnae : cnae ? [cnae] : [])
    ]
      .map(v => v && v.trim())
      .filter(Boolean)
      .map(normNoAccentUpper);

    if (termos.length === 0) {
      return [];
    }

    // Busca via Prisma Models: principal IN + secundario contains (sem SQL raw)
    const rows = await prisma.estabelecimento.findMany({
      where: {
        OR: [
          ...termos.map(t => ({ cnae_fiscal_principal: { contains: t } })),
          ...termos.map(t => ({ cnae_fiscal_secundaria: { contains: t } }))
        ]
      },
      select: { cnpj_basico: true, cnpj_ordem: true, cnpj_dv: true }
    });

    return rows.map(r =>
      String(r.cnpj_basico).padStart(8, '0') +
      String(r.cnpj_ordem).padStart(4, '0') +
      String(r.cnpj_dv).padStart(2, '0')
    );
  },



  normalizeList(input) {
    if (!input) return [];
    const array = Array.isArray(input) ? input : [input];
    return array
      .map(item => {
        if (!item) return null;
        if (typeof item === 'object') {
          return item.value || item.id || item.code || item.codigo_municipio || item.label || null;
        }
        return String(item).trim();
      })
      .filter(item => item !== null && item !== "");
  },

  normalizeDigits(input) {
    if (!input) return "";
    return String(input).replace(/\D/g, "");
  },

  normalizeText(text) {
    if (!text) return "";
    return text
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  async _resolveCityCodes(cityInput) {
    const list = this.normalizeList(cityInput);

    if (list.length === 0) return [];

    // 1) separar entradas que já são códigos
    const asCodes = list
      .map(x => String(x).trim())
      .filter(x => /^\d{4,10}$/.test(x)); // aceita 7 dígitos, mas tolera variações

    // 2) nomes (ex: "SAO PAULO", "São Paulo")
    const asNames = list
      .map(x => String(x).trim())
      .filter(x => !/^\d+$/.test(x))
      .map(x => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '')); // tira acento

    let foundCodes = [];
    if (asNames.length) {
      const rows = await prisma.municipio.findMany({
        where: {
          OR: asNames.map(n => ({
            nome_municipio: { equals: n.toUpperCase() } // sua base costuma estar em caixa alta
          }))
        },
        select: { codigo_municipio: true }
      });
      foundCodes = rows.map(r => r.codigo_municipio);
    }

    // dedup
    return Array.from(new Set([...asCodes, ...foundCodes])).filter(Boolean);
  },

  async enrichWithCityNames(items) {
    const codes = Array.from(new Set(items.map(i => i.municipio).filter(Boolean)));
    if (!codes.length) return items;

    const rows = await prisma.municipio.findMany({
      where: { codigo_municipio: { in: codes } },
      select: { codigo_municipio: true, nome_municipio: true }
    });

    const map = new Map(rows.map(r => [r.codigo_municipio, r.nome_municipio]));

    return items.map(i => ({
      ...i,
      cidade_nome: i.municipio ? (map.get(i.municipio) ?? null) : null
    }));
  },
  async enrichWithCnaeDescriptions(items) {
    if (!items || items.length === 0) return items;

    const cnaeCodes = new Set();
    items.forEach(item => {
      if (item.cnae_fiscal_principal) cnaeCodes.add(item.cnae_fiscal_principal);
      if (item.cnae_fiscal_secundaria) {
        const secundarias = item.cnae_fiscal_secundaria.split(/[\s,;]+/).filter(Boolean);
        secundarias.forEach(c => cnaeCodes.add(c));
      }
    });

    if (cnaeCodes.size === 0) return items;

    const list = [...cnaeCodes];
    const cnaes = await prisma.cnae.findMany({
      where: { codigo_cnae: { in: list } }
    });

    const dict = {};
    cnaes.forEach(c => {
      dict[c.codigo_cnae] = c.descricao_cnae;
    });

    return items.map(item => {
      let descSecundaria = null;
      if (item.cnae_fiscal_secundaria) {
        const codes = item.cnae_fiscal_secundaria.split(/[\s,;]+/).filter(Boolean);
        descSecundaria = codes.map(c => dict[c] || c).join(', ');
      }

      return {
        ...item,
        cnae_descricao: dict[item.cnae_fiscal_principal] || null,
        cnae_secundaria_descricao: descSecundaria
      };
    });
  },

  // _buildWhere legacy removido – usar _buildPrismaWhere(filters)

  async getAllIds(filters) {
    const startTime = Date.now();
    const debug = process.env.DEBUG_QUERY_TIMING === 'true';

    // Reutiliza o mesmo builder do search/export
    const where = await this._buildPrismaWhere(filters);

    const t1 = Date.now();
    const LIMIT = 200_000;

    const results = await prisma.estabelecimento.findMany({
      where,
      take: LIMIT,
      select: { cnpj_basico: true, cnpj_ordem: true, cnpj_dv: true }
    });

    if (debug) console.log(`[getAllIds] findMany=${Date.now() - t1}ms total=${Date.now() - startTime}ms n=${results.length}`);

    const ids = results.map(c =>
      String(c.cnpj_basico).padStart(8, '0') +
      String(c.cnpj_ordem).padStart(4, '0') +
      String(c.cnpj_dv).padStart(2, '0')
    );

    return { ids, total: ids.length };
  },

  async getByIds(idsList) {
    const orConditions = idsList.map(id => {
      const s = String(id);
      if (s.length === 14) {
        return {
          cnpj_basico: s.substring(0, 8),
          cnpj_ordem: s.substring(8, 12),
          cnpj_dv: s.substring(12, 14)
        };
      }
      return null;
    }).filter(Boolean);

    if (orConditions.length === 0) return [];

    const results = await prisma.estabelecimento.findMany({
      where: {
        OR: orConditions
      },
      include: {
        empresa: {
          include: {
            socios: true
          }
        }
      }
    });

    const enrichedWithCities = await this.enrichWithCityNames(results);
    return await this.enrichWithCnaeDescriptions(enrichedWithCities);
  },


  async getAllCnaes() {
    return await prisma.cnae.findMany({
      orderBy: {
        codigo_cnae: 'asc'
      }
    });
  },

  async getCampaigns({ accountId, effectiveStatus }) {
    const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
    const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

    if (!META_ACCESS_TOKEN) {
      throw new Error('META_ACCESS_TOKEN não definido no servidor');
    }

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

    if (adsetData.location && adsetData.location.lat && adsetData.location.lng) {
      coords = {
        lat: adsetData.location.lat,
        lng: adsetData.location.lng
      };
      console.log(`[Service] Usando coordenadas fornecidas: ${coords.lat}, ${coords.lng}`);
    } else {
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

  async createAudienceSegment(data) {
    let formattedCoords = null;

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

  async _buildPrismaWhere(filters) {
    const {
      state, city, cnae, name, razaoSocial, porteEmpresa, cnpj,
      capitalSocialMin, capitalSocialMax, capitalSocialZero,
      selection
    } = filters || {};

    const where = { AND: [] };

    // 1. UF (state)
    const states = this.normalizeList(state).map(s => s.toUpperCase());
    if (states.length > 0) {
      where.AND.push({ uf: { in: states } });
    }

    // 2. City
    const resolvedCityCodes = await this._resolveCityCodes(city);
    if (resolvedCityCodes.length > 0) {
      where.AND.push({ municipio: { in: resolvedCityCodes } });
    }

    // 3. CNAE
    // GUARD: limitar OR de secundário a 20 para evitar varredura explosiva
    const MAX_CNAE_SECONDARY_OR = 20;
    const cnaesLimpos = this.normalizeList(cnae);
    if (cnaesLimpos.length > 0) {
      const secondaryList = cnaesLimpos.slice(0, MAX_CNAE_SECONDARY_OR); // trunca para segurar performance
      const tooMany = cnaesLimpos.length > MAX_CNAE_SECONDARY_OR;
      if (tooMany) console.warn(`[buildWhere] CNAE list truncada para ${MAX_CNAE_SECONDARY_OR} no filtro secundário (enviado: ${cnaesLimpos.length})`);

      where.AND.push({
        OR: [
          { cnae_fiscal_principal: { in: cnaesLimpos } },
          ...secondaryList.map(c => ({
            cnae_fiscal_secundaria: { contains: c }
          }))
        ]
      });
    }

    // 4. CNPJ
    const cnpjsRaw = this.normalizeList(cnpj);
    if (cnpjsRaw.length > 0) {
      const orCnpjs = cnpjsRaw.map(c => {
        const digits = this.normalizeDigits(c);
        if (digits.length === 14) {
          return {
            cnpj_basico: digits.substring(0, 8),
            cnpj_ordem: digits.substring(8, 12),
            cnpj_dv: digits.substring(12, 14)
          };
        } else if (digits.length === 8) {
          return { cnpj_basico: digits };
        }
        return null;
      }).filter(Boolean);

      if (orCnpjs.length > 0) {
        where.AND.push({ OR: orCnpjs });
      }
    }

    // 5. Name (nome_fantasia)
    if (name && typeof name === "string" && name.trim()) {
      where.AND.push({
        nome_fantasia: { contains: name.trim(), mode: "insensitive" }
      });
    }

    // 6. Empresa filters (Relation)
    const empresaWhere = { AND: [] };
    if (razaoSocial && typeof razaoSocial === "string" && razaoSocial.trim()) {
      empresaWhere.AND.push({
        razao_social: { contains: razaoSocial.trim(), mode: "insensitive" }
      });
    }
    // Aceita tanto '1' quanto '01', '2' quanto '02' etc. (valor real no banco pode variar)
    const portesRaw = this.normalizeList(porteEmpresa).map(p => String(p).trim()).filter(Boolean);
    if (portesRaw.length > 0) {
      const porteOrValues = Array.from(
        new Set(portesRaw.flatMap(p => [p, p.padStart(2, '0')]))
      ).map(v => ({ porte_empresa: v }));
      empresaWhere.AND.push({ OR: porteOrValues });
    }

    // Capital Social
    const isZeroTrue = capitalSocialZero === true || String(capitalSocialZero) === "true";
    if (!isZeroTrue) {
      // Se false, NÃO deve aparecer rows com capital social zero ou nulo
      empresaWhere.AND.push({
        NOT: {
          OR: [
            { capital_social: { in: ['0,00', '0.00', '0', ''] } },
            { capital_social: null }
          ]
        }
      });
    }
    // Se isZeroTrue for true, não adicionamos restrição, então as linhas com capital zero aparecem normalmente.
    // TODO: Implement capitalSocialMin/Max when capital_social_num exists (currently string)
    // capitalSocialMin: ${capitalSocialMin}, capitalSocialMax: ${capitalSocialMax}

    if (empresaWhere.AND.length > 0) {
      where.AND.push({ empresa: empresaWhere });
    }

    // 7. Selection (Lógica de Seleção por Comando)
    if (selection) {
      const { all, manualIds, excludedIds } = selection;
      if (all && excludedIds && excludedIds.length > 0) {
        const notIn = excludedIds.map(id => {
          const s = this.normalizeDigits(id);
          if (s.length === 14) {
            return {
              AND: [
                { cnpj_basico: s.substring(0, 8) },
                { cnpj_ordem: s.substring(8, 12) },
                { cnpj_dv: s.substring(12, 14) }
              ]
            };
          }
          return null;
        }).filter(Boolean);
        if (notIn.length > 0) {
          where.AND.push({ NOT: { OR: notIn } });
        }
      } else if (!all && manualIds && manualIds.length > 0) {
        const inIds = manualIds.map(id => {
          const s = this.normalizeDigits(id);
          if (s.length === 14) {
            return {
              AND: [
                { cnpj_basico: s.substring(0, 8) },
                { cnpj_ordem: s.substring(8, 12) },
                { cnpj_dv: s.substring(12, 14) }
              ]
            };
          }
          return null;
        }).filter(Boolean);
        if (inIds.length > 0) {
          where.AND.push({ OR: inIds });
        }
      }
    }

    // 8. Proteção contra dados sujos (cnpjs nulos/vazios que quebram o Prisma)
    where.AND.push({
      cnpj_basico: { gt: "" }
    });

    return where;
  },

  /**
   * Busca paginada de estabelecimentos.
   *
   * Estratégia de pageCount sem COUNT pesado:
   *   - Busca pageSize + 1 itens.
   *   - Se vier mais que pageSize → hasMore = true.
   *   - COUNT é executado em paralelo com timeout de COUNT_TIMEOUT_MS.
   *   - Se COUNT demorar, usa estimativa baseada em hasMore.
   *   - Retorna { items, total, pageCount, hasMore } mantendo 'total' para compatibilidade.
   */
  async searchEstablishments(filters, page = 1, pageSize = 20) {
    const debug = process.env.DEBUG_QUERY_TIMING === 'true';
    const COUNT_TIMEOUT_MS = parseInt(process.env.COUNT_TIMEOUT_MS || '1500', 10); // Aumentado para 1.5s
    const safePage = Math.max(1, page);
    const safeSize = Math.max(1, pageSize);
    const skip = (safePage - 1) * safeSize;

    // ── A) Build WHERE ────────────────────────────────────────────────
    const t0 = Date.now();
    const where = await this._buildPrismaWhere(filters);
    const filterHash = getFilterHash(where);
    if (debug) console.log(`[search] buildWhere=${Date.now() - t0}ms hash=${filterHash}`);

    // ── B) findMany com +1 para detectar hasMore ──────────────────────
    const t1 = Date.now();
    const rawItems = await prisma.estabelecimento.findMany({
      where,
      skip,
      take: safeSize + 1,
      orderBy: [
        { cnpj_basico: 'asc' },
        { cnpj_ordem: 'asc' },
        { cnpj_dv: 'asc' }
      ],
      select: {
        cnpj_basico: true,
        cnpj_ordem: true,
        cnpj_dv: true,
        nome_fantasia: true,
        uf: true,
        municipio: true,
        situation: true,
        cnae_fiscal_principal: true,
        cnae_fiscal_secundaria: true,
        correio_eletronico: true,
        ddd1: true,
        telefone1: true,
        ddd2: true,
        telefone2: true,
        classification: true,
        empresa: {
          select: {
            razao_social: true,
            porte_empresa: true,
            capital_social: true,
            codigo_natureza_juridica: true,
          }
        }
      }
    });

    const hasMore = rawItems.length > safeSize;
    const pageItems = hasMore ? rawItems.slice(0, safeSize) : rawItems;
    if (debug) console.log(`[search] findMany=${Date.now() - t1}ms n=${pageItems.length} hasMore=${hasMore}`);

    // ── C) Lógica de COUNT com Cache ───────────────────────────────────
    let total = null;
    let pageCount = null;

    const cached = countCache.get(filterHash);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      total = cached.count;
      pageCount = Math.ceil(total / safeSize);
      if (debug) console.log(`[search] count(cache)=${total}`);
    } else {
      try {
        const t2 = Date.now();
        const countPromise = prisma.estabelecimento.count({ where });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('count_timeout')), COUNT_TIMEOUT_MS)
        );
        total = await Promise.race([countPromise, timeoutPromise]);

        // Salva no cache
        countCache.set(filterHash, { count: total, timestamp: Date.now() });
        pageCount = Math.ceil(total / safeSize);
        if (debug) console.log(`[search] count(db)=${Date.now() - t2}ms total=${total}`);
      } catch (err) {
        if (err.message === 'count_timeout') {
          // Se deu timeout, retorna estimativa mas dispara o count em background para a próxima vez
          if (debug) console.log(`[search] count timeout! disparando background count...`);

          prisma.estabelecimento.count({ where })
            .then(realCount => {
              countCache.set(filterHash, { count: realCount, timestamp: Date.now() });
              if (debug) console.log(`[search] background count finalizado: ${realCount}`);
            })
            .catch(e => console.error('[search] background count error:', e.message));

          // Estimativa visível agora:
          pageCount = hasMore ? safePage + 1 : safePage;
          total = pageCount * safeSize;
        } else {
          console.error('[search] count error:', err.message);
          pageCount = hasMore ? safePage + 1 : safePage;
          total = pageCount * safeSize;
        }
      }
    }

    // ── D) Enriquecer cidades ─────────────────────────────────────────
    const t3 = Date.now();
    const itemsComCnpj = pageItems.map(item => ({
      ...item,
      cnpj: String(item.cnpj_basico).padStart(8, '0') +
        String(item.cnpj_ordem).padStart(4, '0') +
        String(item.cnpj_dv).padStart(2, '0')
    }));
    const enrichedWithCities = await this.enrichWithCityNames(itemsComCnpj);
    const finalItems = await this.enrichWithCnaeDescriptions(enrichedWithCities);
    if (debug) console.log(`[search] enrich=${Date.now() - t3}ms`);

    return { items: finalItems, total, pageCount, hasMore };
  },

  /**
   * Escapa um valor para uso em CSV (RFC 4180)
   */
  _escapeCsv(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  },

  /**
   * Converte um objeto de estabelecimento em linha CSV
   */
  _toCsvRow(item) {
    const e = this._escapeCsv.bind(this);
    return [
      e(item.cnpj),
      e(item.nome_fantasia),
      e(item.razao_social),
      e(item.uf),
      e(item.cidade_nome),
      e(item.correio_eletronico),
      e(item.ddd1 && item.telefone1 ? item.ddd1 + item.telefone1 : item.telefone1)
    ].join(',') + '\n';
  },

  /**
   * Exporta CSV em batches via keyset cursor (sem OFFSET crescente).
   * Cursor aponta para a PK composta: { cnpj_basico, cnpj_ordem, cnpj_dv }.
   * Pronto para streaming sem carregar tudo em memória.
   */
  async getCsvStream(filters) {
    const startTime = Date.now();
    const BATCH_SIZE = 10_000;
    const MAX_ROWS = 1_000_000;
    const debug = process.env.DEBUG_QUERY_TIMING === 'true';

    const where = await this._buildPrismaWhere(filters);

    const CSV_HEADER = 'cnpj,nome_fantasia,razao_social,uf,cidade,email,telefone\n';
    const readable = new Readable({ read() { } });
    readable.push(CSV_HEADER);

    const self = this;

    (async () => {
      let cursor = null;           // keyset cursor: objeto { cnpj_basico, cnpj_ordem, cnpj_dv }
      let totalExported = 0;

      try {
        while (totalExported < MAX_ROWS) {
          const take = Math.min(BATCH_SIZE, MAX_ROWS - totalExported);
          const t0 = Date.now();

          const queryOpts = {
            where,
            take,
            orderBy: [
              { cnpj_basico: 'asc' },
              { cnpj_ordem: 'asc' },
              { cnpj_dv: 'asc' }
            ],
            select: {
              cnpj_basico: true,
              cnpj_ordem: true,
              cnpj_dv: true,
              nome_fantasia: true,
              uf: true,
              municipio: true,
              correio_eletronico: true,
              ddd1: true,
              telefone1: true,
              classification: true,
              empresa: { select: { razao_social: true } }
            }
          };

          // A partir do 2º batch usa cursor keyset (skip:1 pula o registro-cursor)
          if (cursor) {
            queryOpts.cursor = cursor;
            queryOpts.skip = 1;
          }

          const batch = await prisma.estabelecimento.findMany(queryOpts);
          if (debug) console.log(`[getCsvStream] batch=${Date.now() - t0}ms n=${batch.length} exported=${totalExported}`);

          if (batch.length === 0) break;

          // Próximo cursor é o último item do batch
          const last = batch[batch.length - 1];
          cursor = {
            cnpj_basico_cnpj_ordem_cnpj_dv: {
              cnpj_basico: last.cnpj_basico,
              cnpj_ordem: last.cnpj_ordem,
              cnpj_dv: last.cnpj_dv
            }
          };

          // Enriquecer código de cidade em 1 query para o batch
          const batchComCnpj = batch.map(item => ({
            ...item,
            razao_social: item.empresa?.razao_social || null,
            cnpj: String(item.cnpj_basico).padStart(8, '0') +
              String(item.cnpj_ordem).padStart(4, '0') +
              String(item.cnpj_dv).padStart(2, '0')
          }));

          const enriched = await self.enrichWithCityNames(batchComCnpj);

          for (const item of enriched) {
            readable.push(self._toCsvRow(item));
          }

          totalExported += batch.length;

          if (batch.length < take) break; // última página
        }

        readable.push(null);
        if (debug) console.log(`[getCsvStream] done total=${totalExported} ms=${Date.now() - startTime}`);
      } catch (err) {
        console.error('[getCsvStream] error:', err);
        readable.destroy(err);
      }
    })();

    return readable;
  }
};