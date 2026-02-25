const { Client } = require('pg');

async function testConnection(user, password, host, database, port) {
    const client = new Client({
        user,
        password,
        host,
        database,
        port: parseInt(port),
        connectionTimeoutMillis: 5000,
    });

    try {
        await client.connect();
        console.log(`✅ SUCCESS: Connected as ${user} to ${database} on ${host}`);
        const res = await client.query('SELECT current_user, current_database()');
        console.log('   Info:', res.rows[0]);
        await client.end();
        return true;
    } catch (err) {
        console.log(`❌ FAILED: ${user}@${host}/${database} - ${err.message}`);
        return false;
    }
}

async function runTests() {
    console.log("--- Testing Connection Variations ---");

    // Test 1: postgres with #
    await testConnection('postgres', '3FVenture#0233', '192.168.60.44', 'postgres', 5432);

    // Test 2: app_user with @
    await testConnection('app_user', '3FVenture@0233', '192.168.60.44', 'db_abm', 5432);

    // Test 3: postgres with @
    await testConnection('postgres', '3FVenture@0233', '192.168.60.44', 'postgres', 5432);

    // Test 4: app_user with #
    await testConnection('app_user', '3FVenture#0233', '192.168.60.44', 'db_abm', 5432);
}

runTests();
