"use client";

import { useState } from "react";
import { Trash2, Search } from "lucide-react";
import { CategoryTabs } from "@/components/CategoryTabs";
import {
  CATEGORY_META,
  sortByCategory,
} from "@/components/shopping-list/constants";
import { STOCK_LEVELS, formatPrice } from "@/utils/stock";
import type { ShoppingListItem, PriceHistorySummary } from "@/types/shopping";

interface InventarioViewProps {
  items: ShoppingListItem[];
  stockLevels: Record<string, number>;
  priceHistory: Record<string, PriceHistorySummary>;
  onStockUpdate: (id: string, level: number) => void;
  onClearAll: () => void;
}

export function InventarioView({
  items,
  stockLevels,
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
        <button
          onClick={onClearAll}
          className="border-border-default text-text-secondary flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-600"
        >
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
            className="border-border-soft bg-bg-card text-text-primary focus:border-greenCustom-400 placeholder:text-text-muted w-full rounded-xl border py-2.5 pr-4 pl-9 text-sm outline-none"
          />
        </div>
      )}

      {/* Item list */}
      <div className="border-border-soft bg-bg-card rounded-2xl border">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-text-muted">Sin productos en esta categoría</p>
          </div>
        ) : (
          filtered.map((item) => {
            const meta =
              CATEGORY_META[item.category] ?? CATEGORY_META["Despensa"];
            const level = stockLevels[item.id] ?? null;
            return (
              <div
                key={item.id}
                className="border-border-soft flex items-center gap-4 border-b px-4 py-3 last:border-0"
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
                    {item.brand && (
                      <span className="text-text-muted text-xs">
                        {item.brand}
                      </span>
                    )}
                    {item.last_price && (
                      <>
                        <span className="text-text-primary text-xs font-semibold">
                          {formatPrice(item.last_price)}
                        </span>
                        {(() => {
                          const t = priceTrend(item.id, item.last_price);
                          return t ? (
                            <span
                              className={`text-[10px] font-bold ${t.up ? "text-red-500" : "text-greenCustom-600"}`}
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

                {/* Stock level selector */}
                <div className="flex shrink-0 gap-1">
                  {STOCK_LEVELS.map((sl) => {
                    const isSelected = level === sl.value;
                    return (
                      <button
                        key={sl.value}
                        onClick={() => onStockUpdate(item.id, sl.value)}
                        className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                          isSelected
                            ? ""
                            : "bg-bg-soft text-text-muted hover:bg-border-soft"
                        }`}
                        style={
                          isSelected
                            ? {
                                background: sl.bg,
                                color: sl.color,
                                outline: `1.5px solid ${sl.bar}`,
                                outlineOffset: "0px",
                              }
                            : {}
                        }
                      >
                        {sl.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
