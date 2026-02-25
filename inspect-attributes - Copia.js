const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("--- BUSCANDO VALORES DE PORTE DE EMPRESA ---");
        const portes = await prisma.empresa.findMany({
            distinct: ['porte_empresa'],
            select: { porte_empresa: true },
            where: { porte_empresa: { not: null } }
        });
        console.log("Portes encontrados:");
        console.table(portes);

        console.log("\n--- AMOSTRA DE CAPITAL SOCIAL (Top 20) ---");
        const capitais = await prisma.empresa.findMany({
            select: { capital_social: true },
            where: { capital_social: { not: null, not: '0,00' } },
            take: 20
        });
        console.log("Exemplos de Capital Social:");
        console.table(capitais);

        // Count top formats or ranges for capital social
        const countPortes = await prisma.$queryRaw`
            SELECT porte_empresa, count(*) as total 
            FROM cnpj.empresas 
            GROUP BY porte_empresa 
            ORDER BY total DESC
        `;
        console.log("\n--- CONTAGEM POR PORTE ---");
        console.table(countPortes);

    } catch (e) {
        console.error("Erro:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
