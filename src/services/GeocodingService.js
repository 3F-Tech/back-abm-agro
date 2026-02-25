module.exports = {
    async getCoordinatesFromAddress(address) {
        console.log(`[Mock Geocoding] Returning default coordinates for: ${address}`);
        return { lat: -23.5505, lng: -46.6333 }; // Sao Paulo default
    }
};
