const { Client } = require('pg');

// Force using the values provided, ignoring .env for a clean test
const config = {
    user: 'postgres',
    host: '192.168.60.44',
    database: 'postgres',
    password: '3FVenture#0233',
    port: 5432,
    connectionTimeoutMillis: 5000,
};

const client = new Client(config);

async function test() {
    console.log("-----------------------------------------");
    console.log(`🔌 Testing connection to ${config.host}:${config.port} (User: ${config.user})`);
    console.log("-----------------------------------------");

    try {
        const start = Date.now();
        await client.connect();
        const duration = Date.now() - start;

        console.log(`✅ CONNECTED successfully in ${duration}ms!`);

        const res = await client.query('SELECT NOW(), current_database()');
        console.log("📊 Query Record:", res.rows[0]);

        // Check tables in public schema
        const tables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' OR table_schema = 'cnpj'
        LIMIT 5;
    `);
        console.log("📂 Found tables:", tables.rows.map(r => r.table_name));

        await client.end();
    } catch (err) {
        console.error("❌ FAILED:", err.message);
        if (err.code) console.error("   Code:", err.code);
        if (err.address) console.error("   Address:", err.address);
    }
}

test();
