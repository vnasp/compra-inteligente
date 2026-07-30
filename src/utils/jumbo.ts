import type { Unit } from "@/types/shopping";

// Utilidades compartidas para integrar con Supermercado (VTEX).
// - Búsqueda en jumbo.cl/busqueda (Constructor.io) → candidatos {sku, name, price, image, slug}.
// - Deep link de carrito VTEX (/checkout/cart/add) para llenar el carro de una vez.
//
// OJO con los ids que expone la búsqueda (Constructor.io):
//   data-cnstrc-item-id            → productId de VTEX
//   data-cnstrc-item-variation-id  → skuId de VTEX ← el que necesita el carro
// Supermercado agregó el atributo de variación en algún momento de 2026; antes el
// item-id traía directamente el skuId (verificado: "Leche Colun Entera 1 L"
// era item-id=6697, hoy es item-id=6609 + variation-id=6697), así que los
// jumbo_sku guardados con el markup viejo siguen siendo válidos.

// ── Scraping responsable ───────────────────────────────────────────────
// Todo el tráfico hacia Supermercado pasa por `fetchJumboHtml`, que cumple:
//
// 1. **robots.txt** (revisado 2026-07-29): `User-agent: *` permite
//    `/busqueda?ft=…`. Lo prohibido son las facetas (`?map=`, `?PS=`, `sc=`),
//    `*?*?`, `*.pdf`, `/checkout*`, `/mi-carro` y las páginas de cuenta — este
//    módulo nunca las pide. No hay `Crawl-delay` declarado, así que se usa uno
//    conservador propio. Si el archivo cambia, hay que revisar esto de nuevo.
// 2. **UA identificable**: no se suplanta un navegador. Supermercado puede reconocer y
//    bloquear este cliente si quiere (probado: responde igual con UA honesto).
//    Define `SCRAPER_CONTACT` en el entorno para publicar un contacto real.
// 3. **Una request a la vez**, con ~1 s de separación más jitter, contador
//    compartido por todo el proceso (búsqueda interactiva incluida). Nunca en
//    paralelo.
// 4. **Backoff, no insistencia**: ante 429/503 se lanza `JumboRateLimitError`,
//    se corta la corrida y se respeta `Retry-After`. Cero reintentos en loop.
// 5. **Volumen mínimo**: solo a pedido explícito del usuario (botón), en tandas,
//    saltando los precios ya frescos (ver `FRESH_PRICE_HOURS` en page.tsx) y con
//    búsqueda por sku (1 request por producto en vez de 2). No hay crawling
//    programado ni recorrido de catálogo.
//
// El deep link del carro (`/checkout/cart/add`) sí está en robots.txt, pero no
// se pide desde el servidor: se abre en el navegador del usuario, con su sesión.

const SCRAPER_CONTACT = process.env.SCRAPER_CONTACT ?? "uso personal";

export const JUMBO_UA = `Mozilla/5.0 (compatible; SmartPantryBot/1.0; +${SCRAPER_CONTACT})`;

/** Separación mínima entre requests a Supermercado (más jitter) */
const MIN_INTERVAL_MS = 1000;
const JITTER_MS = 400;

/** Error de rate limit: corta la corrida y dice cuánto esperar. */
export class JumboRateLimitError extends Error {
  readonly retryAfterMs: number;
  constructor(status: number, retryAfterMs: number) {
    super(`Supermercado respondió ${status}; reintentar en ${retryAfterMs} ms`);
    this.name = "JumboRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

let lastRequestAt = 0;
// Cookies sticky AWSALB del balanceador: reusarlas evita repartir la carga entre
// nodos y es lo que haría un cliente normal.
let cookieJar = "";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Única puerta de salida hacia jumbo.cl. Serializa y espacia las requests,
 * mantiene las cookies de sesión y corta ante rate limiting.
 * Devuelve null si la respuesta no es OK (ej. 404).
 */
export async function fetchJumboHtml(url: string): Promise<string | null> {
  const gap = MIN_INTERVAL_MS + Math.random() * JITTER_MS;
  const wait = lastRequestAt + gap - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  const headers: Record<string, string> = {
    "User-Agent": JUMBO_UA,
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "es-CL,es;q=0.9",
  };
  if (cookieJar) headers["Cookie"] = cookieJar;

  const res = await fetch(url, { cache: "no-store", headers });

  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const awsalb = setCookie.match(/AWSALB=[^;]+/)?.[0];
    const awsalbcors = setCookie.match(/AWSALBCORS=[^;]+/)?.[0];
    if (awsalb || awsalbcors) {
      cookieJar = [awsalb, awsalbcors].filter(Boolean).join("; ");
    }
  }

  // 429 (rate limit) y 503 (sobrecarga) son "para, estás molestando".
  if (res.status === 429 || res.status === 503) {
    const retryAfter = parseInt(res.headers.get("retry-after") ?? "", 10);
    throw new JumboRateLimitError(
      res.status,
      Number.isFinite(retryAfter) ? retryAfter * 1000 : 60_000,
    );
  }

  if (!res.ok) return null;
  return res.text();
}

export interface JumboCandidate {
  /** skuId de VTEX (variación) — es el id que acepta el carro */
  sku: string;
  /** productId de VTEX; sirve para reconocer skus guardados por error */
  productId: string | null;
  name: string;
  price: number;
  image: string | null;
  slug: string | null;
}

const UNIT_ALIASES: Record<string, Unit> = {
  g: "g",
  gr: "g",
  grs: "g",
  kg: "kg",
  k: "kg",
  ml: "ml",
  cc: "ml",
  l: "L",
  lt: "L",
  lts: "L",
  litro: "L",
  litros: "L",
  un: "un",
  u: "un",
  unid: "un",
  unidad: "un",
  unidades: "un",
};

/**
 * Extrae el tamaño de envase desde el nombre de un producto de Supermercado
 * (ej. "Leche Colun Entera 1 L" → { size: 1, unit: "L" }). Devuelve null si no
 * hay un patrón claro. Best-effort: solo para mostrar la etiqueta de cantidad,
 * el precio siempre es el del envase completo.
 */
export function parseSizeFromName(
  name: string,
): { size: number; unit: Unit } | null {
  const re =
    /(\d+(?:[.,]\d+)?)\s*(kg|grs?|g|ml|cc|lts?|litros?|litro|l|unidades?|unidad|unid|un|u)\b/gi;
  let m: RegExpExecArray | null;
  let last: { value: string; unit: string } | null = null;
  while ((m = re.exec(name)) !== null) {
    last = { value: m[1], unit: m[2].toLowerCase() };
  }
  if (!last) return null;
  const unit = UNIT_ALIASES[last.unit];
  if (!unit) return null;
  const size = parseFloat(last.value.replace(",", "."));
  if (!Number.isFinite(size) || size <= 0) return null;
  return { size, unit };
}

/** Quita tamaños embebidos del texto (ej. "850 g", "1 L") para ampliar la búsqueda. */
export function stripSizeFromText(text: string): string {
  return text
    .replace(/\b\d+[\.,]?\d*\s*(g|kg|ml|l|cc|cl|un\.?|lt)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Construye la lista ordenada de queries para un producto: primero el nombre
 * con tamaño, luego sin tamaño como fallback. Deduplicada. El nombre ya
 * incluye la marca (viene del producto de Supermercado).
 */
export function buildSearchQueries(item: {
  name: string;
  package_size?: number | null;
  package_unit?: string | null;
}): string[] {
  const sizePart =
    item.package_size &&
    !item.name.toLowerCase().includes(String(item.package_size))
      ? `${item.package_size} ${item.package_unit ?? ""}`.trim()
      : "";

  const ftWithSize = `${item.name} ${sizePart}`.trim();
  const ftClean = stripSizeFromText(item.name);

  return [...new Set([ftWithSize, ftClean])].filter(Boolean);
}

/** URL de búsqueda de jumbo.cl. `ft` puede ser texto libre o un sku/productId. */
export function buildSearchUrl(ft: string): string {
  return `https://www.jumbo.cl/busqueda?ft=${encodeURIComponent(ft)}`;
}

/**
 * Extrae candidatos de productos del HTML de jumbo.cl/busqueda.
 * Los atributos `data-cnstrc-item-*` viven todos en el mismo tag, pero Supermercado
 * cambia su orden y agrega nuevos con el tiempo: se ancla en el tag que
 * contiene el nombre y se leen los atributos ahí, sin exigir adyacencia (una
 * regex rígida fue lo que rompió el scraping cuando apareció variation-id).
 * La imagen y el slug del producto vienen poco después.
 */
export function extractCandidates(html: string): JumboCandidate[] {
  const nameRe = /data-cnstrc-item-name="([^"]*)"/g;
  const out: JumboCandidate[] = [];
  const seenSku = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = nameRe.exec(html)) !== null) {
    const name = decodeEntities(m[1]).trim();

    // Tag completo que contiene el atributo del nombre.
    const tagStart = html.lastIndexOf("<", m.index);
    const tagEnd = html.indexOf(">", m.index + m[0].length);
    if (tagStart === -1 || tagEnd === -1) continue;
    const tag = html.slice(tagStart, tagEnd);

    const productId = tag.match(/data-cnstrc-item-id="(\d+)"/)?.[1] ?? null;
    const variationId =
      tag.match(/data-cnstrc-item-variation-id="(\d+)"/)?.[1] ?? null;
    // El carro necesita el skuId (variación); si no viene, cae al item-id
    // (markup antiguo, donde ese atributo ya era el sku).
    const sku = variationId ?? productId;
    const price = parseInt(
      tag.match(/data-cnstrc-item-price="(\d+)"/)?.[1] ?? "",
      10,
    );

    if (!sku || !name) continue;
    if (!price || price < 100 || price > 500000) continue;
    if (seenSku.has(sku)) continue;
    seenSku.add(sku);
    // La imagen y el slug del producto vienen después, dentro del mismo card:
    // el slug a ~800 chars y la imagen a ~1450. La ventana es de 3000 porque
    // con 1500 la URL de la imagen quedaba cortada a la mitad; los cards están
    // a ~4400 chars entre sí, así que no se mezcla con el siguiente.
    const tail = html.slice(
      m.index + m[0].length,
      m.index + m[0].length + 3000,
    );
    const slug = tail.match(/href="(\/[a-z0-9-]+\/p)"/i)?.[1] ?? null;
    const image =
      tail.match(
        /src="(https:\/\/[^"]*(?:vteximg|vtexassets|cencosud)[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
      )?.[1] ?? null;
    out.push({ sku, productId, name, price, image, slug });
  }
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// ── Llenar el carro online ─────────────────────────────────────────────
// El deep link de VTEX (`/checkout/cart/add?sku=…`) **está muerto**: jumbo.cl
// dejó el checkout de VTEX y su carro vive ahora en un BFF de Cencosud. La ruta
// legacy devuelve 404 con uno o con setenta skus (sin sesión redirige a
// `?openLogin=1`, lo que engaña: solo significa que la ruta pide login). Tampoco
// sirven `jumbocl.myvtex.com` (otro dominio, otro carro) ni llamar al BFF desde
// aquí: responde `Access-Control-Allow-Origin: https://www.jumbo.cl`, o sea que
// solo acepta llamadas hechas desde la propia pestaña de Jumbo.
//
// Lo verificado contra el BFF (2026-07-30):
//   PATCH https://be-reg-groceries-bff-jumbo.ecomm.cencosud.com/cart/items
//   headers: Content-Type, apiKey, Authorization (Bearer, vive ~1 h),
//            x-client-platform, x-client-version, x-trace-id
//   body:    {"items":[{"skuId":"…","quantity":1}],"store":"jumboclj512"}
//   → 200. El payload mínimo basta: `skuId` + `quantity`, sin metadata.
//
// El token no está en localStorage ni en cookies (lo mantienen en memoria), así
// que no se puede "buscar": el snippet intercepta la propia request del sitio y
// reutiliza sus headers. Por eso esto es un snippet que la usuaria pega en la
// consola de jumbo.cl y no algo que corra en esta app. **El token nunca sale de
// esa pestaña**: aquí solo se generan skus y cantidades.

const CART_BFF = "be-reg-groceries-bff-jumbo.ecomm.cencosud.com";
/** Productos por request al BFF */
const CART_CHUNK = 10;
/** Pausa entre tandas, para no golpear el BFF */
const CART_CHUNK_PAUSE_MS = 400;
/**
 * Tienda del carro. El id depende de la zona **y del modo de entrega** (se vio
 * `jumboclj512` en un carro de despacho y `jumboclj506` en un pedido de retiro);
 * queda fijo en el de la zona de la usuaria. Si el BFF llegara a rechazarlo, el
 * valor bueno sale del body de cualquier `PATCH /cart/items` del propio sitio.
 */
const CART_STORE = "jumboclj506";
/**
 * Key de localStorage donde el sitio guarda el JWT que manda como Bearer.
 * Ojo: hay varios JWT en storage y los otros **no** sirven (dan 401), así que
 * hay que leer exactamente este.
 */
const CART_TOKEN_KEY = "sessionDataToken";
/**
 * Constantes del cliente web, copiadas de sus requests. Si las rotan, el
 * snippet cae solo al modo captura y las toma de la request real.
 */
const CART_API_KEY = "be-reg-groceries-jumbo-cart-rhk68rqi0adn";
const CART_CLIENT_VERSION = "1.2.14";

/** Nombre sugerido para el marcador */
export const CART_BOOKMARK_NAME = "🛒 Llenar carro";

/**
 * Bookmarklet que llena el carro del supermercado. Se guarda **una vez** como
 * URL de un marcador y se ejecuta con un click estando en su sitio, sin abrir
 * la consola. Ver el bloque de arriba para por qué esto no puede correr dentro
 * de la app.
 *
 * La lista no va incrustada: la pide a `/api/cart-list` (la última guardada al
 * abrir el modal del carro), así que el marcador no hay que rehacerlo nunca
 * salvo que cambie el dominio de la app.
 *
 * Camino normal: lee el token de localStorage y manda la lista en tandas, sin
 * intervención. Si el BFF responde 401/403 (apiKey o versión de cliente
 * rotadas), instala un interceptor, pide interactuar con el carro una vez,
 * toma prestados los headers reales y reintenta la tanda que falló.
 *
 * `appOrigin` debe ser **https** — desde el sitio del supermercado, que es
 * https, el navegador bloquea pedir a `http://` por contenido mixto. O sea que
 * esto sirve con la app desplegada, no en localhost.
 *
 * El resultado se muestra con `alert` porque el valor de retorno se descarta, y
 * `void` evita que el navegador intente navegar a él.
 */
export function buildCartBookmarklet(
  appOrigin: string,
  token?: string,
): string {
  const url = `${appOrigin.replace(/\/$/, "")}/api/cart-list${token ? `?k=${encodeURIComponent(token)}` : ""}`;
  const code = `void((async()=>{try{alert(await ${cartIIFE(url)})}catch(e){alert("Compra Inteligente · error: "+e.message)}})());`;
  return `javascript:${encodeURIComponent(code)}`;
}

/** IIFE que pide la lista, la manda al BFF y devuelve el resumen como string. */
function cartIIFE(listUrl: string): string {
  const loadItems = `await (async () => {
    const r = await fetch("${listUrl}", { cache: "no-store" });
    if (!r.ok) {
      // El endpoint explica la causa (ej. falta la migración); mostrarla.
      const detalle = await r.json().then((d) => d.error).catch(() => null);
      throw new Error(detalle || "no se pudo leer la lista (" + r.status + ")");
    }
    const d = await r.json();
    if (!d.items || !d.items.length) throw new Error("la lista está vacía: genera la lista óptima en la app");
    return d.items;
  })()`;

  return `(async () => {
  const ITEMS = ${loadItems};
  const STORE = "${CART_STORE}";
  const URL = "https://${CART_BFF}/cart/items";
  const BASE = { "Content-Type": "application/json", apiKey: "${CART_API_KEY}", "x-client-platform": "web", "x-client-version": "${CART_CLIENT_VERSION}" };

  // ── Camino normal: el token está en localStorage ──────────────────────
  const readToken = () => {
    let v = localStorage.getItem("${CART_TOKEN_KEY}");
    if (!v) return null;
    try { const p = JSON.parse(v); v = typeof p === "string" ? p : (p.token || p.accessToken || p.access_token || v); } catch {}
    return typeof v === "string" ? v.replace(/^Bearer\\s+/i, "").trim() : null;
  };

  // ── Respaldo: tomar los headers de una request real del sitio ─────────
  const h2o = (h) => !h ? {} : (typeof Headers !== "undefined" && h instanceof Headers) ? Object.fromEntries(h.entries()) : Array.isArray(h) ? Object.fromEntries(h) : { ...h };
  const captureHeaders = async () => {
    const isBff = (u) => typeof u === "string" && u.includes("${CART_BFF}");
    let cap = null;
    const record = (h) => { if (h && (h.Authorization || h.authorization)) cap = h; };
    const of = window.fetch;
    window.fetch = function (input, init) {
      try { const u = typeof input === "string" ? input : input?.url; if (isBff(u)) record({ ...h2o(input?.headers), ...h2o(init?.headers) }); } catch {}
      return of.apply(this, arguments);
    };
    const oo = XMLHttpRequest.prototype.open, sh = XMLHttpRequest.prototype.setRequestHeader, sn = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__u = u; this.__h = {}; return oo.apply(this, arguments); };
    XMLHttpRequest.prototype.setRequestHeader = function (k, v) { if (this.__h) this.__h[k] = v; return sh.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function (b) { if (isBff(this.__u)) record(this.__h); return sn.apply(this, arguments); };

    console.log("%cCompra Inteligente", "font-weight:bold", "· la sesión guardada no sirvió: abre el carro o agrega un producto a mano…");
    for (let i = 0; i < 90 && !cap; i++) await new Promise((r) => setTimeout(r, 1000));

    window.fetch = of;
    XMLHttpRequest.prototype.open = oo;
    XMLHttpRequest.prototype.setRequestHeader = sh;
    XMLHttpRequest.prototype.send = sn;
    if (!cap) return null;
    const h = { ...cap };
    delete h["content-length"]; delete h["Content-Length"];
    h["Content-Type"] = h["Content-Type"] || "application/json";
    return h;
  };

  const token = readToken();
  let headers = token ? { ...BASE, Authorization: \`Bearer \${token}\` } : await captureHeaders();
  if (!headers) return "No se pudo obtener la sesión. Recarga la página y reintenta.";

  const post = (chunk) => fetch(URL, {
    method: "PATCH",
    credentials: "include",
    headers: { ...headers, "x-trace-id": crypto.randomUUID() },
    body: JSON.stringify({ items: chunk, store: STORE }),
  });

  let ok = 0, reauthed = false;
  const fails = [];
  for (let i = 0; i < ITEMS.length; i += ${CART_CHUNK}) {
    const chunk = ITEMS.slice(i, i + ${CART_CHUNK});
    let res = await post(chunk);

    // Un solo reintento con headers prestados si la sesión guardada no sirve.
    if ((res.status === 401 || res.status === 403) && !reauthed) {
      reauthed = true;
      const borrowed = await captureHeaders();
      if (borrowed) { headers = borrowed; res = await post(chunk); }
    }

    if (res.ok) ok += chunk.length;
    else fails.push(\`\${res.status}: \${(await res.text()).slice(0, 120)}\`);
    console.log(\`tanda \${Math.floor(i / ${CART_CHUNK}) + 1}: \${res.status} · \${ok}/\${ITEMS.length}\`);
    await new Promise((r) => setTimeout(r, ${CART_CHUNK_PAUSE_MS}));
  }
  return \`\${ok} de \${ITEMS.length} productos agregados\` + (fails.length ? \` · errores: \${fails.join(" | ")}\` : "") + " · actualiza la página y luego revisa tu carro";
})()`;
}
