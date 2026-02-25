const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- LISTANDO TODOS OS BANCOS DE DADOS NO SERVIDOR ---");
    try {
        const databases = await prisma.$queryRawUnsafe("SELECT datname FROM pg_database WHERE datistemplate = false");
        console.table(databases);
    } catch (e) {
        console.log("❌ Erro ao listar bancos:", e.message);
    }
    await prisma.$disconnect();
}

main();
