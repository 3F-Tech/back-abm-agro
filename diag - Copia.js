const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

function serialize(obj) {
    return JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2
    );
}

async function run() {
    try {
        const complexSql = `
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT e.cnpj_basico 
      FROM "cnpj"."estabelecimentos" e 
      INNER JOIN "cnpj"."empresas" emp ON e.cnpj_basico = emp.cnpj_basico 
      WHERE e.uf = 'RS' 
        AND e.municipio = '8801'
        AND e.cnae_fiscal_principal = '4711302'
      LIMIT 20
    `;
        console.log('Running complex query...');
        const start = Date.now();
        const explain = await prisma.$queryRawUnsafe(complexSql);
        const end = Date.now();

        fs.writeFileSync('diag_explain_complex.json', serialize(explain));
        fs.writeFileSync('diag_time.txt', `Time: ${end - start}ms`);
        console.log('Results written.');

    } catch (e) {
        console.error(e);
        fs.writeFileSync('diag_error.txt', e.stack || e.message);
    } finally {
        await prisma.$disconnect();
    }
}

run();
