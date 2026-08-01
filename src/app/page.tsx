"use client";

import { useState, useEffect } from "react";
import { INITIAL_ITEMS } from "@/components/shopping-list/constants";
import { MiListaView } from "@/components/views/MiListaView";
import { ConfigView } from "@/components/views/ConfigView";
import { AddPurchase } from "@/components/AddPurchase";
import { Sidebar, type AppView } from "@/components/Sidebar";
import { ShoppingAnalysis } from "@/components/ShoppingAnalysis";
import { suggestedQty, formatQty, formatPrice } from "@/utils/stock";
import {
  toISO,
  formatLongDate,
  nextShoppingDate,
  autoCycleStart,
} from "@/utils/dates";
import { solveKnapsack, buildKnapsackItems } from "@/utils/knapsack";
import type { KnapsackResult } from "@/utils/knapsack";
import { TopBar } from "@/components/views/TopBar";
import { InicioView } from "@/components/views/InicioView";
import { InventarioView } from "@/components/views/InventarioView";
import { OptimizacionView } from "@/components/views/OptimizacionView";
import { HistorialView } from "@/components/views/HistorialView";
import {
  PRICE_FRESH_HOURS,
  PRICE_SCRAPE_BATCH_PAUSE_MS,
  PRICE_SCRAPE_BATCH_SIZE,
} from "@/config";
import type {
  ShoppingListItem,
  UserConfig,
  Purchase,
  PurchaseItem,
  PriceHistorySummary,
} from "@/types/shopping";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Página principal ───────────────────────────────────────────────────
export default function Dashboard() {
  const [items, setItems] = useState<ShoppingListItem[]>(INITIAL_ITEMS);
  // item_id → cantidad que queda hoy en la despensa (unidades del producto)
  const [stockRemaining, setStockRemaining] = useState<Record<string, number>>(
    {},
  );

  const [config, setConfig] = useState<UserConfig | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState("");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [knapsackResult, setKnapsackResult] = useState<KnapsackResult | null>(
    null,
  );
  const [analisisOpen, setAnalisisOpen] = useState(false);
  const [priceHistory, setPriceHistory] = useState<
    Record<string, PriceHistorySummary>
  >({});

  // Cargar config desde Supabase al montar
  useEffect(() => {
    const load = async () => {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("pantry_user_config")
        .select("*")
        .maybeSingle();
      if (data) setConfig(data as UserConfig);
    };
    load();
  }, []);

  // Cargar items de la lista de compras
  useEffect(() => {
    const load = async () => {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("pantry_shopping_list_items")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setItems(data as typeof items);
    };
    load();
  }, []);

  // Cargar el stock (cantidad restante) desde Supabase al montar
  useEffect(() => {
    const load = async () => {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const { data } = await supabase.from("pantry_stock_levels").select("*");
      if (data) {
        const remaining: Record<string, number> = {};
        for (const row of data) {
          remaining[row.item_id] = row.remaining;
        }
        setStockRemaining(remaining);
      }
    };
    load();
  }, []);

  // Cargar compras de los últimos 45 días (cubre cualquier ciclo de compra)
  useEffect(() => {
    const load = async () => {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 45);
      const cutoffStr = [
        cutoff.getFullYear(),
        String(cutoff.getMonth() + 1).padStart(2, "0"),
        String(cutoff.getDate()).padStart(2, "0"),
      ].join("-");
      const { data, error } = await supabase
        .from("pantry_purchases")
        .select("*")
        .gte("purchased_at", cutoffStr)
        .order("purchased_at", { ascending: false });
      if (error) console.error("Error cargando compras:", error);
      if (data) setPurchases(data as Purchase[]);
    };
    load();
  }, []);

  // Cargar unidades compradas por producto (últimos 45 días, cubre el ciclo)
  useEffect(() => {
    const load = async () => {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 45);
      const cutoffStr = [
        cutoff.getFullYear(),
        String(cutoff.getMonth() + 1).padStart(2, "0"),
        String(cutoff.getDate()).padStart(2, "0"),
      ].join("-");
      const { data, error } = await supabase
        .from("pantry_purchase_items")
        .select("*")
        .gte("purchased_at", cutoffStr);
      if (error) console.error("Error cargando items comprados:", error);
      if (data) setPurchaseItems(data as PurchaseItem[]);
    };
    load();
  }, []);

  // Cargar historial de precios
  useEffect(() => {
    const load = async () => {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("pantry_price_history")
        .select("item_id, price")
        .order("scraped_at", { ascending: false });
      if (!data) return;
      const grouped: Record<string, number[]> = {};
      for (const row of data) {
        if (!grouped[row.item_id]) grouped[row.item_id] = [];
        grouped[row.item_id].push(row.price);
      }
      const summaries: Record<string, PriceHistorySummary> = {};
      for (const [itemId, prices] of Object.entries(grouped)) {
        summaries[itemId] = {
          prevPrice: prices.length > 1 ? prices[1] : null,
          minPrice: Math.min(...prices),
        };
      }
      setPriceHistory(summaries);
    };
    load();
  }, []);

  // Inicio del ciclo actual: cycle_start manual si existe; si no, se deriva de
  // las fechas de compra marcadas en el calendario (ver utils/dates).
  const cycleStart =
    config?.cycle_start ?? autoCycleStart(config?.shopping_dates ?? []);

  const monthSpent = purchases
    .filter((p) => p.purchased_at >= cycleStart)
    .reduce((s, p) => s + p.amount, 0);
  const monthlyBudget = config?.monthly_budget ?? 0;
  const remainingBudget = monthlyBudget - monthSpent;

  // Unidades ya compradas por producto en el ciclo actual (item_id → qty)
  const boughtThisCycle = purchaseItems
    .filter((pi) => pi.purchased_at >= cycleStart)
    .reduce<Record<string, number>>((acc, pi) => {
      acc[pi.item_id] = (acc[pi.item_id] ?? 0) + pi.quantity;
      return acc;
    }, {});

  const handleStockUpdate = async (id: string, remaining: number) => {
    setStockRemaining((prev) => ({ ...prev, [id]: remaining }));
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    await supabase
      .from("pantry_stock_levels")
      .upsert({ item_id: id, remaining }, { onConflict: "item_id" });
  };

  const handleClearAllStock = async () => {
    setStockRemaining({});
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    const ids = items.map((i) => i.id);
    if (ids.length > 0) {
      await supabase.from("pantry_stock_levels").delete().in("item_id", ids);
    }
  };

  // Actualiza los precios de la lista. Se envía en tandas: cada búsqueda en
  // Supermercado descarga ~1 MB de HTML y va espaciada ~1 s, así que un solo request
  // con 85 productos se pasaría de cualquier límite. Cada tanda se guarda al
  // terminar, de modo que un error a mitad de camino no bota lo ya scrapeado.
  // Se omiten los precios frescos y la corrida se detiene si Supermercado pide esperar.
  const handleScrape = async () => {
    if (items.length === 0) return;

    const currentPurchaseItems = items.filter(
      (item) =>
        suggestedQty(
          item,
          stockRemaining[item.id] ?? null,
          boughtThisCycle[item.id] ?? 0,
        ) > 0,
    );
    const freshCutoff = Date.now() - PRICE_FRESH_HOURS * 3600_000;
    const pending = currentPurchaseItems.filter(
      (i) =>
        !i.price_updated_at ||
        new Date(i.price_updated_at).getTime() < freshCutoff,
    );
    const skipped = currentPurchaseItems.length - pending.length;

    if (currentPurchaseItems.length === 0) {
      setScrapeMsg("No hay productos pendientes para esta compra");
      return;
    }

    if (pending.length === 0) {
      setScrapeMsg(
        `Los precios de esta compra se actualizaron hace menos de ${PRICE_FRESH_HOURS} h`,
      );
      return;
    }

    setScraping(true);
    setScrapeMsg("");

    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();

    const batches: ShoppingListItem[][] = [];
    for (let i = 0; i < pending.length; i += PRICE_SCRAPE_BATCH_SIZE) {
      batches.push(pending.slice(i, i + PRICE_SCRAPE_BATCH_SIZE));
    }

    // Precio previo por producto, para la tendencia ↑↓ (se actualiza tanda a tanda)
    const prevPriceById = new Map(pending.map((i) => [i.id, i.last_price]));

    let processed = 0;
    let updated = 0;
    let failedBatches = 0;
    let rateLimited = false;

    const progress = (batchIdx: number) =>
      setScrapeMsg(
        `Tanda ${batchIdx + 1}/${batches.length} · ` +
          `${processed}/${pending.length} productos · ${updated} precios`,
      );

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      progress(b);

      try {
        const payload = {
          items: batch.map((i) => ({
            id: i.id,
            name: i.name,
            package_size: i.package_size,
            package_unit: i.package_unit,
            jumbo_sku: i.jumbo_sku,
          })),
        };
        const res = await fetch("/api/scrape-prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al scrapear");

        const now = new Date().toISOString();
        const found = (
          data.prices as { id: string; price: number | null }[]
        ).filter((p) => p.price);

        for (const p of found) {
          await supabase
            .from("pantry_shopping_list_items")
            .update({ last_price: p.price, price_updated_at: now })
            .eq("id", p.id);
        }

        if (found.length > 0) {
          await supabase.from("pantry_price_history").insert(
            found.map((p) => ({
              item_id: p.id,
              price: p.price as number,
              supermarket: "Supermercado",
              scraped_at: now,
            })),
          );

          setPriceHistory((prev) => {
            const next = { ...prev };
            for (const p of found) {
              const price = p.price as number;
              const existing = next[p.id];
              next[p.id] = {
                prevPrice: prevPriceById.get(p.id) ?? null,
                minPrice:
                  existing?.minPrice != null
                    ? Math.min(existing.minPrice, price)
                    : price,
              };
            }
            return next;
          });

          setItems((prev) =>
            prev.map((item) => {
              const hit = found.find((p) => p.id === item.id);
              return hit
                ? {
                    ...item,
                    last_price: hit.price as number,
                    price_updated_at: now,
                  }
                : item;
            }),
          );

          for (const p of found) prevPriceById.set(p.id, p.price as number);
          updated += found.length;
        }

        // Supermercado pidió frenar: se guarda lo obtenido y se corta la corrida.
        if (data.rateLimited) rateLimited = true;
      } catch (err) {
        failedBatches++;
        console.error(`[scrape] tanda ${b + 1} falló:`, err);
      }

      processed += batch.length;
      progress(b);

      if (rateLimited) break;

      // Pausa entre tandas, además del espaciado por request
      if (b < batches.length - 1) await sleep(PRICE_SCRAPE_BATCH_PAUSE_MS);
    }

    const notes = [
      skipped > 0 ? `${skipped} ya estaban frescos` : "",
      failedBatches > 0 ? `${failedBatches} tanda(s) con error` : "",
      rateLimited
        ? "Supermercado pidió esperar: se detuvo la actualización"
        : "",
    ].filter(Boolean);

    setScrapeMsg(
      `${updated} de ${pending.length} precios actualizados` +
        (notes.length > 0 ? ` · ${notes.join(" · ")}` : ""),
    );
    setScraping(false);
  };

  const handleGenerateOptimal = () => {
    const knapsackItems = buildKnapsackItems(
      items,
      stockRemaining,
      suggestedQty,
      formatQty,
      boughtThisCycle,
    );
    const result = solveKnapsack(knapsackItems, remainingBudget);
    setKnapsackResult(result);
  };

  // Cerrar mes: inicia un nuevo ciclo. Reinicia presupuesto, contadores de
  // comprado (vía cycle_start) y vacía el stock de la despensa.
  const handleCloseCycle = async () => {
    const today = toISO(new Date());
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    if (config) {
      const { data } = await supabase
        .from("pantry_user_config")
        .update({ cycle_start: today, updated_at: new Date().toISOString() })
        .eq("id", config.id)
        .select()
        .single();
      if (data) setConfig(data as UserConfig);
    }
    await handleClearAllStock();
    setKnapsackResult(null);
  };

  // Marcar productos de la lista óptima como comprados (registra unidades).
  const handleMarkPurchased = async (
    rows: { item_id: string; quantity: number }[],
  ) => {
    if (rows.length === 0) return;
    const purchasedAt = toISO(new Date());
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();

    // Unidades por producto (para no re-sugerir en el ciclo).
    const { data } = await supabase
      .from("pantry_purchase_items")
      .insert(
        rows.map((r) => ({
          item_id: r.item_id,
          quantity: r.quantity,
          purchased_at: purchasedAt,
        })),
      )
      .select();
    if (data)
      setPurchaseItems((prev) => [...(data as PurchaseItem[]), ...prev]);

    // Gasto estimado (last_price × cantidad) → descuenta del presupuesto del mes.
    // Es una estimación; el gasto real se ajusta registrando la compra a mano.
    const amount = rows.reduce((s, r) => {
      const it = items.find((i) => i.id === r.item_id);
      return s + Math.round((it?.last_price ?? 0) * r.quantity);
    }, 0);
    if (amount > 0) {
      const { data: purchase } = await supabase
        .from("pantry_purchases")
        .insert({
          amount,
          supermarket: "Supermercado",
          purchased_at: purchasedAt,
          tag: "Estimado",
        })
        .select()
        .single();
      if (purchase) setPurchases((prev) => [purchase as Purchase, ...prev]);
    }
  };

  // Guarda la lista lista-para-carro; es lo que lee el bookmarklet desde el
  // sitio del supermercado vía /api/cart-list. Se conserva solo la más reciente.
  const handleSaveCartSnapshot = async (
    rows: { skuId: string; quantity: number }[],
  ) => {
    if (rows.length === 0) return;
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    const { data } = await supabase
      .from("pantry_cart_snapshot")
      .insert({ items: rows })
      .select("id")
      .single();
    if (data) {
      await supabase.from("pantry_cart_snapshot").delete().neq("id", data.id);
    }
  };

  const handleShareWhatsApp = (result: KnapsackResult) => {
    const date = new Date().toLocaleDateString("es-CL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const lines: string[] = [
      `*Lista de Compras — ${date}*`,
      `Presupuesto: ${formatPrice(result.budget)}`,
      ``,
    ];
    if (result.required.length > 0) {
      lines.push(`*REQUERIDOS*`);
      for (const item of result.required)
        lines.push(
          `• ${item.name} — ${item.formatQty}${item.cost ? ` → ${formatPrice(item.cost)}` : ""}`,
        );
      lines.push(`_Subtotal: ${formatPrice(result.requiredCost)}_`, ``);
    }
    if (result.included.length > 0) {
      lines.push(`*OPCIONALES*`);
      for (const item of result.included)
        lines.push(
          `• ${item.name} — ${item.formatQty}${item.cost ? ` → ${formatPrice(item.cost)}` : ""}`,
        );
      lines.push(`_Subtotal: ${formatPrice(result.includedCost)}_`, ``);
    }
    lines.push(`*TOTAL: ${formatPrice(result.totalCost)}*`);
    window.open(
      `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`,
      "_blank",
    );
  };

  const handleAddPurchase = (purchase: Purchase) => {
    setPurchases((prev) => [purchase, ...prev]);
  };

  const handleDeletePurchase = async (id: string) => {
    setPurchases((prev) => prev.filter((p) => p.id !== id));
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    await supabase.from("pantry_purchases").delete().eq("id", id);
  };

  // Próxima compra: primera fecha marcada en el calendario que sea >= hoy.
  // Se resuelve en un efecto (solo client-side) para evitar hydration mismatch.
  const [nextDate, setNextDate] = useState("—");
  const [nextDateISO, setNextDateISO] = useState<string | null>(null);

  useEffect(() => {
    const upcoming = nextShoppingDate(config?.shopping_dates ?? []);
    setNextDateISO(upcoming);
    setNextDate(upcoming ? formatLongDate(upcoming) : "—");
  }, [config]);

  const [budgetDisplay, setBudgetDisplay] = useState("—");

  useEffect(() => {
    setBudgetDisplay(`$${remainingBudget.toLocaleString("es-CL")}`);
  }, [remainingBudget]);

  // ── Último scraping ────────────────────────────────────────────────────
  const lastScrapeTs =
    items
      .map((i) => i.price_updated_at)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  const pctUsed = Math.min(
    100,
    Math.round((monthSpent / (monthlyBudget || 1)) * 100),
  );

  const [activeView, setActiveView] = useState<AppView>("optimizacion");

  const handleNav = (view: AppView) => setActiveView(view);

  return (
    <div className="bg-bg-app flex h-screen overflow-hidden">
      {purchaseOpen && (
        <AddPurchase
          supermarkets={config?.supermarkets ?? []}
          onSave={handleAddPurchase}
          onClose={() => setPurchaseOpen(false)}
        />
      )}
      {analisisOpen && (
        <ShoppingAnalysis
          items={items}
          knapsackResult={knapsackResult}
          monthlyBudget={monthlyBudget}
          monthSpent={monthSpent}
          onClose={() => setAnalisisOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <Sidebar active={activeView} onChange={handleNav} />

      {/* ── Contenido principal ── */}
      <main className="bg-bg-app ml-60 flex flex-1 flex-col overflow-y-auto">
        <TopBar
          remainingBudget={remainingBudget}
          budgetDisplay={budgetDisplay}
          pctUsed={pctUsed}
          lastScrapeTs={lastScrapeTs}
          nextShoppingDate={nextDate}
          nextShoppingDateISO={nextDateISO}
        />

        {activeView === "inicio" && (
          <InicioView
            budgetDisplay={budgetDisplay}
            remainingBudget={remainingBudget}
            monthlyBudget={monthlyBudget}
            monthSpent={monthSpent}
            cycleStart={cycleStart}
            nextShoppingDate={nextDate}
            itemCount={items.length}
            items={items}
            onNavigate={setActiveView}
          />
        )}

        {activeView === "inventario" && (
          <InventarioView
            items={items}
            stockRemaining={stockRemaining}
            priceHistory={priceHistory}
            onStockUpdate={handleStockUpdate}
            onClearAll={handleClearAllStock}
          />
        )}

        {activeView === "optimizacion" && (
          <OptimizacionView
            items={items}
            stockRemaining={stockRemaining}
            boughtThisCycle={boughtThisCycle}
            knapsackResult={knapsackResult}
            priceHistory={priceHistory}
            scraping={scraping}
            scrapeMsg={scrapeMsg}
            lastScrapeTs={lastScrapeTs}
            onScrape={handleScrape}
            onGenerateOptimal={handleGenerateOptimal}
            onShareWhatsApp={handleShareWhatsApp}
            onMarkPurchased={handleMarkPurchased}
            onSaveCartSnapshot={handleSaveCartSnapshot}
            onResetCurrentPurchase={() => setKnapsackResult(null)}
            onOpenInventory={() => setActiveView("inventario")}
            onOpenList={() => setActiveView("mi-lista")}
            onOpenHistory={() => setActiveView("historial")}
          />
        )}

        {activeView === "mi-lista" && (
          <MiListaView items={items} setItems={setItems} />
        )}

        {activeView === "configuracion" && (
          <ConfigView config={config} setConfig={setConfig} />
        )}

        {activeView === "historial" && (
          <HistorialView
            purchases={purchases}
            cycleStart={cycleStart}
            monthSpent={monthSpent}
            onOpenAnalysis={() => setAnalisisOpen(true)}
            onOpenPurchase={() => setPurchaseOpen(true)}
            onDeletePurchase={handleDeletePurchase}
            onCloseCycle={handleCloseCycle}
          />
        )}
      </main>
    </div>
  );
}
