import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

// Lista óptima vigente, para que el bookmarklet la lea desde el sitio del
// supermercado (ver buildCartBookmarklet en @/utils/jumbo). Es el único motivo
// por el que este endpoint existe: sin él habría que volver a pegar el código
// cada vez que cambia la lista.
//
// CORS: se responde solo al origen del supermercado. Ojo con qué protege eso y
// qué no — CORS lo aplica el navegador, así que evita que otro sitio lea la
// lista desde el navegador de la usuaria, pero no impide un curl. La protección
// real es el token (`NEXT_PUBLIC_CART_TOKEN`); sin él configurado el endpoint
// queda abierto, igual que el resto de la app, que hoy no tiene auth.

const ALLOWED_ORIGIN = "https://www.jumbo.cl";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "no-store",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: NextRequest) {
  const expected = process.env.NEXT_PUBLIC_CART_TOKEN;
  if (expected && request.nextUrl.searchParams.get("k") !== expected) {
    return NextResponse.json(
      { error: "Token inválido" },
      { status: 401, headers: corsHeaders() },
    );
  }

  try {
    const supabase = createClient(await cookies());
    const { data, error } = await supabase
      .from("pantry_cart_snapshot")
      .select("items, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // PGRST205 = la tabla no existe. Es el error esperable si falta correr la
    // migración, así que se dice explícitamente en vez de un 500 mudo.
    if (error?.code === "PGRST205") {
      return NextResponse.json(
        {
          error:
            "Falta la tabla pantry_cart_snapshot: aplica la migración 20260730010000_cart_snapshot.sql en Supabase.",
        },
        { status: 503, headers: corsHeaders() },
      );
    }
    if (error) throw error;

    return NextResponse.json(
      { items: data?.items ?? [], createdAt: data?.created_at ?? null },
      { headers: corsHeaders() },
    );
  } catch (err) {
    console.error("[cart-list]", err);
    return NextResponse.json(
      { error: "No se pudo leer la lista" },
      { status: 500, headers: corsHeaders() },
    );
  }
}
