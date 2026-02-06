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

    async getCnaes(req, res) {
        try {
            const list = await FilterService.getCrias();
            return res.status(200).json(list);
        } catch (error) {
            console.error("Erro ao listar tipos de Cria:", error);
            return res.status(500).json({ error: "Erro ao buscar dados." });
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
                name: typeof filters.name === "string" ? filters.name : (filters.name ? String(filters.name) : "")
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

            const cleanArr = (arr) => arr.map(x => (typeof x === "string" ? x.trim() : x)).filter(x => x);
            filters.cnae = cleanArr(filters.cnae);
            filters.cria = cleanArr(filters.cria);
            filters.city = cleanArr(filters.city);
            filters.state = cleanArr(filters.state);
            filters.cnpj = cleanArr(filters.cnpj);

            console.log("[Controller] Filtros processados:", JSON.stringify(filters));

            const results = await FilterService.getAllIds(filters);
            return res.status(200).json(results);

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

            if (!ids || !Array.isArray(ids)) {
                return res.status(400).json({ error: "Envie um array de 'ids'." });
            }

            const idsList = ids
                .filter(id => id && id.toString().trim() !== "")
                .map(id => BigInt(id));

            if (idsList.length === 0) return res.status(200).json([]);

            const results = await FilterService.getByIds(idsList);

            const serializedResults = results.map(item => ({
                ...item,
                id: item.id.toString()
            }));

            return res.status(200).json(serializedResults);

        } catch (error) {
            console.error("ERRO getItemsByIds:", error);
            return res.status(500).json({ error: "Erro ao buscar detalhes", details: error.message });
        }
    },

    async debugCnaes(req, res) {
        try {

            const amostra = await prisma.clientes.findMany({
                where: {
                    OR: [
                        { segmento1: { not: null, not: '' } },
                        { cria: { not: null, not: '' } }
                    ]
                },
                select: {
                    id: true,
                    a1Nome: true,
                    segmento1: true,
                    cria: true
                },
                take: 20
            });

            return res.json({
                total_encontrados: amostra.length,
                dados: amostra
            });

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