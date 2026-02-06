const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');

BigInt.prototype.toJSON = function () {
    return this.toString();
};

require('dotenv').config();
const app = express();

app.use(morgan('dev'));
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Back-End ABM Agro is running' });
});

app.use(routes);

const os = require('os');
const PORT = 8021;

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const localIp = getLocalIp();

app.listen(PORT, '0.0.0.0', () => {
    console.log(`➜ Server is running on port ${PORT}`);
    console.log(`➜ Local:            http://localhost:${PORT}`);
    console.log(`➜ On Your Network:  http://${localIp}:${PORT}`);
});
