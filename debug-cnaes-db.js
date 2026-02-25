const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- DEBUG: VERIFICANDO TABELA DE CNAES NO SCHEMA 'cnpj' ---");
    try {
        // 1. Verificar se a tabela existe
        const tables = await prisma.$queryRawUnsafe(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'cnpj' AND table_name LIKE '%cnae%'
        `);
        console.log("Tabelas encontradas no schema 'cnpj':");
        console.table(tables);

        if (tables.length === 0) {
            console.log("❌ Nenhuma tabela de CNAE encontrada no schema 'cnpj'.");
        } else {
            const tableName = tables[0].table_name;
            console.log(`\n--- TENTANDO LER TABELA: cnpj.${tableName} ---`);

            // 2. Tentar ler os dados
            const data = await prisma.$queryRawUnsafe(`SELECT * FROM "cnpj"."${tableName}" LIMIT 5`);
            console.log("Dados encontrados:");
            console.table(data);
        }

    } catch (e) {
        console.error("❌ ERRO NO DEBUG:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
