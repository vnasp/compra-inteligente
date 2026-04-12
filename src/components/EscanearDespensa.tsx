"use client";

import type { ShoppingListItem } from "@/types/shopping";
import { CATEGORY_META, sortByCategory } from "@/components/ShoppingListPanel";
import { STOCK_LEVELS, suggestedQty } from "@/utils/stock";

export function EscanearDespensa({
  items,
  stockLevels,
  onUpdate,
  onClose,
}: {
  items: ShoppingListItem[];
  stockLevels: Record<string, number>;
  onUpdate: (id: string, level: number) => void;
  onClose: () => void;
}) {
  const handleBulk = (level: number) => {
    for (const item of items) {
      onUpdate(item.id, level);
    }
  };

  const sorted = sortByCategory(items);
  let lastCategory = "";

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-200"
        style={{
          background: "rgba(12,74,110,0.25)",
          backdropFilter: "blur(3px)",
        }}
      />
      {/* Modal */}
      <div
        className="fixed z-201 flex flex-col rounded-2xl bg-white shadow-2xl"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(680px, 95vw)",
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div
          className="flex flex-col gap-3 rounded-t-2xl p-5"
          style={{
            background: "linear-gradient(135deg, #334155, #475569, #4F46E5)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2
                className="text-xl font-black text-white"
                style={{ fontFamily: "var(--font-nunito, sans-serif)" }}
              >
                Actualizar Despensa
              </h2>
              <p className="mt-0.5 text-sm text-white/80">
                ¿Cuánto tienes de cada producto?
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-xl text-white"
              style={{ background: "rgba(255,255,255,0.2)", border: "none" }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Column headers */}
        <div className="flex items-center border-b border-slate-100 bg-slate-50/80 px-5 py-2">
          <span className="flex-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Producto
          </span>
          <div className="flex w-48 justify-between">
            {STOCK_LEVELS.map((lvl) => (
              <span
                key={lvl.value}
                className="flex h-6 w-6 cursor-pointer items-center justify-center"
                onClick={() => handleBulk(lvl.value)}
                title={lvl.label}
              >
                <span
                  className="block h-3.5 w-3.5 rounded-full"
                  style={{ background: lvl.bar }}
                />
              </span>
            ))}
          </div>
          <span className="w-16 text-right text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Comprar
          </span>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-slate-500">
                No hay productos en tu lista
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Agrega productos desde el panel de la izquierda
              </p>
            </div>
          )}
          {sorted.map((item) => {
            const meta =
              CATEGORY_META[item.category] ?? CATEGORY_META["Despensa"];
            const current = stockLevels[item.id] ?? null;
            const qty = suggestedQty(item, current);
            const showCategoryHeader = item.category !== lastCategory;
            lastCategory = item.category;

            return (
              <div key={item.id}>
                {/* Category separator */}
                {showCategoryHeader && (
                  <div className="flex items-center gap-2 bg-slate-50/60 px-5 py-1.5">
                    <span className="text-sm">{meta.icon}</span>
                    <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                      {item.category}
                    </span>
                  </div>
                )}
                {/* Item row — inline */}
                <div className="flex items-center gap-2 border-b border-slate-50 px-5 py-2.5 transition-colors hover:bg-slate-50/50">
                  {/* Product info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {item.brand && (
                        <span className="text-[11px] text-slate-400">
                          {item.brand}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        ·{" "}
                        {item.package_size
                          ? `${item.quantity} × ${item.package_size} ${item.package_unit}`
                          : `${item.quantity} ${item.unit}`}
                      </span>
                    </div>
                  </div>

                  {/* Inline stock selector */}
                  <div className="flex w-48 justify-between">
                    {STOCK_LEVELS.map((lvl) => {
                      const isSelected = current === lvl.value;
                      return (
                        <button
                          key={lvl.value}
                          onClick={() => onUpdate(item.id, lvl.value)}
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-sm transition-all"
                          title={lvl.label}
                        >
                          {isSelected ? (
                            <span
                              className="block h-5 w-5 rounded-full outline-2 outline-offset-1"
                              style={{
                                background: lvl.bar,
                                outlineColor: lvl.color,
                              }}
                            />
                          ) : (
                            <div className="h-4 w-4 rounded-full bg-slate-200" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Suggestion */}
                  <div className="w-16 text-right">
                    {current !== null ? (
                      qty > 0 ? (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                          {qty} {item.unit}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-300">✓ ok</span>
                      )
                    ) : (
                      <span className="text-[11px] text-slate-300">—</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <p className="text-xs text-slate-400">
            {Object.keys(stockLevels).length} de {items.length} escaneados
          </p>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-xl bg-indigo-600 px-8 py-2.5 text-sm font-black text-white"
          >
            Listo
          </button>
        </div>
      </div>
    </>
  );
}
