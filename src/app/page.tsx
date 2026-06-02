"use client";

import { useState, useEffect } from "react";
import { INITIAL_ITEMS } from "@/components/shopping-list/constants";
import { MiListaView } from "@/components/views/MiListaView";
import { BoletaModal } from "@/components/views/BoletaModal";
import { ConfigView } from "@/components/views/ConfigView";
import { AddPurchase } from "@/components/AddPurchase";
import { Sidebar, type AppView } from "@/components/Sidebar";
import { ShoppingAnalysis } from "@/components/ShoppingAnalysis";
import { suggestedQty, formatQty, formatPrice } from "@/utils/stock";
import { solveKnapsack, buildKnapsackItems } from "@/utils/knapsack";
import type { KnapsackResult } from "@/utils/knapsack";
import { TopBar } from "@/components/views/TopBar";
import { InicioView } from "@/components/views/InicioView";
import { InventarioView } from "@/components/views/InventarioView";
import { OptimizacionView } from "@/components/views/OptimizacionView";
import { HistorialView } from "@/components/views/HistorialView";
import type {
  ShoppingListItem,
  UserConfig,
  Purchase,
  PriceHistorySummary,
} from "@/types/shopping";

// ── Página principal ───────────────────────────────────────────────────
export default function Dashboard() {
  const [items, setItems] = useState<ShoppingListItem[]>(INITIAL_ITEMS);
  const [stockLevels, setStockLevels] = useState<Record<string, number>>({});

  const [config, setConfig] = useState<UserConfig | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState("");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [boletaOpen, setBoletaOpen] = useState(false);
  const [barcodeMappings, setBarcodeMappings] = useState<
    Record<string, string>
  >({});
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

  // Cargar stock levels desde Supabase al montar
  useEffect(() => {
    const load = async () => {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const { data } = await supabase.from("pantry_stock_levels").select("*");
      if (data) {
        const levels: Record<string, number> = {};
        for (const row of data) {
          levels[row.item_id] = row.level;
        }
        setStockLevels(levels);
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

  // Cargar mapeos de códigos de barras
  useEffect(() => {
    const load = async () => {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("pantry_barcode_mappings")
        .select("barcode, item_id");
      if (data) {
        const m: Record<string, string> = {};
        for (const row of data) m[row.barcode] = row.item_id;
        setBarcodeMappings(m);
      }
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

  // Inicio del ciclo actual: día de compra más cercano anterior al día 1 del mes
  const cycleStart = (() => {
    const weekday = config?.shopping_weekday ?? 4;
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysSince = (firstOfMonth.getDay() - weekday + 7) % 7;
    const start = new Date(firstOfMonth);
    start.setDate(1 - daysSince);
    return [
      start.getFullYear(),
      String(start.getMonth() + 1).padStart(2, "0"),
      String(start.getDate()).padStart(2, "0"),
    ].join("-");
  })();

  const monthSpent = purchases
    .filter((p) => p.purchased_at >= cycleStart)
    .reduce((s, p) => s + p.amount, 0);
  const monthlyBudget = config?.monthly_budget ?? 0;
  const remainingBudget = monthlyBudget - monthSpent;

  const handleStockUpdate = async (id: string, level: number) => {
    setStockLevels((prev) => ({ ...prev, [id]: level }));
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    await supabase
      .from("pantry_stock_levels")
      .upsert({ item_id: id, level }, { onConflict: "item_id" });
  };

  const handleClearAllStock = async () => {
    setStockLevels({});
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    const ids = items.map((i) => i.id);
    if (ids.length > 0) {
      await supabase.from("pantry_stock_levels").delete().in("item_id", ids);
    }
  };

  const handleScrape = async () => {
    const toBuy = items.filter(
      (i) => i.is_active && suggestedQty(i, stockLevels[i.id] ?? null) > 0,
    );
    if (toBuy.length === 0) return;
    setScraping(true);
    setScrapeMsg("");
    try {
      const payload = {
        items: toBuy.map((i) => ({
          id: i.id,
          name: i.name,
          brand: i.brand,
          package_size: i.package_size,
          package_unit: i.package_unit,
        })),
      };
      const res = await fetch("/api/scrape-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al scrapear");

      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const now = new Date().toISOString();

      // Capturar precios anteriores antes de actualizar (para tendencia)
      const oldPrices: Record<string, number | null> = {};
      for (const p of data.prices) {
        if (p.price) {
          oldPrices[p.id] =
            items.find((i) => i.id === p.id)?.last_price ?? null;
        }
      }

      let updated = 0;
      const historyRecords: {
        item_id: string;
        price: number;
        supermarket: string;
        scraped_at: string;
      }[] = [];
      for (const p of data.prices) {
        if (p.price) {
          await supabase
            .from("pantry_shopping_list_items")
            .update({ last_price: p.price, price_updated_at: now })
            .eq("id", p.id);
          historyRecords.push({
            item_id: p.id,
            price: p.price,
            supermarket: "Jumbo",
            scraped_at: now,
          });
          updated++;
        }
      }

      if (historyRecords.length > 0) {
        await supabase.from("pantry_price_history").insert(historyRecords);
        setPriceHistory((prev) => {
          const next = { ...prev };
          for (const rec of historyRecords) {
            const existing = next[rec.item_id];
            next[rec.item_id] = {
              prevPrice: oldPrices[rec.item_id] ?? null,
              minPrice:
                existing?.minPrice != null
                  ? Math.min(existing.minPrice, rec.price)
                  : rec.price,
            };
          }
          return next;
        });
      }

      setItems((prev) =>
        prev.map((item) => {
          const found = data.prices.find(
            (p: { id: string; price: number | null }) => p.id === item.id,
          );
          if (found?.price) {
            return { ...item, last_price: found.price, price_updated_at: now };
          }
          return item;
        }),
      );

      setScrapeMsg(`${updated} de ${data.prices.length} precios actualizados`);
    } catch (err) {
      setScrapeMsg(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setScraping(false);
    }
  };

  const handleGenerateOptimal = (excluded: Set<string> = new Set()) => {
    const filtered = items.filter((i) => !excluded.has(i.id));
    const knapsackItems = buildKnapsackItems(
      filtered,
      stockLevels,
      suggestedQty,
      formatQty,
    );
    const result = solveKnapsack(knapsackItems, remainingBudget);
    setKnapsackResult(result);
  };

  const handleShareWhatsApp = (result: KnapsackResult) => {
    const date = new Date().toLocaleDateString("es-CL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const lines: string[] = [
      `*Lista Smart Pantry — ${date}*`,
      `Presupuesto: ${formatPrice(result.budget)}`,
      ``,
    ];
    if (result.required.length > 0) {
      lines.push(`*REQUERIDOS*`);
      for (const item of result.required)
        lines.push(
          `• ${item.name} ${item.brand} — ${item.formatQty}${item.cost ? ` → ${formatPrice(item.cost)}` : ""}`,
        );
      lines.push(`_Subtotal: ${formatPrice(result.requiredCost)}_`, ``);
    }
    if (result.included.length > 0) {
      lines.push(`*OPCIONALES*`);
      for (const item of result.included)
        lines.push(
          `• ${item.name} ${item.brand} — ${item.formatQty}${item.cost ? ` → ${formatPrice(item.cost)}` : ""}`,
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
    // pantry_barcode_mappings no tiene FK a purchases — se conserva automáticamente
  };

  const handleBoletaSave = (
    newMappings: Record<string, string>,
    purchase: Purchase,
  ) => {
    setBarcodeMappings((prev) => ({ ...prev, ...newMappings }));
    setPurchases((prev) => [purchase, ...prev]);
  };

  // Calcular próxima fecha de compra (solo client-side para evitar hydration mismatch)
  const [nextShoppingDate, setNextShoppingDate] = useState("—");
  const [nextShoppingDateISO, setNextShoppingDateISO] = useState<string | null>(
    null,
  );

  const toISO = (d: Date) =>
    [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");

  useEffect(() => {
    if (!config) return;
    const today = new Date();
    const shopDay = config.shopping_weekday ?? 4;
    if (today.getDay() === shopDay) {
      setNextShoppingDate(
        today.toLocaleDateString("es-CL", { day: "numeric", month: "long" }),
      );
      setNextShoppingDateISO(toISO(today));
      return;
    }
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const sorted = [...config.shopping_days].sort((a, b) => a - b);
    const nextDay = sorted.find((d) => d > currentDay);
    const target = nextDay
      ? new Date(currentYear, currentMonth, nextDay)
      : new Date(currentYear, currentMonth + 1, sorted[0] ?? 1);
    const daysUntilShopDay = (shopDay - target.getDay() + 7) % 7;
    target.setDate(target.getDate() + daysUntilShopDay);
    setNextShoppingDate(
      target.toLocaleDateString("es-CL", { day: "numeric", month: "long" }),
    );
    setNextShoppingDateISO(toISO(target));
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
      {boletaOpen && (
        <BoletaModal
          items={items}
          barcodeMappings={barcodeMappings}
          onSave={handleBoletaSave}
          onClose={() => setBoletaOpen(false)}
        />
      )}
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
          nextShoppingDate={nextShoppingDate}
          nextShoppingDateISO={nextShoppingDateISO}
        />

        {activeView === "inicio" && (
          <InicioView
            budgetDisplay={budgetDisplay}
            remainingBudget={remainingBudget}
            monthlyBudget={monthlyBudget}
            monthSpent={monthSpent}
            cycleStart={cycleStart}
            nextShoppingDate={nextShoppingDate}
            itemCount={items.length}
            items={items}
            onNavigate={setActiveView}
          />
        )}

        {activeView === "inventario" && (
          <InventarioView
            items={items}
            stockLevels={stockLevels}
            priceHistory={priceHistory}
            onStockUpdate={handleStockUpdate}
            onClearAll={handleClearAllStock}
          />
        )}

        {activeView === "optimizacion" && (
          <OptimizacionView
            items={items}
            stockLevels={stockLevels}
            knapsackResult={knapsackResult}
            priceHistory={priceHistory}
            scraping={scraping}
            scrapeMsg={scrapeMsg}
            monthlyBudget={monthlyBudget}
            lastScrapeTs={lastScrapeTs}
            onScrape={handleScrape}
            onGenerateOptimal={handleGenerateOptimal}
            onShareWhatsApp={handleShareWhatsApp}
            onOpenList={() => setActiveView("mi-lista")}
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
            onOpenBoleta={() => setBoletaOpen(true)}
            onDeletePurchase={handleDeletePurchase}
          />
        )}
      </main>
    </div>
  );
}
