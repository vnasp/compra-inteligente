"use client";

import { useState } from "react";
import Image from "next/image";
import {
  CircleCheck,
  Zap,
  ShoppingBasket,
  BadgeCheck,
  RefreshCw,
  Sparkles as SparklesIcon,
} from "lucide-react";
import { CATEGORY_META, sortByCategory } from "@/components/ShoppingListPanel";
import {
  suggestedQty,
  formatQty,
  formatPrice,
  STOCK_LEVELS,
} from "@/utils/stock";
import { solveKnapsack, buildKnapsackItems } from "@/utils/knapsack";
import type { KnapsackResult } from "@/utils/knapsack";
import type { ShoppingListItem, PriceHistorySummary } from "@/types/shopping";

type Tab = "requeridos" | "opcionales" | "con_stock";

const TAB_LABELS: Record<Tab, string> = {
  requeridos: "Requeridos",
  opcionales: "Opcionales",
  con_stock: "Con stock",
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} días`;
}

function stockLabel(level: number | null): string {
  return STOCK_LEVELS.find((s) => s.value === level)?.label ?? "Sin escanear";
}

function stockDays(level: number | null): string {
  if (level === null) return "Sin escanear";
  if (level === 0) return "0 días";
  if (level <= 25) return "~5 días";
  if (level <= 50) return "~15 días";
  return "~30 días";
}

interface OptimizacionViewProps {
  items: ShoppingListItem[];
  stockLevels: Record<string, number>;
  knapsackResult: KnapsackResult | null;
  priceHistory: Record<string, PriceHistorySummary>;
  scraping: boolean;
  scrapeMsg: string;
  monthlyBudget: number;
  lastScrapeTs: string | null;
  onScrape: () => void;
  onGenerateOptimal: (excluded: Set<string>) => void;
  onShareWhatsApp: (result: KnapsackResult) => void;
  onOpenList: () => void;
}

export function OptimizacionView({
  items,
  stockLevels,
  knapsackResult,
  priceHistory,
  scraping,
  scrapeMsg,
  monthlyBudget,
  lastScrapeTs,
  onScrape,
  onGenerateOptimal,
  onShareWhatsApp,
  onOpenList,
}: OptimizacionViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>("requeridos");
  const [excludedItems, setExcludedItems] = useState<Set<string>>(new Set());
  const [expandedSection, setExpandedSection] = useState<
    Record<string, boolean>
  >({});
  const [simulatedBudget, setSimulatedBudget] = useState(monthlyBudget);
  const [simulatedResult, setSimulatedResult] = useState<KnapsackResult | null>(
    null,
  );
  const [excludedOpen, setExcludedOpen] = useState(false);

  // ── Datos derivados ─────────────────────────────────────────────────────
  const tabGroups: Record<Tab, ShoppingListItem[]> = {
    requeridos: sortByCategory(items).filter(
      (i) => i.is_required && suggestedQty(i, stockLevels[i.id] ?? null) > 0,
    ),
    opcionales: sortByCategory(items).filter(
      (i) => !i.is_required && suggestedQty(i, stockLevels[i.id] ?? null) > 0,
    ),
    con_stock: sortByCategory(items).filter(
      (i) => !i.is_required && suggestedQty(i, stockLevels[i.id] ?? null) === 0,
    ),
  };
  const currentTabItems = tabGroups[activeTab];
  const PREVIEW = 4;
  const visibleTabItems = expandedSection["tab"]
    ? currentTabItems
    : currentTabItems.slice(0, PREVIEW);

  const displayResult = simulatedResult ?? knapsackResult;
  const selectedItems = displayResult
    ? [...displayResult.required, ...displayResult.included]
    : [];
  const totalNeeded = tabGroups.requeridos.length + tabGroups.opcionales.length;
  const coverage = displayResult
    ? Math.min(
        100,
        Math.round(
          ((displayResult.required.length + displayResult.included.length) /
            Math.max(1, totalNeeded)) *
            100,
        ),
      )
    : 0;
  const estimatedSavings = items.reduce((sum, item) => {
    const hist = priceHistory[item.id];
    if (!hist?.prevPrice || !item.last_price) return sum;
    const drop = hist.prevPrice - item.last_price;
    return drop > 0
      ? sum + drop * suggestedQty(item, stockLevels[item.id] ?? null)
      : sum;
  }, 0);
  const cheaperCount = items.filter((i) => {
    const h = priceHistory[i.id];
    return h?.prevPrice && i.last_price && i.last_price < h.prevPrice;
  }).length;
  const pricedCount = items.filter((i) => i.last_price).length;

  const handleSimulate = () => {
    const kItems = buildKnapsackItems(
      items.filter((i) => !excludedItems.has(i.id)),
      stockLevels,
      suggestedQty,
      formatQty,
    );
    setSimulatedResult(solveKnapsack(kItems, simulatedBudget));
  };

  return (
    <div className="flex h-full gap-6 overflow-hidden p-6">
      {/* ── Columna principal ──────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
        {/* SECCIÓN 1 — Lo que te falta */}
        <div className="border-border-soft bg-bg-card rounded-2xl border p-5">
          <div className="flex items-center gap-1.5">
            <h2 className="text-text-primary text-base font-bold">
              1. Lo que te falta
            </h2>
            <div className="group relative">
              <span className="bg-bg-soft text-text-muted flex h-4 w-4 cursor-help items-center justify-center rounded-full text-[10px] font-bold">
                ?
              </span>
              <div className="bg-text-primary pointer-events-none absolute top-5 left-0 z-20 hidden w-64 rounded-xl p-3 text-xs text-white shadow-lg group-hover:block">
                <p>
                  <span className="font-bold">Requeridos:</span> siempre los
                  compras, sin importar el presupuesto.
                </p>
                <p className="mt-1">
                  <span className="font-bold">Por reponer:</span> opcionales con
                  stock bajo — entran si alcanza.
                </p>
                <p className="mt-1">
                  <span className="font-bold">En stock:</span> opcionales bien
                  cubiertos — no son urgentes.
                </p>
              </div>
            </div>
          </div>
          <p className="text-text-muted mt-0.5 text-sm">
            Revisa y ajusta lo que realmente necesitas.
          </p>

          {/* Tabs */}
          <div className="mt-4 flex gap-2">
            {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setExpandedSection((p) => ({ ...p, tab: false }));
                }}
                className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === tab
                    ? "bg-greenCustom-700 text-white"
                    : "bg-bg-soft text-text-muted hover:bg-greenCustom-100 hover:text-greenCustom-700"
                }`}
              >
                {TAB_LABELS[tab]} ({tabGroups[tab].length})
              </button>
            ))}
          </div>

          {/* Lista de items */}
          <div className="divide-border-soft mt-4 flex flex-col divide-y">
            {visibleTabItems.length === 0 ? (
              <p className="text-text-muted py-6 text-center text-sm">
                {activeTab === "con_stock"
                  ? "Todo está bien cubierto, no hay urgencia de compra."
                  : "Sin productos en esta categoría."}
              </p>
            ) : (
              visibleTabItems.map((item) => {
                const meta =
                  CATEGORY_META[item.category] ?? CATEGORY_META["Despensa"];
                const level = stockLevels[item.id] ?? null;
                const qty = suggestedQty(item, level);

                const isExcluded = excludedItems.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 py-3 ${isExcluded ? "opacity-40" : ""}`}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                      style={{ background: meta.bg }}
                    >
                      {meta.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-text-primary truncate text-sm font-semibold">
                        {item.name}
                        {item.brand ? ` ${item.brand}` : ""}
                      </p>
                      <p className="text-text-muted text-[11px]">
                        Stock: {stockLabel(level)} · {stockDays(level)}
                      </p>
                    </div>

                    <span className="bg-bg-soft text-text-primary shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold">
                      {formatQty(item, qty)}
                    </span>
                    <button
                      onClick={() =>
                        setExcludedItems((prev) => {
                          const n = new Set(prev);
                          if (n.has(item.id)) {
                            n.delete(item.id);
                          } else {
                            n.add(item.id);
                          }
                          return n;
                        })
                      }
                      className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 transition-all ${isExcluded ? "border-border-default bg-white" : "border-greenCustom-600 bg-greenCustom-600"}`}
                    >
                      {!isExcluded && (
                        <svg
                          className="h-3.5 w-3.5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {currentTabItems.length > PREVIEW && (
            <button
              onClick={() =>
                setExpandedSection((p) => ({ ...p, tab: !p["tab"] }))
              }
              className="text-greenCustom-600 hover:text-greenCustom-700 mt-3 flex w-full cursor-pointer items-center justify-center gap-1 text-xs font-semibold"
            >
              {expandedSection["tab"]
                ? "Ver menos ↑"
                : `Ver todos los ${currentTabItems.length} ${TAB_LABELS[activeTab].toLowerCase()} ↓`}
            </button>
          )}
        </div>

        {/* SECCIÓN 2 — Mejor combinación */}
        <div className="border-border-soft bg-bg-card rounded-2xl border p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-text-primary text-base font-bold">
                2. Mejor combinación para ti
              </h2>
              {displayResult && (
                <span className="bg-greenCustom-100 text-greenCustom-700 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                  <SparklesIcon className="h-3 w-3" strokeWidth={2} />{" "}
                  Optimización activa
                </span>
              )}
              {simulatedResult && (
                <span className="bg-tag-important-bg text-tag-important-text rounded-full px-2.5 py-1 text-[11px] font-semibold">
                  Simulado · {formatPrice(simulatedBudget)}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setSimulatedResult(null);
                onGenerateOptimal(excludedItems);
              }}
              disabled={items.length === 0}
              className="border-border-default bg-bg-soft text-text-primary hover:bg-greenCustom-100 hover:text-greenCustom-700 flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all disabled:opacity-40"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} /> Recalcular
            </button>
          </div>
          <p className="text-text-muted mt-1 text-sm">
            Seleccionamos la mejor combinación según tu presupuesto y
            prioridades.
          </p>

          {!displayResult ? (
            <div className="mt-6 flex flex-col items-center gap-2 py-8">
              <p className="text-text-secondary font-medium">
                Genera la lista óptima para ver la mejor combinación
              </p>
              <p className="text-text-muted text-xs">
                Actualiza precios primero, luego haz clic en Recalcular
              </p>
              <button
                onClick={() => onGenerateOptimal(excludedItems)}
                disabled={items.length === 0}
                className="bg-button-primary mt-3 cursor-pointer rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
              >
                Generar Lista Óptima
              </button>
            </div>
          ) : (
            <>
              <div className="mt-4 flex gap-4">
                {/* Stats card */}
                <div className="bg-greenCustom-100 w-52 shrink-0 rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⭐</span>
                    <span className="text-greenCustom-800 text-sm font-bold">
                      {coverage >= 90
                        ? "Muy buena elección"
                        : coverage >= 70
                          ? "Buena cobertura"
                          : "Cobertura parcial"}
                    </span>
                  </div>
                  <p className="text-greenCustom-700 mt-2 text-xs leading-snug">
                    Logramos cubrir el {coverage}% de tus necesidades usando
                    inteligentemente tu presupuesto.
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                    {[
                      {
                        label: "Usado",
                        value: formatPrice(displayResult.totalCost),
                        cls: "text-text-primary",
                      },
                      {
                        label: "Ahorro est.",
                        value:
                          estimatedSavings > 0
                            ? formatPrice(estimatedSavings)
                            : "$0",
                        cls: "text-greenCustom-600",
                      },
                      {
                        label: "Cobertura",
                        value: `${coverage}%`,
                        cls: "text-text-primary",
                      },
                    ].map(({ label, value, cls }) => (
                      <div key={label}>
                        <p className="text-greenCustom-700 text-[10px]">
                          {label}
                        </p>
                        <p className={`text-xs font-bold ${cls}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-greenCustom-200 mt-3 h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-greenCustom-700 h-full rounded-full transition-all"
                      style={{ width: `${coverage}%` }}
                    />
                  </div>
                </div>

                {/* Productos seleccionados */}
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary mb-3 text-sm font-semibold">
                    Productos seleccionados ({selectedItems.length})
                  </p>
                  <div className="divide-border-soft flex flex-col divide-y">
                    {(expandedSection["selected"]
                      ? selectedItems
                      : selectedItems.slice(0, 3)
                    ).map((kItem) => {
                      const fullItem = items.find((i) => i.id === kItem.id);
                      const meta = fullItem
                        ? (CATEGORY_META[fullItem.category] ??
                          CATEGORY_META["Despensa"])
                        : null;
                      const hist = priceHistory[kItem.id];
                      const isCheapest =
                        hist?.minPrice != null &&
                        fullItem?.last_price === hist.minPrice;
                      const savings =
                        hist?.prevPrice &&
                        fullItem?.last_price &&
                        hist.prevPrice > fullItem.last_price
                          ? hist.prevPrice - fullItem.last_price
                          : 0;
                      return (
                        <div
                          key={kItem.id}
                          className="flex items-center gap-3 py-2.5"
                        >
                          {meta && (
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
                              style={{ background: meta.bg }}
                            >
                              {meta.icon}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-text-primary truncate text-sm font-medium">
                              {kItem.name} {kItem.brand}
                            </p>
                            <p className="text-text-muted text-[11px]">
                              {kItem.formatQty}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-text-primary text-sm font-bold">
                              {kItem.cost ? formatPrice(kItem.cost) : "—"}
                            </p>
                            {isCheapest && (
                              <span className="bg-greenCustom-100 text-greenCustom-600 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                                Mejor precio
                              </span>
                            )}
                            {!isCheapest && savings > 0 && (
                              <span className="bg-tag-important-bg text-tag-important-text rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                                Ahorro {formatPrice(savings)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedItems.length > 3 && (
                    <button
                      onClick={() =>
                        setExpandedSection((p) => ({
                          ...p,
                          selected: !p["selected"],
                        }))
                      }
                      className="text-greenCustom-600 hover:text-greenCustom-700 mt-2 flex cursor-pointer items-center gap-1 text-xs font-semibold"
                    >
                      {expandedSection["selected"]
                        ? "Ver menos ↑"
                        : `Ver todos los ${selectedItems.length} productos ↓`}
                    </button>
                  )}
                </div>
              </div>

              {/* Excluidos */}
              {displayResult.excluded.length > 0 && (
                <div className="border-border-soft mt-4 border-t pt-4">
                  <button
                    onClick={() => setExcludedOpen(!excludedOpen)}
                    className="text-text-muted flex w-full cursor-pointer items-center gap-1 text-[11px] font-semibold"
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
                    No incluidos por presupuesto (
                    {displayResult.excluded.length})
                  </button>
                  {excludedOpen && (
                    <div className="divide-border-soft mt-2 flex flex-col divide-y opacity-60">
                      {displayResult.excluded.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between py-2"
                        >
                          <p className="text-text-muted text-xs line-through">
                            {item.name} — {item.formatQty}
                          </p>
                          <span className="text-text-muted text-xs">
                            {item.cost ? formatPrice(item.cost) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => onGenerateOptimal(excludedItems)}
                  disabled={items.length === 0}
                  className="bg-button-primary flex-1 cursor-pointer rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                >
                  Generar Lista Óptima
                </button>
                <button
                  onClick={() => onShareWhatsApp(displayResult)}
                  className="flex-1 cursor-pointer rounded-xl bg-[#25D366] py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                >
                  Compartir WhatsApp
                </button>
              </div>
            </>
          )}

          {/* Simulador */}
          <div className="border-border-soft mt-5 border-t pt-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-text-primary text-sm font-semibold">
                  Simular con otro presupuesto
                </p>
                <p className="text-text-muted text-xs">
                  Ajusta y ve cómo cambia tu combinación.
                </p>
              </div>
              <span className="text-text-primary text-base font-bold">
                {formatPrice(simulatedBudget)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={50000}
                max={Math.round((monthlyBudget * 1.5) / 5000) * 5000}
                step={5000}
                value={simulatedBudget}
                onChange={(e) => {
                  setSimulatedBudget(Number(e.target.value));
                  setSimulatedResult(null);
                }}
                className="accent-greenCustom-700 flex-1"
              />
              <button
                onClick={handleSimulate}
                disabled={items.length === 0}
                className="border-border-default bg-bg-soft text-text-primary hover:border-greenCustom-200 hover:bg-greenCustom-100 hover:text-greenCustom-700 cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition-all disabled:opacity-40"
              >
                Simular
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Panel derecho ───────────────────────────────────────────────── */}
      <div className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto">
        {/* Card 1: Precios */}
        <div className="border-border-soft bg-bg-card rounded-2xl border p-4">
          <h3 className="text-text-primary mb-3 font-bold">
            Precios actualizados
          </h3>
          <div className="bg-bg-soft flex items-center gap-3 rounded-xl px-3 py-2.5">
            <div className="bg-greenCustom-700 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white">
              J
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-text-primary text-sm font-semibold">Jumbo</p>
              <p className="text-text-muted truncate text-[11px]">
                {lastScrapeTs
                  ? `Actualizado ${timeAgo(lastScrapeTs)}`
                  : "Sin actualizar aún"}
              </p>
            </div>
            <CircleCheck
              className={`h-5 w-5 shrink-0 ${lastScrapeTs ? "text-greenCustom-600" : "text-text-muted"}`}
              strokeWidth={1.75}
            />
          </div>
          <button
            onClick={onScrape}
            disabled={scraping}
            className="bg-greenCustom-700 hover:bg-greenCustom-800 mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${scraping ? "animate-spin" : ""}`}
              strokeWidth={2}
            />
            {scraping ? "Actualizando…" : "Actualizar precios"}
          </button>
          {scrapeMsg && (
            <p className="text-text-muted mt-2 text-center text-[11px]">
              {scrapeMsg}
            </p>
          )}
          {lastScrapeTs && !scrapeMsg && (
            <p className="text-text-muted mt-2 text-center text-[11px]">
              Última actualización completa: {timeAgo(lastScrapeTs)}
            </p>
          )}
        </div>

        {/* Card 2: Insights */}
        <div className="border-border-soft bg-bg-card rounded-2xl border p-4">
          <h3 className="text-text-primary mb-3 font-bold">Insights para ti</h3>
          <div className="flex flex-col gap-3">
            {cheaperCount > 0 && (
              <div className="flex items-start gap-3">
                <div className="bg-tag-important-bg flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                  <Zap
                    className="text-tag-important-text h-4 w-4"
                    strokeWidth={2}
                  />
                </div>
                <div>
                  <p className="text-text-primary text-xs font-semibold">
                    Comprar hoy te ahorra{" "}
                    {estimatedSavings > 0
                      ? formatPrice(estimatedSavings)
                      : "dinero"}
                  </p>
                  <p className="text-text-muted text-[11px]">
                    {cheaperCount} producto{cheaperCount > 1 ? "s" : ""} más
                    barato{cheaperCount > 1 ? "s" : ""} que la semana pasada.
                  </p>
                </div>
              </div>
            )}
            {displayResult && coverage > 0 && (
              <div className="flex items-start gap-3">
                <div className="bg-greenCustom-100 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                  <BadgeCheck
                    className="text-greenCustom-700 h-4 w-4"
                    strokeWidth={2}
                  />
                </div>
                <div>
                  <p className="text-text-primary text-xs font-semibold">
                    Cubre el {coverage}% de tus necesidades
                  </p>
                  <p className="text-text-muted text-[11px]">
                    Tu presupuesto cubre bien la canasta del mes.
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <div className="bg-greenCustom-100 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                <ShoppingBasket
                  className="text-greenCustom-700 h-4 w-4"
                  strokeWidth={2}
                />
              </div>
              <div>
                <p className="text-text-primary text-xs font-semibold">
                  Jumbo tiene los mejores precios
                </p>
                <p className="text-text-muted text-[11px]">
                  En {pricedCount} de {items.length} productos actualizados.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: CTA manual */}
        <div className="border-greenCustom-200 bg-greenCustom-100 flex items-center gap-3 rounded-2xl border p-4">
          <Image
            src="/icon_right.png"
            alt=""
            width={72}
            height={72}
            className="aspect-square shrink-0"
            loading="eager"
          />
          <div>
            <p className="text-text-primary text-sm font-semibold">
              ¿Prefieres armar tu lista manualmente?
            </p>
            <button
              onClick={onOpenList}
              className="text-greenCustom-600 hover:text-greenCustom-700 mt-1 cursor-pointer text-xs font-semibold"
            >
              Ir a lista sugerida →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
