const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- BUSCANDO TABELA DE USUÁRIOS EM TODOS OS SCHEMAS ---");
    try {
        const results = await prisma.$queryRawUnsafe(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name ILIKE 'user%' OR table_name ILIKE 'usuario%'
    `);

        if (results.length > 0) {
            console.log("✅ Encontrei estas tabelas:");
            console.table(results);

            for (const row of results) {
                try {
                    const countResult = await prisma.$queryRawUnsafe(`SELECT count(*) as total FROM "${row.table_schema}"."${row.table_name}"`);
                    console.log(`📊 Tabela "${row.table_schema}"."${row.table_name}" tem ${countResult[0].total} registros.`);

                    if (parseInt(countResult[0].total) > 0) {
                        const data = await prisma.$queryRawUnsafe(`SELECT * FROM "${row.table_schema}"."${row.table_name}" LIMIT 5`);
                        console.log("📝 Amostra de dados (primeiros 5):");
                        console.table(data);
                    }
                } catch (e) {
                    console.log(`❌ Erro ao ler tabela ${row.table_name}:`, e.message);
                }
            }
        } else {
            console.log("⚠️ Nenhuma tabela de usuários encontrada em nenhum schema.");
        }

    } catch (e) {
        console.log("❌ Erro na busca:", e.message);
    }
    await prisma.$disconnect();
}

main();
