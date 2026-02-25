const { Client } = require('pg');

async function check() {
    const configs = [
        { u: 'postgres', p: '3FVenture#0233', d: 'postgres' },
        { u: 'postgres', p: '3FVenture#0233', d: 'db_abm' },
        { u: 'postgres', p: '3FVenture@0233', d: 'postgres' },
        { u: 'postgres', p: '3FVenture@0233', d: 'db_abm' },
        { u: 'app_user', p: '3FVenture#0233', d: 'db_abm' },
        { u: 'app_user', p: '3FVenture@0233', d: 'db_abm' },
    ];

    for (const c of configs) {
        const client = new Client({
            user: c.u,
            password: c.p,
            host: '192.168.60.44',
            database: c.d,
            port: 5432,
            connectionTimeoutMillis: 2000
        });
        try {
            await client.connect();
            console.log(`✅ OK: ${c.u} / ${c.p} / ${c.d}`);
            await client.end();
        } catch (e) {
            console.log(`❌ FAIL: ${c.u} / ${c.p} / ${c.d} -> ${e.message}`);
        }
    }
}
check();
