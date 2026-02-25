const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const ext = await prisma.$queryRaw`SELECT * FROM pg_extension WHERE extname = 'pg_trgm'`;
        console.log('Extension check:', ext);
        if (ext.length === 0) {
            console.log('Enabling pg_trgm...');
            await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public`;
            console.log('pg_trgm enabled.');
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
