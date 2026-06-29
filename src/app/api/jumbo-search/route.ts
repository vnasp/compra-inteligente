import { NextRequest, NextResponse } from "next/server";
import {
  JUMBO_UA,
  extractCandidates,
  stripSizeFromText,
  type JumboCandidate,
} from "@/utils/jumbo";

const MAX_RESULTS = 12;

async function fetchSearch(query: string): Promise<JumboCandidate[]> {
  const url = `https://www.jumbo.cl/busqueda?ft=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": JUMBO_UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "es-CL,es;q=0.9",
    },
  });
  if (!res.ok) return [];
  const html = await res.text();
  return extractCandidates(html);
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json(
      { error: "Falta el parámetro de búsqueda" },
      { status: 400 },
    );
  }

  try {
    let results = await fetchSearch(q);
    // Fallback: si no hubo resultados, reintenta sin el tamaño embebido.
    if (results.length === 0) {
      const stripped = stripSizeFromText(q);
      if (stripped && stripped !== q) results = await fetchSearch(stripped);
    }
    return NextResponse.json({ results: results.slice(0, MAX_RESULTS) });
  } catch {
    return NextResponse.json(
      { error: "Error consultando Jumbo" },
      { status: 502 },
    );
  }
}
