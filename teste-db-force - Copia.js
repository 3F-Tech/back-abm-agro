const net = require('net');
const { Client } = require('pg');

const HOST = '192.168.60.44';
const PORT = 5432;

console.log(`\n--- TESTE 1: Conexão TCP Direta (net.Socket) ---`);
console.log(`Tentando conectar em ${HOST}:${PORT}...`);

const socket = new net.Socket();
socket.setTimeout(3000);

socket.on('connect', () => {
    console.log('✅ SUCESSO TCP! O Node.js consegue ver o servidor.');
    socket.end();
    testPg(); // Se TCP funcionar, testa o driver PG
});

socket.on('timeout', () => {
    console.log('❌ TIMEOUT TCP. O servidor não respondeu.');
    socket.destroy();
});

socket.on('error', (err) => {
    console.error(`❌ ERRO TCP: ${err.message} (${err.code})`);
    if (err.code === 'EHOSTUNREACH') {
        console.log("   -> O Node não está encontrando uma rota para o IP. Verifique VPN/Firewall.");
    }
});

socket.connect(PORT, HOST);


function testPg() {
    console.log(`\n--- TESTE 2: Driver Postgres (pg) ---`);
    const client = new Client({
        user: 'postgres',
        host: HOST,
        database: 'postgres',
        password: '3FVenture#0233',
        port: PORT,
        connectionTimeoutMillis: 3000,
    });

    client.connect()
        .then(() => {
            console.log('✅ SUCESSO PG! Conectado e autenticado.');
            return client.end();
        })
        .catch(err => {
            console.error('❌ ERRO PG:', err.message);
            client.end();
        });
}
