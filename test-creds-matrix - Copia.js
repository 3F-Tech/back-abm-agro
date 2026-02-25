const { Client } = require('pg');

async function test(u, p, h, d) {
    const client = new Client({ user: u, password: p, host: h, database: d, port: 5432, connectionTimeoutMillis: 2000 });
    try {
        await client.connect();
        console.log(`PASS: ${u}:${p}@${h}/${d}`);
        await client.end();
        return true;
    } catch (e) {
        // console.log(`FAIL: ${u}:${p}@${h}/${d} - ${e.message}`);
        return false;
    }
}

async function run() {
    const ips = ['192.168.60.44'];
    const users = ['postgres', 'app_user'];
    const passes = ['3FVenture#0233', '3FVenture@0233'];
    const dbs = ['postgres', 'db_abm'];

    for (const h of ips) {
        for (const u of users) {
            for (const p of passes) {
                for (const d of dbs) {
                    await test(u, p, h, d);
                }
            }
        }
    }
}
run();
