const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FilterService = require('../services/FilterService');
const adSetService = require('../services/FilterService');
const { supabase } = require('../config/supabase');

function ensureArray(v) {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
}


const CompanyController = {
    _serializeItem(item) {
        const porteMapping = { "01": "NÃO INFORMADO", "02": "MICRO EMPRESA (ME)", "03": "EMPRESA DE PEQUENO PORTE (EPP)", "04": "EPP (VARIAÇÃO)", "05": "DEMAIS" };
        const situacaoMapping = { "01": "NULA", "02": "ATIVA", "03": "SUSPENSA", "04": "INAPTA", "08": "BAIXADA" };

        const cnpjCompleto = String(item.cnpj || "").replace(/\D/g, "").padStart(14, "0");
        const cnpjFormatado = cnpjCompleto.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

        // Suporta tanto campos diretos (flatten) quanto relação empresa { ... }
        const empresa = item.empresa || {};
        const razaoSocial = item.razao_social || empresa.razao_social || null;
        const porteCodigo = item.porte_empresa || empresa.porte_empresa || null;
        const capitalSocial = item.capital_social || empresa.capital_social || null;
        const naturezaJuridica = item.codigo_natureza_juridica || empresa.codigo_natureza_juridica || null;
        const situacaoCodigo = item.situacao_cadastral;

        return {
            id: cnpjCompleto,
            cnpj: cnpjFormatado,
            nome_fantasia: item.nome_fantasia || null,
            razao_social: razaoSocial,

            uf: item.uf || null,
            municipio: item.cidade_nome || item.municipio || null,

            cnae_fiscal_principal: item.cnae_fiscal_principal || null,
            cnae_primario: item.cnae_descricao || item.cnae_fiscal_principal || null,
            cnae_fiscal_secundaria: item.cnae_secundaria_descricao || item.cnae_fiscal_secundaria || null,

            email: item.correio_eletronico || null,

            telefone1: item.ddd1 && item.telefone1 ? `(${item.ddd1}) ${item.telefone1}` : (item.telefone1 || ""),
            telefone2: item.ddd2 && item.telefone2 ? `(${item.ddd2}) ${item.telefone2}` : (item.telefone2 || ""),

            porte: porteMapping[String(porteCodigo || "").padStart(2, "0")] || porteCodigo || "NÃO INFORMADO",
            situacao_cadastral: situacaoMapping[String(situacaoCodigo || "").padStart(2, "0")] || situacaoCodigo,

            capital_social: capitalSocial,
            natureza_juridica: naturezaJuridica,
            classification: item.classification || null,
        };

    },

    async getCnaes(req, res) {
        try {
            const list = await FilterService.getAllCnaes();
            return res.status(200).json(list);
        } catch (error) {
            console.error("Erro ao listar CNAEs:", error);
            return res.status(500).json({
                error: "Erro ao buscar dados.",
                message: error.message,
                stack: error.stack
            });
        }
    },
    async getAllIdsFilter(req, res) {
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');

        try {
            let filters = { ...req.body };

            filters = {
                ...filters,
                cnae: ensureArray(filters.cnae),
                cria: ensureArray(filters.cria),
                city: ensureArray(filters.city),
                state: ensureArray(filters.state),
                cnpj: ensureArray(filters.cnpj),
                porteEmpresa: ensureArray(filters.porteEmpresa),
                name: typeof filters.name === "string" ? filters.name : (filters.name ? String(filters.name) : ""),
                razaoSocial: typeof filters.razaoSocial === "string" ? filters.razaoSocial : (filters.razaoSocial ? String(filters.razaoSocial) : ""),
                capitalSocialMin: typeof filters.capitalSocialMin === "string" ? filters.capitalSocialMin : (filters.capitalSocialMin ? String(filters.capitalSocialMin) : ""),
                capitalSocialMax: typeof filters.capitalSocialMax === "string" ? filters.capitalSocialMax : (filters.capitalSocialMax ? String(filters.capitalSocialMax) : ""),
                capitalSocialZero: filters.capitalSocialZero === true || filters.capitalSocialZero === 'true',
                includeTotal: filters.includeTotal === true || filters.includeTotal === 'true'
            };

            const safeDecode = (val) => {
                if (!val) return val;
                if (Array.isArray(val)) return val.map(item => safeDecode(item));
                if (typeof val === 'string') {
                    try {
                        return decodeURIComponent(val.replace(/\+/g, ' '));
                    } catch (e) {
                        return val.replace(/\+/g, ' ');
                    }
                }
                return val;
            };

            filters.cnae = safeDecode(filters.cnae);
            filters.cria = safeDecode(filters.cria);
            filters.city = safeDecode(filters.city);
            filters.state = safeDecode(filters.state);
            filters.cnpj = safeDecode(filters.cnpj);
            filters.name = safeDecode(filters.name);
            filters.razaoSocial = safeDecode(filters.razaoSocial);
            filters.capitalSocialMin = safeDecode(filters.capitalSocialMin);
            filters.capitalSocialMax = safeDecode(filters.capitalSocialMax);
            filters.porteEmpresa = safeDecode(filters.porteEmpresa);

            const cleanArr = (arr) => arr.map(x => (typeof x === "string" ? x.trim() : x)).filter(x => x);
            filters.cnae = cleanArr(filters.cnae);
            filters.cria = cleanArr(filters.cria);
            filters.city = cleanArr(filters.city);
            filters.state = cleanArr(filters.state);
            filters.cnpj = cleanArr(filters.cnpj);
            filters.porteEmpresa = cleanArr(filters.porteEmpresa);

            console.log("[Controller] Filtros recebidos:", {
                ...filters,
                cnae: Array.isArray(filters.cnae) ? `Array(${filters.cnae.length})` : filters.cnae,
                city: Array.isArray(filters.city) ? `Array(${filters.city.length})` : filters.city,
                cnpj: Array.isArray(filters.cnpj) ? `Array(${filters.cnpj.length})` : filters.cnpj
            });

            const { ids, total } = await FilterService.getAllIds(filters);
            return res.status(200).json({ ids, total });

        } catch (error) {
            console.error("ERRO getAllIdsFilter:", error);
            return res.status(500).json({ error: "Erro ao buscar IDs", details: error.message });
        }

    },

    async getItemsByIds(req, res) {
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');

        try {
            const { ids } = req.body;
            if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: "Envie um array de 'ids'." });

            const idsList = ids.filter(id => id && id.toString().trim() !== "").map(id => String(id).trim());
            if (idsList.length === 0) return res.status(200).json([]);

            const results = await FilterService.getByIds(idsList);
            const serializedResults = results.map(item => CompanyController._serializeItem(item));

            return res.status(200).json(serializedResults);
        } catch (error) {
            console.error("ERRO getItemsByIds:", error);
            return res.status(500).json({ error: "Erro ao buscar detalhes", details: error.message });
        }
    },

    async search(req, res) {
        try {
            const { filters = {}, page = 1, pageSize = 20 } = req.body || {};

            const t0 = Date.now();
            const { items, total, pageCount, hasMore } = await FilterService.searchEstablishments(filters, page, pageSize);
            const t1 = Date.now();

            const serialized = items.map(item => CompanyController._serializeItem(item));
            const t2 = Date.now();

            console.log('[search] sql_ms=', t1 - t0, 'serialize_ms=', t2 - t1, 'rows=', items.length);

            return res.json({ items: serialized, total, pageCount, hasMore });
        } catch (error) {
            console.error("ERRO search:", error);
            return res.status(500).json({ error: "Erro na busca", details: error.message });
        }
    },

    async exportCsv(req, res) {
        try {
            const { filters, selectAll, excludedIds, ids, selection } = req.body;

            // Consolida a lógica de seleção em um único objeto para o Service
            const finalSelection = selection || {
                all: selectAll === true || selectAll === 'true',
                manualIds: ids || [],
                excludedIds: excludedIds || []
            };

            const stream = await FilterService.getCsvStream({
                ...filters,
                selection: finalSelection
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=export.csv');

            // Header
            res.write('CNPJ;NOME FANTASIA;RAZAO SOCIAL;UF;MUNICIPIO;CNAE;EMAIL;TELEFONE 1;TELEFONE 2\n');

            stream.on('data', row => {
                const line = [
                    row.cnpj,
                    row.nome_fantasia || '',
                    row.razao_social || '',
                    row.uf || '',
                    row.municipio || '',
                    row.cnae_fiscal_principal || '',
                    row.correio_eletronico || '',
                    row.telefone1 ? `(${row.ddd1 || ''}) ${row.telefone1}` : '',
                    row.telefone2 ? `(${row.ddd2 || ''}) ${row.telefone2}` : ''
                ].join(';');
                res.write(line + '\n');
            });

            stream.on('end', () => res.end());
            stream.on('error', err => {
                console.error('Export stream error:', err);
                res.status(500).end();
            });
        } catch (error) {
            console.error("ERRO exportCsv:", error);
            return res.status(500).json({ error: "Erro na exportação", details: error.message });
        }
    },

    async debugAttributes(req, res) {
        try {
            const ports = await prisma.$queryRawUnsafe(`
                SELECT porte_empresa, count(*) as total 
                FROM cnpj.empresas 
                GROUP BY porte_empresa 
                ORDER BY total DESC
            `);
            const capitals = await prisma.empresa.findMany({
                select: { capital_social: true },
                take: 15
            });
            return res.json({ ports, capitals });
        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: e.message });
        }
    },

    async getContas(req, res) {
        try {
            const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

            let query = supabase
                .schema('bd_md')
                .from('contas')
                .select('id, conta')
                .order('conta', { ascending: true });

            if (q) {
                query = query.ilike('conta', `%${q}%`);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Supabase getContas error:', error);
                return res.status(500).json({ error: 'Erro ao buscar contas', details: error.message });
            }

            return res.status(200).json(data ?? []);
        } catch (e) {
            console.error('ERRO getContas:', e);
            return res.status(500).json({ error: 'Erro ao buscar contas', details: e.message });
        }
    },


    async getCampaigns(req, res) {
        try {
            const accountId = req.query.account_id;

            const statusRaw = typeof req.query.status === 'string'
                ? req.query.status.trim()
                : '';

            const effectiveStatus = statusRaw
                ? statusRaw.split(',').map(s => s.trim()).filter(Boolean)
                : undefined;

            const campaigns = await FilterService.getCampaigns({
                accountId,
                effectiveStatus,
            });

            return res.status(200).json(campaigns);
        } catch (error) {
            console.error('ERRO getCampaigns:', error);
            return res.status(500).json({
                error: 'Erro ao buscar campanhas',
                details: error.message,
            });
        }
    },
    async createAdset(req, res) {
        try {
            const {
                account_id,
                campaign_id,
                name,
                radius,
                address,
                location // Opcional: { lat, lng }
            } = req.body;

            // 1. Validações da Campanha
            if (!account_id || !campaign_id || !name || !radius) {
                return res.status(400).json({
                    error: "Campos obrigatórios: account_id, campaign_id, name e radius."
                });
            }

            // 2. Validação: precisa ter endereço OU coordenadas
            if (!address && !location) {
                return res.status(400).json({
                    error: "É necessário fornecer 'address' ou 'location' (lat/lng)."
                });
            }

            // Se tiver location, validar formato
            if (location && (!location.lat || !location.lng)) {
                return res.status(400).json({
                    error: "Location deve conter 'lat' e 'lng'."
                });
            }

            // Chama o Service
            const result = await adSetService.createAdset(req.body);

            return res.status(201).json({
                message: "Adset criado com sucesso.",
                data: result
            });

        } catch (error) {
            console.error("Erro no Controller:", error);

            // Erros de Negócio (Geocoding)
            if (error.message === 'ADDRESS_NOT_FOUND') {
                return res.status(404).json({ error: "Endereço não encontrado no mapa." });
            }
            if (error.message === 'LOW_PRECISION') {
                return res.status(422).json({ error: "O endereço é muito vago (abrange uma cidade inteira). Especifique rua ou bairro." });
            }

            // Erros da API do Meta
            if (error.response?.data) {
                return res.status(error.response.status || 500).json({
                    error: "Erro na API do Meta Ads",
                    details: error.response.data
                });
            }

            return res.status(500).json({ error: "Erro interno." });
        }
    },

    async savePublic(req, res) {
        try {
            const { name, description, created_by, address, city, state, cnae, location } = req.body;

            if (!name) {
                return res.status(400).json({ error: "O campo 'name' é obrigatório." });
            }

            const newAudience = await FilterService.createAudienceSegment({
                name,
                description,
                created_by,
                address,
                city,
                state,
                cnae,
                location
            });

            return res.status(201).json({
                message: "Público salvo com sucesso.",
                data: newAudience
            });

        } catch (error) {
            console.error("Erro ao salvar público:", error);
            return res.status(500).json({ error: "Erro interno ao salvar público.", details: error.message });
        }
    },
};

module.exports = CompanyController;