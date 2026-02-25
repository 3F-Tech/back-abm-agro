const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Colunas da tabela 'empresas':");
        const empresasCols = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'empresas' AND table_schema = 'cnpj'
    `;
        console.table(empresasCols);

        console.log("\nColunas da tabela 'socios':");
        const sociosCols = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'socios' AND table_schema = 'cnpj'
    `;
        console.table(sociosCols);

    } catch (e) {
        console.error("Erro:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
