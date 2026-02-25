const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("--- BUSCANDO TABELAS DE CNAE EM TODOS OS SCHEMAS ---");
        const tables = await prisma.$queryRaw`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_name ILIKE '%cnae%'
        `;
        console.table(tables);
    } catch (e) {
        console.error("Erro:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
