const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Checando schemas...");
        const schemas = await prisma.$queryRaw`
      SELECT schema_name 
      FROM information_schema.schemata
    `;
        console.table(schemas);

        console.log("\nColunas da tabela 'empresas_stg':");
        // Inspect columns of empresas_stg
        const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'empresas_stg'
    `;
        console.table(columns);

    } catch (e) {
        console.error("Erro:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
