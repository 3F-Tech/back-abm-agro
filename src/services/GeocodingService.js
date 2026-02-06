const axios = require('axios');

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * Converte Endereço -> Lat/Long usando Google Maps
 */
const getCoordinatesFromAddress = async (addr) => {
    if (!GOOGLE_KEY) {
        throw new Error("ERRO CRÍTICO: GOOGLE_MAPS_API_KEY não configurada.");
    }

    // Monta endereço robusto para área rural
    const numberStr = addr.number ? `${addr.number}` : '';

    const components = [
        addr.street,
        numberStr,
        addr.neighborhood,
        addr.city,
        `${addr.state}, ${addr.country || 'BR'}`
    ].filter(Boolean).join(', ');

    const encodedAddress = encodeURIComponent(components);

    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_KEY}`
        );

        if (response.data.status !== 'OK' || response.data.results.length === 0) {
            throw new Error('ADDRESS_NOT_FOUND');
        }

        const result = response.data.results[0];

        return {
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng,
            formatted_address: result.formatted_address
        };

    } catch (error) {
        if (error.message !== 'ADDRESS_NOT_FOUND') {
            console.error("Erro ao conectar no Google Maps:", error.message);
        }
        throw error;
    }
};

module.exports = {
    getCoordinatesFromAddress
};
