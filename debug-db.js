const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Conectando ao banco de dados...");

        // Query to list tables in Postgres
        const result = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;

        console.log("Tabelas encontradas no schema public:");
        console.table(result);

        // Check specific table
        const check = await prisma.$queryRaw`
      SELECT count(*) as count FROM "estabelecimentos"
    `;
        console.log("Contagem na tabela 'estabelecimentos':", check);

    } catch (e) {
        console.error("Erro ao verificar banco de dados:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
