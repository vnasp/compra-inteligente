// Utilidades compartidas para integrar con Jumbo (VTEX).
// - Búsqueda en jumbo.cl/busqueda (Constructor.io) → candidatos {sku, name, price, image, slug}.
// - Deep link de carrito VTEX (/checkout/cart/add) para llenar el carro de una vez.
//
// El skuId de VTEX es el data-cnstrc-item-id que expone la búsqueda
// (verificado: sku=6697 == "Leche Colun Entera 1 L").

export const JUMBO_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface JumboCandidate {
  sku: string;
  name: string;
  price: number;
  image: string | null;
  slug: string | null;
}

/** Quita tamaños embebidos del texto (ej. "850 g", "1 L") para ampliar la búsqueda. */
export function stripSizeFromText(text: string): string {
  return text
    .replace(/\b\d+[\.,]?\d*\s*(g|kg|ml|l|cc|cl|un\.?|lt)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Construye la lista ordenada de queries para un producto: con marca primero,
 * luego sin marca como fallback. Deduplicada.
 */
export function buildSearchQueries(item: {
  name: string;
  brand?: string | null;
  package_size?: number | null;
  package_unit?: string | null;
}): Array<{ ft: string; bParam: string }> {
  const brand = item.brand ?? "";
  const nameNoBrand = brand
    ? item.name
        .replace(
          new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
          "",
        )
        .replace(/\s+/g, " ")
        .trim()
    : item.name;

  const sizePart =
    item.package_size &&
    !nameNoBrand.toLowerCase().includes(String(item.package_size))
      ? `${item.package_size} ${item.package_unit ?? ""}`.trim()
      : "";

  const ftWithSize = `${nameNoBrand} ${sizePart}`.trim();
  const ftClean = stripSizeFromText(nameNoBrand);
  const brandParam = brand ? `&b=${encodeURIComponent(brand)}` : "";

  const seen = new Set<string>();
  const queries: Array<{ ft: string; bParam: string }> = [];
  for (const ft of [...new Set([ftWithSize, ftClean])].filter(Boolean)) {
    for (const bParam of brandParam ? [brandParam, ""] : [""]) {
      const key = ft + bParam;
      if (!seen.has(key)) {
        seen.add(key);
        queries.push({ ft, bParam });
      }
    }
  }
  return queries;
}

/**
 * Extrae candidatos de productos del HTML de jumbo.cl/busqueda.
 * Orden real de atributos: name → id (sku) → price (todos en el mismo tag).
 * La imagen y el slug del producto vienen poco después.
 */
export function extractCandidates(html: string): JumboCandidate[] {
  const re =
    /data-cnstrc-item-name="([^"]*)"\s+data-cnstrc-item-id="(\d+)"\s+data-cnstrc-item-price="(\d+)"/g;
  const out: JumboCandidate[] = [];
  const seenSku = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const name = decodeEntities(m[1]).trim();
    const sku = m[2];
    const price = parseInt(m[3], 10);
    if (!price || price < 100 || price > 500000) continue;
    if (seenSku.has(sku)) continue;
    seenSku.add(sku);
    // La imagen y el slug del producto vienen poco después en el mismo card.
    const tail = html.slice(
      m.index + m[0].length,
      m.index + m[0].length + 1500,
    );
    const slug = tail.match(/href="(\/[a-z0-9-]+\/p)"/i)?.[1] ?? null;
    const image =
      tail.match(
        /src="(https:\/\/[^"]*(?:vteximg|vtexassets|cencosud)[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
      )?.[1] ?? null;
    out.push({ sku, name, price, image, slug });
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

/**
 * Arma el deep link de carrito de VTEX. Al abrirlo en el navegador con sesión
 * de Jumbo, agrega todos los productos al carro.
 */
export function buildJumboCartUrl(
  rows: Array<{ sku: string; qty: number }>,
): string {
  const parts: string[] = [];
  for (const r of rows) {
    if (!r.sku || r.qty <= 0) continue;
    parts.push(`sku=${encodeURIComponent(r.sku)}&qty=${r.qty}&seller=1&sc=1`);
  }
  return `https://www.jumbo.cl/checkout/cart/add?${parts.join("&")}`;
}
