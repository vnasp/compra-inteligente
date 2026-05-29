import { NextRequest, NextResponse } from "next/server";

interface ScrapeItem {
  id: string;
  name: string;
  brand: string;
  package_size: number | null;
  package_unit: string | null;
}

interface PriceResult {
  id: string;
  price: number | null;
  source: string;
}

const DELAY_MS = 600;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CandidateProduct {
  title: string;
  price: number;
}

function stripSizeFromText(text: string): string {
  return text
    .replace(/\b\d+[\.,]?\d*\s*(g|kg|ml|l|cc|cl|un\.?|lt)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCandidates(html: string): CandidateProduct[] {
  const candidateRegex =
    /([^"]*?)"\s+data-cnstrc-item-id="[^"]*"\s+data-cnstrc-item-price="(\d+)"/g;
  const candidates: CandidateProduct[] = [];
  let match;
  while ((match = candidateRegex.exec(html)) !== null) {
    const title = match[1].toLowerCase();
    const price = parseInt(match[2], 10);
    if (price >= 100 && price <= 500000) {
      candidates.push({ title, price });
    }
  }
  return candidates;
}

function extractPrice(
  candidates: CandidateProduct[],
  name: string,
  _brand: string,
  packageSize: number | null,
  packageUnit: string | null,
): number | null {
  if (candidates.length === 0) return null;

  // Build search terms from the product name
  const nameWords = name
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Score each candidate by how many name words match, penalizing both
  // extra words in the candidate AND unmatched words from the query
  const scored = candidates.map((c) => {
    const wordMatches = nameWords.filter((w) => c.title.includes(w)).length;
    const candidateWords = c.title.split(/\s+/).filter((w) => w.length > 2);
    const denominator = Math.max(nameWords.length, candidateWords.length);
    const ratio = denominator > 0 ? wordMatches / denominator : 0;

    // Bonus for matching package size (e.g. "800 g")
    let sizeMatch = false;
    if (packageSize && packageUnit) {
      sizeMatch = c.title.includes(
        `${packageSize} ${packageUnit}`.toLowerCase(),
      );
    }

    return {
      ...c,
      score: ratio + (sizeMatch ? 0.3 : 0),
    };
  });

  // Sort by score descending, then by price ascending for ties
  scored.sort((a, b) => b.score - a.score || a.price - b.price);

  console.log(
    "[scrape-prices] candidates:",
    scored.map(
      (s) => `${s.title} -> $${s.price} (score: ${s.score.toFixed(2)})`,
    ),
  );

  // Require at least 40% word match to consider it a valid result
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

    if (items.length > 50) {
      return NextResponse.json(
        { error: "Máximo 50 productos por solicitud" },
        { status: 400 },
      );
    }

    const prices: PriceResult[] = [];
    let sessionCookies = "";

    const fetchHtml = async (url: string): Promise<string | null> => {
      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-CL,es;q=0.9",
      };
      if (sessionCookies) headers["Cookie"] = sessionCookies;
      const res = await fetch(url, { cache: "no-store", headers });
      // Capture AWSALB sticky-session cookies for subsequent requests
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) {
        const awsalb = setCookie.match(/AWSALB=[^;]+/)?.[0];
        const awsalbcors = setCookie.match(/AWSALBCORS=[^;]+/)?.[0];
        if (awsalb || awsalbcors) {
          sessionCookies = [awsalb, awsalbcors].filter(Boolean).join("; ");
        }
      }
      if (!res.ok) return null;
      return res.text();
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const brandParam = item.brand
        ? `&b=${encodeURIComponent(item.brand)}`
        : "";

      // Strip brand from name (brand already goes in &b= filter).
      // Leaving it in ft= causes 0 results when brand has special chars (e.g. "Cuisine & Co").
      const nameNoBrand = item.brand
        ? item.name
            .replace(
              new RegExp(
                item.brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                "i",
              ),
              "",
            )
            .replace(/\s+/g, " ")
            .trim()
        : item.name;

      // Extra size from package fields (only if not already embedded in name)
      const sizePart =
        item.package_size &&
        !nameNoBrand.toLowerCase().includes(String(item.package_size))
          ? `${item.package_size} ${item.package_unit ?? ""}`.trim()
          : "";

      const ftWithSize = `${nameNoBrand} ${sizePart}`.trim();
      const ftClean = stripSizeFromText(nameNoBrand); // strip sizes embedded in name text

      // Build ordered query list: with brand first, then without brand as fallback.
      // Deduplicated so we never make the same request twice.
      const seenQueries = new Set<string>();
      const queries: Array<[ft: string, bParam: string]> = [];
      for (const ft of [...new Set([ftWithSize, ftClean])]) {
        for (const b of brandParam ? [brandParam, ""] : [""]) {
          const key = ft + b;
          if (!seenQueries.has(key)) {
            seenQueries.add(key);
            queries.push([ft, b]);
          }
        }
      }

      console.log(
        `[scrape-prices] searching: "${ftWithSize}" brand="${item.brand}"`,
      );

      try {
        let candidates: CandidateProduct[] = [];

        for (let q = 0; q < queries.length; q++) {
          const [ft, b] = queries[q];
          const url = `https://www.jumbo.cl/busqueda?ft=${encodeURIComponent(ft)}${b}`;
          const html = await fetchHtml(url);
          if (html) {
            candidates = extractCandidates(html);
            console.log(
              `[scrape-prices] ft="${ft}" b="${b ? item.brand : "none"}" html:${html.length} candidates:${candidates.length}`,
            );
          }
          if (candidates.length > 0) break;
          if (q < queries.length - 1) await sleep(400);
        }

        const price = extractPrice(
          candidates,
          ftWithSize,
          item.brand,
          item.package_size,
          item.package_unit,
        );
        prices.push({ id: item.id, price, source: "jumbo.cl" });
      } catch {
        prices.push({ id: item.id, price: null, source: "jumbo.cl" });
      }

      // Delay between requests to avoid being blocked
      if (i < items.length - 1) {
        await sleep(DELAY_MS);
      }
    }

    return NextResponse.json({ prices });
  } catch {
    return NextResponse.json(
      { error: "Error procesando la solicitud" },
      { status: 500 },
    );
  }
}
