const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Creating GIN Trigram index on razao_social...');
        await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_razao_social_trgm 
      ON "cnpj"."empresas" USING gin (razao_social gin_trgm_ops);
    `);
        console.log('Index created/verified.');

        console.log('Creating GIN Trigram index on nome_fantasia...');
        await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_nome_fantasia_trgm 
      ON "cnpj"."estabelecimentos" USING gin (nome_fantasia gin_trgm_ops);
    `);
        console.log('Index created/verified.');

    } catch (e) {
        console.error('Error creating indexes:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
