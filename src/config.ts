// Configuración operativa de integraciones y precios.
// Mantén estos valores centralizados para que la UI, el cliente y los routes
// usen las mismas reglas.

// No se vuelve a pedir un precio scrapeado hace menos de esto.
export const PRICE_FRESH_HOURS = 1;

// El cliente manda scraping en tandas y el route valida el mismo máximo.
export const PRICE_SCRAPE_MAX_ITEMS_PER_REQUEST = 15;
export const PRICE_SCRAPE_BATCH_SIZE = PRICE_SCRAPE_MAX_ITEMS_PER_REQUEST;

// Pausa entre tandas, además del espaciado por request de Jumbo.
export const PRICE_SCRAPE_BATCH_PAUSE_MS = 10_000;

// Resultados máximos devueltos por la búsqueda manual de productos.
export const JUMBO_SEARCH_MAX_RESULTS = 12;

// Pacing compartido para requests hacia Jumbo.
export const JUMBO_REQUEST_MIN_INTERVAL_MS = 1000;
export const JUMBO_REQUEST_JITTER_MS = 400;

// Tandas del bookmarklet que llena el carro en Jumbo.
export const JUMBO_CART_CHUNK_SIZE = 10;
export const JUMBO_CART_CHUNK_PAUSE_MS = 400;
