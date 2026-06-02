"use client";

import { CATEGORY_META } from "@/components/ShoppingListPanel";
import type { AppView } from "@/components/Sidebar";
import type { ShoppingListItem } from "@/types/shopping";

interface InicioViewProps {
  budgetDisplay: string;
  remainingBudget: number;
  monthlyBudget: number;
  monthSpent: number;
  cycleStart: string;
  nextShoppingDate: string;
  itemCount: number;
  items: ShoppingListItem[];
  onNavigate: (view: AppView) => void;
}

export function InicioView({
  budgetDisplay,
  remainingBudget,
  monthlyBudget,
  monthSpent,
  cycleStart,
  nextShoppingDate,
  itemCount,
  items,
  onNavigate,
}: InicioViewProps) {
  const categoryCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});
  const chartEntries = Object.entries(categoryCounts).sort(
    (a, b) => b[1] - a[1],
  );
  const chartMax = chartEntries[0]?.[1] ?? 1;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-text-primary text-2xl font-bold">
          Hola, Valentina
        </h1>
        <p className="text-text-secondary mt-1 text-sm">
          Aquí tienes el resumen de tu compra mensual
        </p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          {
            label: "Presupuesto Restante",
            value: budgetDisplay,
            warn: remainingBudget < 0,
            sub: `de $${monthlyBudget.toLocaleString("es-CL")}`,
          },
          {
            label: "Gastado este mes",
            value: `$${monthSpent.toLocaleString("es-CL")}`,
            warn: false,
            sub: `desde ${cycleStart}`,
          },
          {
            label: "Próxima Compra",
            value: nextShoppingDate,
            warn: false,
            sub: null,
          },
        ].map(({ label, value, warn, sub }) => (
          <div
            key={label}
            className="border-border-soft bg-bg-card rounded-2xl border p-5"
          >
            <p className="text-text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">
              {label}
            </p>
            <p
              className={`text-2xl font-bold ${warn ? "text-danger" : "text-text-primary"}`}
            >
              {value}
            </p>
            {sub && <p className="text-text-muted mt-1 text-xs">{sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          <button
            onClick={() => onNavigate("inventario")}
            className="border-greenCustom-200 bg-greenCustom-100 flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-left transition-all hover:opacity-90"
          >
            <span className="text-xl">🗂️</span>
            <div>
              <p className="text-greenCustom-800 font-semibold">
                Ver Inventario
              </p>
              <p className="text-greenCustom-700 text-xs">
                {itemCount} productos · Actualiza el stock
              </p>
            </div>
          </button>
          <button
            onClick={() => onNavigate("optimizacion")}
            className="border-accent-beige bg-accent-cream flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-left transition-all hover:opacity-90"
          >
            <span className="text-xl">✨</span>
            <div>
              <p className="text-text-primary font-semibold">
                Optimizar Compra
              </p>
              <p className="text-text-secondary text-xs">
                Genera tu lista óptima según presupuesto
              </p>
            </div>
          </button>
        </div>

        {/* Compact category chart */}
        {chartEntries.length > 0 && (
          <div className="border-border-soft bg-bg-card rounded-2xl border px-5 py-4">
            <p className="text-text-muted mb-3 text-xs font-semibold tracking-wide uppercase">
              Tu lista por categoría
            </p>
            <div className="flex flex-col gap-2">
              {chartEntries.map(([cat, count]) => {
                const meta = CATEGORY_META[cat] ?? CATEGORY_META["Despensa"];
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="w-4 shrink-0 text-center text-xs">
                      {meta.icon}
                    </span>
                    <span className="text-text-secondary w-28 shrink-0 truncate text-xs">
                      {cat}
                    </span>
                    <div className="bg-border-soft h-1.5 flex-1 overflow-hidden rounded-full">
                      <div
                        className="bg-greenCustom-600 h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.round((count / chartMax) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-text-primary w-4 shrink-0 text-right text-xs font-bold">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
