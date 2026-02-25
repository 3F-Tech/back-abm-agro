const { Client } = require('pg');

async function testConnection() {
    const client = new Client({
        user: 'app_user',
        password: '3FVenture@0233',
        host: '192.168.60.44',
        database: 'db_abm',
        port: 5432,
        connectionTimeoutMillis: 5000,
    });

    try {
        await client.connect();
        console.log(`✅ SUCCESS: Connected as app_user to db_abm`);
        const res = await client.query('SELECT current_user, current_database()');
        console.log('   Info:', res.rows[0]);
        await client.end();
        return true;
    } catch (err) {
        console.log(`❌ FAILED: app_user@192.168.60.44/db_abm - ${err.message}`);
        return false;
    }
}

testConnection();
