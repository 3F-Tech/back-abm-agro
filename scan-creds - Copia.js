const { Client } = require('pg');

async function test(u, p, d) {
    const client = new Client({ user: u, password: p, host: '192.168.60.44', database: d, port: 5432, connectionTimeoutMillis: 1000 });
    try {
        await client.connect();
        console.log(`✅ ${u}:${p}@${d}`);
        await client.end();
        process.exit(0);
    } catch (e) {
        // console.log(`❌ ${u}:${p}@${d}`);
    }
}

async function run() {
    const users = ['postgres', 'app_user', 'admin', 'lorenzo'];
    const passes = ['3FVenture#0233', '3FVenture@0233', '3FVenture!0233', 'admin', 'root'];
    const dbs = ['postgres', 'db_abm', 'abm_bd', 'db_agro', 'lorenzo'];

    for (const u of users) {
        for (const p of passes) {
            for (const d of dbs) {
                await test(u, p, d);
            }
        }
    }
}
run();
