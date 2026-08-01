"use client";

import { CATEGORY_META } from "@/components/shopping-list/constants";
import { formatPrice } from "@/utils/stock";
import type { ShoppingListItem } from "@/types/shopping";
import type { KnapsackResult } from "@/utils/knapsack";

interface Props {
  items: ShoppingListItem[];
  knapsackResult: KnapsackResult | null;
  monthlyBudget: number;
  monthSpent: number;
  onClose: () => void;
}

export function ShoppingAnalysis({
  items,
  knapsackResult,
  monthlyBudget,
  monthSpent,
  onClose,
}: Props) {
  // Categoría por id para lookup rápido
  const categoryById = Object.fromEntries(items.map((i) => [i.id, i.category]));

  // Desglose por categoría basado en la lista óptima (lo que se planificó comprar)
  const byCategory: Record<string, number> = {};
  let totalOptimal = 0;

  if (knapsackResult) {
    for (const item of [
      ...knapsackResult.required,
      ...knapsackResult.included,
    ]) {
      if (!item.cost) continue;
      const cat = categoryById[item.id] ?? "Despensa";
      byCategory[cat] = (byCategory[cat] ?? 0) + item.cost;
      totalOptimal += item.cost;
    }
  }

  const sorted = Object.entries(byCategory).sort(([, a], [, b]) => b - a);
  const maxCost = sorted[0]?.[1] ?? 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="app-modal w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-text-primary text-lg font-bold">
            Análisis de Gasto
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:bg-bg-soft hover:text-text-primary flex h-7 w-7 cursor-pointer items-center justify-center rounded-full"
          >
            ✕
          </button>
        </div>

        {/* Resumen presupuesto */}
        <div className="mb-5 grid grid-cols-3 gap-2">
          {[
            { label: "Presupuesto", value: formatPrice(monthlyBudget) },
            { label: "Gastado", value: formatPrice(monthSpent) },
            {
              label: "Lista óptima",
              value: knapsackResult ? formatPrice(totalOptimal) : "—",
            },
          ].map(({ label, value }) => (
            <div key={label} className="stat-card p-3 text-center">
              <p className="text-text-muted mb-0.5 text-[10px] tracking-wide uppercase">
                {label}
              </p>
              <p className="text-text-primary text-sm font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* Barra de presupuesto gastado */}
        {monthlyBudget > 0 && (
          <div className="mb-5">
            <div className="text-text-muted mb-1 flex justify-between text-[11px]">
              <span>Gastado del mes</span>
              <span>{Math.round((monthSpent / monthlyBudget) * 100)}%</span>
            </div>
            <div className="bg-bg-soft h-2 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full transition-all ${
                  monthSpent > monthlyBudget ? "bg-danger" : "bg-brand-700"
                }`}
                style={{
                  width: `${Math.min((monthSpent / monthlyBudget) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Barras por categoría */}
        <p className="text-text-muted mb-3 text-[11px] font-bold tracking-wider uppercase">
          Lista óptima por categoría
        </p>

        {!knapsackResult ? (
          <p className="text-text-muted py-4 text-center text-sm">
            Genera la lista óptima primero para ver el desglose
          </p>
        ) : sorted.length === 0 ? (
          <p className="text-text-muted py-4 text-center text-sm">
            Sin datos de precios en la lista óptima
          </p>
        ) : (
          <div className="flex max-h-64 flex-col gap-3 overflow-y-auto pr-1">
            {sorted.map(([category, cost]) => {
              const meta = CATEGORY_META[category] ?? CATEGORY_META["Despensa"];
              const pct = Math.round((cost / totalOptimal) * 100);
              const barWidth = Math.round((cost / maxCost) * 100);
              return (
                <div key={category}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-text-secondary text-[11px]">
                      {meta.icon} {category}
                    </span>
                    <span className="text-text-primary text-[11px] font-bold">
                      {formatPrice(cost)}{" "}
                      <span className="text-text-muted font-normal">
                        {pct}%
                      </span>
                    </span>
                  </div>
                  <div className="bg-bg-soft h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-brand-700 h-full rounded-full"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
