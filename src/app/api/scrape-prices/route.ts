import { NextRequest, NextResponse } from "next/server";
import {
  JUMBO_UA,
  buildSearchQueries,
  extractCandidates as extractJumboCandidates,
} from "@/utils/jumbo";

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

function extractCandidates(html: string): CandidateProduct[] {
  return extractJumboCandidates(html).map((c) => ({
    title: c.name.toLowerCase(),
    price: c.price,
  }));
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

    if (items.length > 80) {
      return NextResponse.json(
        { error: "Máximo 50 productos por solicitud" },
        { status: 400 },
      );
    }

    const prices: PriceResult[] = [];
    let sessionCookies = "";

    const fetchHtml = async (url: string): Promise<string | null> => {
      const headers: Record<string, string> = {
        "User-Agent": JUMBO_UA,
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

      // Lista ordenada de queries: con marca primero, sin marca como fallback.
      const queries = buildSearchQueries(item);
      // Nombre usado para el scoring (primer query = nombre + tamaño, sin marca).
      const matchName = queries[0]?.ft ?? item.name;

      console.log(
        `[scrape-prices] searching: "${matchName}" brand="${item.brand}"`,
      );

      try {
        let candidates: CandidateProduct[] = [];

        for (let q = 0; q < queries.length; q++) {
          const { ft, bParam } = queries[q];
          const url = `https://www.jumbo.cl/busqueda?ft=${encodeURIComponent(ft)}${bParam}`;
          const html = await fetchHtml(url);
          if (html) {
            candidates = extractCandidates(html);
            console.log(
              `[scrape-prices] ft="${ft}" b="${bParam ? item.brand : "none"}" html:${html.length} candidates:${candidates.length}`,
            );
          }
          if (candidates.length > 0) break;
          if (q < queries.length - 1) await sleep(400);
        }

        const price = extractPrice(
          candidates,
          matchName,
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
