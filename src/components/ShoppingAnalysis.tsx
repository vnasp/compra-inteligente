"use client";

import { CATEGORY_META } from "@/components/ShoppingListPanel";
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
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">
            Análisis de Gasto
          </h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
            <div key={label} className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="mb-0.5 text-[10px] tracking-wide text-slate-400 uppercase">
                {label}
              </p>
              <p className="text-sm font-bold text-slate-800">{value}</p>
            </div>
          ))}
        </div>

        {/* Barra de presupuesto gastado */}
        {monthlyBudget > 0 && (
          <div className="mb-5">
            <div className="mb-1 flex justify-between text-[11px] text-slate-400">
              <span>Gastado del mes</span>
              <span>{Math.round((monthSpent / monthlyBudget) * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${
                  monthSpent > monthlyBudget ? "bg-red-500" : "bg-indigo-500"
                }`}
                style={{
                  width: `${Math.min((monthSpent / monthlyBudget) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Barras por categoría */}
        <p className="mb-3 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          Lista óptima por categoría
        </p>

        {!knapsackResult ? (
          <p className="py-4 text-center text-sm text-slate-400">
            Genera la lista óptima primero para ver el desglose
          </p>
        ) : sorted.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">
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
                    <span className="text-[11px] text-slate-600">
                      {meta.icon} {category}
                    </span>
                    <span className="text-[11px] font-bold text-slate-700">
                      {formatPrice(cost)}{" "}
                      <span className="font-normal text-slate-400">{pct}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500"
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
