const { Client } = require('pg');

const client = new Client({
    user: 'app_user',
    host: '192.168.60.44', // Seu IP
    database: 'db_abm',
    password: '3FVenture@0233', // A senha original
    port: 5432,
    connectionTimeoutMillis: 5000,
});

console.log('Tentando conectar...');

client.connect()
    .then(() => {
        console.log('✅ SUCESSO! Conectado ao banco do amigo.');
        return client.query('SELECT NOW()');
    })
    .then((res) => {
        console.log('⏰ Hora no servidor:', res.rows[0].now);
        return client.end();
    })
    .catch((err) => {
        console.error('❌ ERRO DE CONEXÃO:', err.message);
        if (err.message.includes('timeout')) {
            console.log('Dica: Verifique se o Firewall do Windows na máquina 192.168.60.44 está bloqueando a porta 5432.');
        }
        client.end();
    });
