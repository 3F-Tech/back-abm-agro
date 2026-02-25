const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("--- BUSCANDO TABELA 'cnae' EM TODOS OS SCHEMAS ---");
        const tables = await prisma.$queryRawUnsafe(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_name ILIKE '%cnae%'
        `);
        console.table(tables);

        if (tables.length > 0) {
            for (const table of tables) {
                console.log(`\n--- AMOSTRA DA TABELA ${table.table_schema}.${table.table_name} ---`);
                try {
                    const sample = await prisma.$queryRawUnsafe(`
                        SELECT * FROM "${table.table_schema}"."${table.table_name}" LIMIT 10
                    `);
                    console.table(sample);
                } catch (e) {
                    console.error(`Erro ao ler ${table.table_name}:`, e.message);
                }
            }
        }
    } catch (e) {
        console.error("Erro na busca:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
