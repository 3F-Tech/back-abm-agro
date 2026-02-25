const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- MAPEANDO TODAS AS TABELAS NO BANCO ABM_BD ---");
    try {
        const tables = await prisma.$queryRawUnsafe(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name
    `);
        console.table(tables);

        // Tentando encontrar algo que pareça com usuário
        const userLikeTables = tables.filter(t => t.table_name.toLowerCase().includes('user') || t.table_name.toLowerCase().includes('usuario'));
        if (userLikeTables.length > 0) {
            console.log("🔍 Possíveis tabelas de login encontradas:", userLikeTables);
        } else {
            console.log("⚠️ Nenhuma tabela com nome 'user' ou 'usuario' encontrada.");
        }

    } catch (e) {
        console.log("❌ Erro ao listar tabelas:", e.message);
    }

    await prisma.$disconnect();
}

main();
