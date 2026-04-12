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

function extractPrice(
  html: string,
  name: string,
  _brand: string,
  packageSize: number | null,
  packageUnit: string | null,
): number | null {
  // Jumbo uses data-cnstrc-item-price="6490" with product title in the same element
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

  if (candidates.length === 0) return null;

  // Build search terms from the product name
  const nameWords = name
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Score each candidate by how many name words match, penalizing extra words
  const scored = candidates.map((c) => {
    const wordMatches = nameWords.filter((w) => c.title.includes(w)).length;
    const candidateWords = c.title.split(/\s+/).filter((w) => w.length > 2);
    const ratio =
      candidateWords.length > 0 ? wordMatches / candidateWords.length : 0;

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

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const sizePart = item.package_size
        ? `${item.package_size} ${item.package_unit ?? ""}`.trim()
        : "";
      const ftPart = `${item.name} ${sizePart}`.trim();
      const brandParam = item.brand
        ? `&b=${encodeURIComponent(item.brand)}`
        : "";
      const url = `https://www.jumbo.cl/busqueda?ft=${encodeURIComponent(ftPart)}${brandParam}`;
      console.log(
        `[scrape-prices] searching: "${ftPart}" brand="${item.brand}" -> ${url}`,
      );

      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "es-CL,es;q=0.9",
          },
        });

        if (!res.ok) {
          prices.push({ id: item.id, price: null, source: "jumbo.cl" });
          continue;
        }

        const html = await res.text();
        const price = extractPrice(
          html,
          item.name,
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
