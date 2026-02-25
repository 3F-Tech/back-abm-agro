const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const sample = await prisma.estabelecimento.findMany({
        take: 5,
        select: {
            cnpj_basico: true,
            cnpj_ordem: true,
            cnpj_dv: true
        }
    });
    console.log('Sample IDs:', sample);
    console.log('Sample lengths:', sample.map(s => ({
        basico: s.cnpj_basico.length,
        ordem: s.cnpj_ordem.length,
        dv: s.cnpj_dv.length,
        total: s.cnpj_basico.length + s.cnpj_ordem.length + s.cnpj_dv.length
    })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
