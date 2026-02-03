const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');

BigInt.prototype.toJSON = function () {
    return this.toString();
};


const app = express();

app.use(morgan('dev'));
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(morgan('dev'));

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use(routes);

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`➜ Server is running on port ${PORT}`);
    console.log(`➜ Local:            http://localhost:${PORT}`);
    console.log(`➜ On Your Network:  http://0.0.0.0:${PORT}`);
});