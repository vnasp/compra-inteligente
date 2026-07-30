import { NextRequest, NextResponse } from "next/server";
import {
  buildSearchQueries,
  buildSearchUrl,
  extractCandidates,
  fetchJumboHtml,
  JumboRateLimitError,
} from "@/utils/jumbo";

interface ScrapeItem {
  id: string;
  name: string;
  package_size: number | null;
  package_unit: string | null;
  jumbo_sku?: string | null;
}

interface PriceResult {
  id: string;
  price: number | null;
  /** "sku" = match exacto por skuId; "name" = match difuso por nombre */
  matchedBy: "sku" | "name" | null;
  source: string;
}

// Tope por request: el cliente envía en tandas (ver handleScrape en page.tsx).
// El pacing (≈1 request/s) lo aplica fetchJumboHtml, no este route.
const MAX_ITEMS = 15;

// Medido: ~1,2 s por producto vía sku (manda la espera del rate limiter) y hasta
// ~3 s si cae al fallback por nombre; una tanda de 12 tomó 14 s. 60 s deja
// margen de sobra y es el tope del plan Hobby de Vercel.
export const maxDuration = 60;

/**
 * Elige el precio de una lista de candidatos comparando el nombre palabra por
 * palabra. Solo se usa cuando el producto no tiene `jumbo_sku`.
 */
function priceByName(
  candidates: { name: string; price: number }[],
  name: string,
  packageSize: number | null,
  packageUnit: string | null,
): number | null {
  if (candidates.length === 0) return null;

  const nameWords = name
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Puntaje por palabras coincidentes, penalizando tanto las palabras extra del
  // candidato como las de la consulta que no aparecen.
  const scored = candidates.map((c) => {
    const title = c.name.toLowerCase();
    const wordMatches = nameWords.filter((w) => title.includes(w)).length;
    const candidateWords = title.split(/\s+/).filter((w) => w.length > 2);
    const denominator = Math.max(nameWords.length, candidateWords.length);
    const ratio = denominator > 0 ? wordMatches / denominator : 0;

    // Bonus si coincide el tamaño del envase (ej. "800 g")
    const sizeMatch =
      packageSize && packageUnit
        ? title.includes(`${packageSize} ${packageUnit}`.toLowerCase())
        : false;

    return { price: c.price, score: ratio + (sizeMatch ? 0.3 : 0) };
  });

  // Mayor puntaje primero; a igual puntaje, el más barato.
  scored.sort((a, b) => b.score - a.score || a.price - b.price);

  // Se exige al menos 40% de coincidencia para aceptar el resultado.
  return scored[0].score > 0.4 ? scored[0].price : null;
}

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Body JSON inválido" },
        { status: 400 },
      );
    }

    const items: ScrapeItem[] = body?.items;

    console.log(
      "[scrape-prices] received",
      Array.isArray(items) ? items.length : typeof items,
      "items",
    );

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Se requiere un array de items" },
        { status: 400 },
      );
    }

    if (items.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: `Máximo ${MAX_ITEMS} productos por solicitud` },
        { status: 400 },
      );
    }

    const prices: PriceResult[] = [];

    for (const item of items) {
      let price: number | null = null;
      let matchedBy: PriceResult["matchedBy"] = null;

      try {
        // ── Camino preferido: buscar por sku ──────────────────────────────
        // `?ft=<sku>` devuelve exactamente ese producto, así que no hace falta
        // adivinar por nombre y basta una sola request por producto.
        const sku = item.jumbo_sku?.trim();
        if (sku) {
          const html = await fetchJumboHtml(buildSearchUrl(sku));
          const candidates = html ? extractCandidates(html) : [];
          const exact = candidates.find(
            (c) => c.sku === sku || c.productId === sku,
          );
          console.log(
            `[scrape-prices] sku=${sku} candidates:${candidates.length} exact:${exact ? exact.price : "no"}`,
          );
          if (exact) {
            price = exact.price;
            matchedBy = "sku";
          }
        }

        // ── Fallback: buscar por nombre y puntuar ─────────────────────────
        if (price === null) {
          const queries = buildSearchQueries(item);
          const matchName = queries[0] ?? item.name;
          console.log(`[scrape-prices] searching: "${matchName}"`);

          for (const ft of queries) {
            const html = await fetchJumboHtml(buildSearchUrl(ft));
            const candidates = html ? extractCandidates(html) : [];
            console.log(
              `[scrape-prices] ft="${ft}" candidates:${candidates.length}`,
            );
            if (candidates.length > 0) {
              price = priceByName(
                candidates,
                matchName,
                item.package_size,
                item.package_unit,
              );
              if (price !== null) matchedBy = "name";
              break;
            }
          }
        }
      } catch (err) {
        // Si Supermercado pide frenar, se corta la tanda y se devuelve lo ya obtenido
        // junto con el tiempo de espera para que el cliente detenga la corrida.
        if (err instanceof JumboRateLimitError) {
          console.warn("[scrape-prices]", err.message);
          return NextResponse.json({
            prices,
            rateLimited: true,
            retryAfterMs: err.retryAfterMs,
          });
        }
        console.error(`[scrape-prices] error en "${item.name}":`, err);
      }

      prices.push({ id: item.id, price, matchedBy, source: "jumbo.cl" });
    }

    return NextResponse.json({ prices });
  } catch {
    return NextResponse.json(
      { error: "Error procesando la solicitud" },
      { status: 500 },
    );
  }
}
