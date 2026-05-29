"use client";

import { useState, useEffect } from "react";
import {
  ShoppingListPanel,
  INITIAL_ITEMS,
  CATEGORY_META,
  sortByCategory,
} from "@/components/ShoppingListPanel";
import { ConfigPanel } from "@/components/ConfigPanel";
import { EscanearDespensa } from "@/components/EscanearDespensa";
import { RegistrarCompra } from "@/components/RegistrarCompra";
import { Card, StockBadge } from "@/components/ui";
import { suggestedQty, formatQty, formatPrice } from "@/utils/stock";
import { solveKnapsack, buildKnapsackItems } from "@/utils/knapsack";
import type { KnapsackResult } from "@/utils/knapsack";
import type { ShoppingListItem, UserConfig, Purchase } from "@/types/shopping";

// ── Página principal ───────────────────────────────────────────────────
export default function Dashboard() {
  const [items, setItems] = useState<ShoppingListItem[]>(INITIAL_ITEMS);
  const [stockLevels, setStockLevels] = useState<Record<string, number>>({});
  const [scanOpen, setScanOpen] = useState(false);
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState("");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [knapsackResult, setKnapsackResult] = useState<KnapsackResult | null>(
    null,
  );
  const [excludedOpen, setExcludedOpen] = useState(false);

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

  // Cargar compras del mes actual
  useEffect(() => {
    const load = async () => {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const { data } = await supabase
        .from("pantry_purchases")
        .select("*")
        .gte("purchased_at", firstDay)
        .order("purchased_at", { ascending: false });
      if (data) setPurchases(data as Purchase[]);
    };
    load();
  }, []);

  const monthSpent = purchases.reduce((s, p) => s + p.amount, 0);
  const monthlyBudget = config?.monthly_budget ?? 150000;
  const remainingBudget = monthlyBudget - monthSpent;

  const handleStockUpdate = async (id: string, level: number) => {
    setStockLevels((prev) => ({ ...prev, [id]: level }));
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    await supabase
      .from("pantry_stock_levels")
      .upsert({ item_id: id, level }, { onConflict: "item_id" });
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

      let updated = 0;
      for (const p of data.prices) {
        if (p.price) {
          await supabase
            .from("pantry_shopping_list_items")
            .update({ last_price: p.price, price_updated_at: now })
            .eq("id", p.id);
          updated++;
        }
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

  const handleGenerateOptimal = () => {
    const knapsackItems = buildKnapsackItems(
      items,
      stockLevels,
      suggestedQty,
      formatQty,
    );
    const result = solveKnapsack(knapsackItems, remainingBudget);
    setKnapsackResult(result);
    setExcludedOpen(false);
  };

  const handleAddPurchase = (purchase: Purchase) => {
    setPurchases((prev) => [purchase, ...prev]);
  };

  // Calcular próxima fecha de compra (solo client-side para evitar hydration mismatch)
  const [nextShoppingDate, setNextShoppingDate] = useState("—");

  useEffect(() => {
    if (!config) return;
    const today = new Date();
    // Si hoy es jueves (4), la próxima compra es hoy mismo
    if (today.getDay() === 4) {
      setNextShoppingDate(
        today.toLocaleDateString("es-CL", { day: "numeric", month: "long" }),
      );
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
    // Ajustar al próximo jueves (0=Dom, 4=Jue)
    const daysUntilThursday = (4 - target.getDay() + 7) % 7;
    target.setDate(target.getDate() + daysUntilThursday);
    setNextShoppingDate(
      target.toLocaleDateString("es-CL", { day: "numeric", month: "long" }),
    );
  }, [config]);

  const [budgetDisplay, setBudgetDisplay] = useState("—");

  useEffect(() => {
    setBudgetDisplay(`$${remainingBudget.toLocaleString("es-CL")}`);
  }, [remainingBudget]);

  return (
    <div className="min-h-screen bg-slate-50">
      <ShoppingListPanel items={items} setItems={setItems} />
      <ConfigPanel config={config} setConfig={setConfig} />
      {scanOpen && (
        <EscanearDespensa
          items={items}
          stockLevels={stockLevels}
          onUpdate={handleStockUpdate}
          onClose={() => setScanOpen(false)}
        />
      )}
      {purchaseOpen && (
        <RegistrarCompra
          supermarkets={config?.supermarkets ?? []}
          onSave={handleAddPurchase}
          onClose={() => setPurchaseOpen(false)}
        />
      )}

      {/* ── Navbar ── */}
      <header className="flex items-center justify-between bg-linear-to-r from-slate-800 via-slate-700 to-indigo-600 px-8 py-3.5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/20">
            <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight">
            Compra Inteligente
          </span>
        </div>

        <div className="flex items-center gap-10 text-sm">
          {[
            {
              label: "Presupuesto Restante",
              value: budgetDisplay,
              warn: remainingBudget < 0,
            },
            {
              label: "Gastado este mes",
              value: `$${monthSpent.toLocaleString("es-CL")}`,
              warn: false,
            },
            { label: "Próxima Compra", value: nextShoppingDate, warn: false },
          ].map(({ label, value, warn }) => (
            <div key={label} className="text-center">
              <p className="mb-0.5 text-xs tracking-wide text-slate-300 uppercase">
                {label}
              </p>
              <p
                className={`text-sm font-bold ${warn ? "text-red-300" : "text-white"}`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button className="flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-80">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-slate-300 to-slate-400 text-sm font-bold text-slate-700 shadow">
              VM
            </div>
            <svg
              className="h-4 w-4 text-slate-300"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Grid principal ── */}
      <main className="mx-auto grid max-w-7xl grid-cols-3 gap-5 p-6">
        {/* ══ Columna Izquierda ══ */}
        <div className="flex flex-col gap-5">
          {/* Inventario Actual */}
          <Card className="p-5">
            <h2 className="mb-4 text-base font-bold text-slate-800">
              Inventario Actual
            </h2>

            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-xs text-slate-400">
                    Tu inventario está vacío — agrega productos desde{" "}
                    <span className="font-semibold text-indigo-500">
                      Mi Lista
                    </span>
                  </p>
                </div>
              ) : (
                sortByCategory(items).map((item) => {
                  const meta =
                    CATEGORY_META[item.category] ?? CATEGORY_META["Despensa"];
                  const level = stockLevels[item.id] ?? null;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-2.5 border-b border-slate-50 px-1 py-2 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm leading-tight font-bold text-slate-700">
                          {item.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {item.brand && (
                            <span className="text-[11px] text-slate-400">
                              {item.brand}
                            </span>
                          )}
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                            style={{ background: meta.bg, color: "#64748B" }}
                          >
                            {meta.icon} {item.category}
                          </span>
                          {item.last_price && (
                            <span className="text-[10px] font-semibold">
                              {formatPrice(item.last_price)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                        <StockBadge level={level} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={() => setScanOpen(true)}
              className="mt-4 w-full cursor-pointer rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 active:bg-indigo-800"
            >
              Actualizar Despensa
            </button>
          </Card>

          {/* Historial de Compras */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">
                Compras del Mes
              </h2>
              <button
                onClick={() => setPurchaseOpen(true)}
                className="cursor-pointer rounded-lg bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                + Registrar
              </button>
            </div>

            {purchases.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-xs text-slate-400">
                  No hay compras registradas este mes
                </p>
              </div>
            ) : (
              <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
                {purchases.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        ${p.amount.toLocaleString("es-CL")}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400">
                          {p.supermarket}
                        </span>
                        {p.tag && (
                          <span className="text-[11px] text-indigo-500">
                            · {p.tag}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {new Date(
                        p.purchased_at + "T12:00:00",
                      ).toLocaleDateString("es-CL", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Resumen */}
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-400">Total gastado</span>
              <span className="text-sm font-bold text-slate-800">
                ${monthSpent.toLocaleString("es-CL")}
              </span>
            </div>
          </Card>
        </div>

        {/* ══ Columna Central ══ */}
        <div className="flex flex-col">
          <Card className="flex max-h-[calc(100dvh-6rem)] flex-col p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">
                Lista de Compras Sugerida
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-400">
                {
                  items.filter(
                    (i) => suggestedQty(i, stockLevels[i.id] ?? null) > 0,
                  ).length
                }{" "}
                productos
              </span>
            </div>

            {/* Aviso si no hay nada escaneado */}
            {Object.keys(stockLevels).length === 0 && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs leading-snug text-slate-600">
                  <span className="font-semibold">Tip:</span> Escanea tu
                  despensa para obtener sugerencias ajustadas. Por ahora se
                  muestra la lista completa.
                </p>
              </div>
            )}

            <div className="flex flex-1 flex-col overflow-y-auto">
              {items.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  Agrega productos a tu lista de compras
                </p>
              ) : (
                sortByCategory(items)
                  .filter(
                    (item) =>
                      suggestedQty(item, stockLevels[item.id] ?? null) > 0,
                  )
                  .map((item) => {
                    const meta =
                      CATEGORY_META[item.category] ?? CATEGORY_META["Despensa"];
                    const level = stockLevels[item.id] ?? null;
                    const qty = suggestedQty(item, level);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0"
                      >
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm"
                          style={{ background: meta.bg }}
                        >
                          {meta.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-700">
                            {item.name}
                          </p>
                          <div className="flex items-center gap-1.5">
                            {item.brand && (
                              <p className="text-[11px] text-slate-400">
                                {item.brand}
                              </p>
                            )}
                            {item.last_price && (
                              <span className="text-[11px] font-semibold text-indigo-600">
                                {formatPrice(item.last_price)}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                          {formatQty(item, qty)}
                        </span>
                      </div>
                    );
                  })
              )}
            </div>

            <button
              onClick={handleScrape}
              disabled={scraping || items.length === 0}
              className="mt-5 w-full cursor-pointer rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 active:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {scraping ? "Buscando precios…" : "Actualizar Precios"}
            </button>
            {scrapeMsg && (
              <p className="mt-2 text-center text-xs text-slate-500">
                {scrapeMsg}
              </p>
            )}
          </Card>
        </div>

        {/* ══ Columna Derecha — Lista Óptima ══ */}
        <div className="flex flex-col gap-5">
          <Card className="flex flex-col p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">
                Lista Óptima
              </h2>
              {knapsackResult && (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    knapsackResult.overBudget
                      ? "bg-red-50 text-red-600"
                      : "bg-indigo-50 text-indigo-700"
                  }`}
                >
                  {formatPrice(knapsackResult.totalCost)} /{" "}
                  {formatPrice(knapsackResult.budget)}
                </span>
              )}
            </div>

            {!knapsackResult ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-slate-500">
                  Optimiza tu compra según el presupuesto
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Actualiza precios primero, luego genera la lista
                </p>
              </div>
            ) : (
              <div className="flex max-h-[calc(100dvh-16rem)] flex-col gap-3 overflow-y-auto">
                {/* Warning si presupuesto insuficiente */}
                {knapsackResult.overBudget && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3">
                    <p className="text-xs leading-snug text-red-700">
                      <span className="font-semibold">Atención:</span> Los
                      productos requeridos (
                      {formatPrice(knapsackResult.requiredCost)}) exceden el
                      presupuesto restante ({formatPrice(knapsackResult.budget)}
                      ).
                    </p>
                  </div>
                )}

                {/* Requeridos */}
                {knapsackResult.required.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                      Requeridos ({knapsackResult.required.length})
                    </p>
                    {knapsackResult.required.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between border-b border-slate-50 py-2 last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-700">
                            {item.name}
                          </p>
                          <span className="text-[11px] text-slate-400">
                            {item.brand} · {item.formatQty}
                          </span>
                        </div>
                        <span className="shrink-0 text-xs font-bold text-slate-800">
                          {item.cost ? formatPrice(item.cost) : "Sin precio"}
                        </span>
                      </div>
                    ))}
                    <div className="mt-1 flex justify-end">
                      <span className="text-[11px] font-semibold text-slate-500">
                        Subtotal: {formatPrice(knapsackResult.requiredCost)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Opcionales incluidos */}
                {knapsackResult.included.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-bold tracking-wider text-indigo-600 uppercase">
                      Opcionales incluidos ({knapsackResult.included.length})
                    </p>
                    {knapsackResult.included.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between border-b border-slate-50 py-2 last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-700">
                            {item.name}
                          </p>
                          <span className="text-[11px] text-slate-400">
                            {item.brand} · {item.formatQty}
                          </span>
                        </div>
                        <span className="shrink-0 text-xs font-bold text-indigo-600">
                          {item.cost ? (
                            formatPrice(item.cost)
                          ) : (
                            <span className="text-slate-400">Sin precio</span>
                          )}
                        </span>
                      </div>
                    ))}
                    <div className="mt-1 flex justify-end">
                      <span className="text-[11px] font-semibold text-slate-500">
                        Subtotal: {formatPrice(knapsackResult.includedCost)}
                      </span>
                    </div>
                  </div>
                )}

                {/* No incluidos (colapsable) */}
                {knapsackResult.excluded.length > 0 && (
                  <div>
                    <button
                      onClick={() => setExcludedOpen(!excludedOpen)}
                      className="mb-2 flex w-full cursor-pointer items-center gap-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase"
                    >
                      <svg
                        className={`h-3 w-3 transition-transform ${excludedOpen ? "rotate-90" : ""}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      No incluidos ({knapsackResult.excluded.length})
                    </button>
                    {excludedOpen &&
                      knapsackResult.excluded.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between border-b border-slate-50 py-2 opacity-50 last:border-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-slate-500 line-through">
                              {item.name}
                            </p>
                            <span className="text-[11px] text-slate-400">
                              {item.formatQty}
                            </span>
                          </div>
                          <span className="shrink-0 text-xs text-slate-400">
                            {item.cost ? formatPrice(item.cost) : "—"}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleGenerateOptimal}
              disabled={items.length === 0}
              className="mt-5 w-full cursor-pointer rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 active:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generar Lista Óptima
            </button>
          </Card>
        </div>
      </main>
    </div>
  );
}
