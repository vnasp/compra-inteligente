"use client";

import { useState } from "react";
import { Trash2, Search } from "lucide-react";
import { CategoryTabs } from "@/components/CategoryTabs";
import {
  CATEGORY_META,
  sortByCategory,
} from "@/components/shopping-list/constants";
import {
  suggestedQty,
  stockRatio,
  stockAppearance,
  stockUnit,
  formatAmount,
  formatPrice,
} from "@/utils/stock";
import type { ShoppingListItem, PriceHistorySummary } from "@/types/shopping";

interface InventarioViewProps {
  items: ShoppingListItem[];
  stockRemaining: Record<string, number>;
  priceHistory: Record<string, PriceHistorySummary>;
  onStockUpdate: (id: string, remaining: number) => void;
  onClearAll: () => void;
}

export function InventarioView({
  items,
  stockRemaining,
  priceHistory,
  onStockUpdate,
  onClearAll,
}: InventarioViewProps) {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [search, setSearch] = useState("");

  const sorted = sortByCategory(items);
  const byCategory =
    activeCategory === "Todos"
      ? sorted
      : sorted.filter((i) => i.category === activeCategory);
  const filtered =
    activeCategory === "Todos" && search.trim()
      ? byCategory.filter((i) =>
          i.name.toLowerCase().includes(search.toLowerCase()),
        )
      : byCategory;

  const priceTrend = (itemId: string, currentPrice: number | null) => {
    if (!currentPrice) return null;
    const prev = priceHistory[itemId]?.prevPrice;
    if (!prev) return null;
    const diff = Math.round(((currentPrice - prev) / prev) * 100);
    if (diff === 0) return null;
    return { diff, up: diff > 0 };
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-text-primary text-2xl font-bold">Inventario</h1>
          <p className="text-text-secondary mt-1 text-sm">
            {items.length} productos en tu lista
          </p>
        </div>
        <button onClick={onClearAll} className="button-danger">
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          Limpiar stock
        </button>
      </div>

      {/* Category tabs */}
      <div className="mb-3">
        <CategoryTabs
          items={items}
          activeCategory={activeCategory}
          onSelect={(cat) => {
            setActiveCategory(cat);
            setSearch("");
          }}
        />
      </div>

      {/* Search — only in Todos tab */}
      {activeCategory === "Todos" && (
        <div className="relative mb-4">
          <Search
            className="text-text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            strokeWidth={1.75}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="input-field placeholder:text-text-muted py-2.5 pr-4 pl-9"
          />
        </div>
      )}

      {/* Item list */}
      <div className="app-panel">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-text-muted">Sin productos en esta categoría</p>
          </div>
        ) : (
          filtered.map((item) => {
            const meta =
              CATEGORY_META[item.category] ?? CATEGORY_META["Despensa"];
            const quantity = item.quantity;
            const remaining = stockRemaining[item.id] ?? 0;
            // Envases/unidades enteras → paso 1; a granel (kg, L…) → paso 0,5.
            const step = item.package_size || item.unit === "un" ? 1 : 0.5;
            const round = (n: number) => Math.round(n * 1000) / 1000;
            const setRemaining = (v: number) =>
              onStockUpdate(item.id, round(Math.max(0, Math.min(quantity, v))));
            const ratio = stockRatio(remaining, quantity);
            const appearance = stockAppearance(ratio);
            const toBuy = suggestedQty(item, remaining, 0);
            const unit = stockUnit(item);
            return (
              <div
                key={item.id}
                className="app-row flex items-center gap-4 border-b px-4 py-3 last:border-0"
              >
                {/* Icon */}
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
                  style={{ background: meta.bg }}
                >
                  {meta.icon}
                </div>

                {/* Name + meta */}
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary truncate font-semibold">
                    {item.name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    {item.last_price && (
                      <>
                        <span className="text-text-primary text-xs font-semibold">
                          {formatPrice(item.last_price)}
                        </span>
                        {(() => {
                          const t = priceTrend(item.id, item.last_price);
                          return t ? (
                            <span
                              className={`text-[10px] font-bold ${t.up ? "text-warning" : "text-success"}`}
                            >
                              {t.up ? "↑" : "↓"}
                              {Math.abs(t.diff)}%
                            </span>
                          ) : null;
                        })()}
                      </>
                    )}
                  </div>
                </div>

                {/* Stock restante: cuánto te queda hoy (0 → objetivo mensual) */}
                <div className="flex w-52 shrink-0 flex-col items-end gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted text-[11px]">
                      Te queda
                    </span>
                    <div className="app-row flex items-center gap-1 rounded-full border px-1 py-0.5">
                      <button
                        onClick={() => setRemaining(remaining - step)}
                        disabled={remaining <= 0}
                        className="text-text-secondary hover:bg-bg-soft flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-base leading-none disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Menos"
                      >
                        −
                      </button>
                      <span className="min-w-18 text-center text-sm font-bold">
                        <span className="text-text-primary">
                          {formatAmount(remaining)}
                        </span>
                        <span className="text-text-muted text-[11px] font-medium">
                          {" "}
                          / {formatAmount(quantity)} {unit}
                        </span>
                      </span>
                      <button
                        onClick={() => setRemaining(remaining + step)}
                        disabled={remaining >= quantity}
                        className="text-text-secondary hover:bg-bg-soft flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-base leading-none disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Más"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="bg-bg-soft h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${ratio * 100}%`,
                        background: appearance.bar,
                      }}
                    />
                  </div>
                  <span
                    className={`text-[11px] font-semibold ${toBuy > 0 ? "text-warning" : "text-success"}`}
                  >
                    {toBuy > 0
                      ? `Comprar ${toBuy} ${unit}`
                      : "Completo para el mes"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
