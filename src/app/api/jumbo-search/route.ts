import { NextRequest, NextResponse } from "next/server";
import {
  buildSearchUrl,
  extractCandidates,
  fetchJumboHtml,
  JumboRateLimitError,
  stripSizeFromText,
  type JumboCandidate,
} from "@/utils/jumbo";

const MAX_RESULTS = 12;

async function fetchSearch(query: string): Promise<JumboCandidate[]> {
  const html = await fetchJumboHtml(buildSearchUrl(query));
  return html ? extractCandidates(html) : [];
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
  } catch (err) {
    if (err instanceof JumboRateLimitError) {
      return NextResponse.json(
        {
          error:
            "Supermercado pidió esperar un momento. Intenta de nuevo en un rato.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(err.retryAfterMs / 1000)),
          },
        },
      );
    }
    return NextResponse.json(
      { error: "Error consultando Supermercado" },
      { status: 502 },
    );
  }
}
