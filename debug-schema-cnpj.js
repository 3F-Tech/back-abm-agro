const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Checando tabelas no schema 'cnpj'...");
        const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'cnpj'
    `;
        console.table(tables);
    } catch (e) {
        console.error("Erro:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
