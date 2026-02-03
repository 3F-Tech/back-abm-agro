const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FilterService = require('../services/FilterService');

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
            console.log("🔍 RAIO-X DO BANCO...");

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
};

module.exports = CompanyController;