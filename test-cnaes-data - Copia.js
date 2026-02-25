const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("--- TESTANDO SELECT NA TABELA cnpj.cnaes ---");
        const count = await prisma.$queryRaw`SELECT count(*) FROM cnpj.cnaes`;
        console.log("Total de registros:", count);

        const sample = await prisma.$queryRaw`SELECT * FROM cnpj.cnaes LIMIT 5`;
        console.log("Amostra de dados:");
        console.table(sample);
    } catch (e) {
        console.error("Erro ao ler cnpj.cnaes:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
