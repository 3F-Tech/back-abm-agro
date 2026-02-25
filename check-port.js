const net = require('net');
const host = '192.168.60.3';
const port = 5432;

const socket = new net.Socket();
socket.setTimeout(2000);

socket.on('connect', () => {
    console.log(`✅ Port ${port} is OPEN on ${host}`);
    socket.destroy();
});

socket.on('timeout', () => {
    console.log(`❌ Port ${port} is CLOSED (Timeout) on ${host}`);
    socket.destroy();
});

socket.on('error', (err) => {
    console.log(`❌ Port ${port} is CLOSED (${err.message}) on ${host}`);
});

socket.connect(port, host);
