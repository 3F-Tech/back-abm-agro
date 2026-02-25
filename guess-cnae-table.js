const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Tentando query na tabela cnpj.cnaes...");
        const res = await prisma.$queryRawUnsafe('SELECT * FROM cnpj.cnaes LIMIT 5');
        console.log("Sucesso em cnpj.cnaes:");
        console.table(res);
    } catch (e) {
        console.log("Erro em cnpj.cnaes:", e.message);
        try {
            console.log("Tentando query na tabela cnpj.cnae...");
            const res2 = await prisma.$queryRawUnsafe('SELECT * FROM cnpj.cnae LIMIT 5');
            console.log("Sucesso em cnpj.cnae:");
            console.table(res2);
        } catch (e2) {
            console.log("Erro em cnpj.cnae:", e2.message);
        }
    }
    await prisma.$disconnect();
}
main();
