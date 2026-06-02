"use client";

import { FileText, Trash2 } from "lucide-react";
import type { Purchase } from "@/types/shopping";

interface HistorialViewProps {
  purchases: Purchase[];
  cycleStart: string;
  monthSpent: number;
  onOpenAnalysis: () => void;
  onOpenPurchase: () => void;
  onOpenBoleta: () => void;
  onDeletePurchase: (id: string) => void;
}

export function HistorialView({
  purchases,
  cycleStart,
  monthSpent,
  onOpenAnalysis,
  onOpenPurchase,
  onOpenBoleta,
  onDeletePurchase,
}: HistorialViewProps) {
  const cyclePurchases = purchases.filter((p) => p.purchased_at >= cycleStart);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-text-primary text-2xl font-bold">
            Historial de Compras
          </h1>
          <p className="text-text-secondary mt-1 text-sm">Desde {cycleStart}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAnalysis}
            className="border-border-default bg-bg-card text-text-primary hover:bg-bg-soft cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition-all"
          >
            Análisis
          </button>
          <button
            onClick={onOpenBoleta}
            className="border-border-default bg-bg-card text-text-primary hover:bg-bg-soft flex cursor-pointer items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition-all"
          >
            <FileText className="h-4 w-4" strokeWidth={1.75} />
            Subir boleta
          </button>
          <button
            onClick={onOpenPurchase}
            className="bg-button-primary cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90"
          >
            + Registrar Compra
          </button>
        </div>
      </div>

      <div className="border-border-soft bg-bg-card rounded-2xl border">
        {cyclePurchases.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-text-muted text-sm">
              No hay compras registradas este mes
            </p>
          </div>
        ) : (
          <>
            {cyclePurchases.map((p) => (
              <div
                key={p.id}
                className="group border-border-soft flex items-center justify-between border-b px-6 py-4 last:border-0"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-greenCustom-100 flex h-10 w-10 items-center justify-center rounded-xl text-base">
                    {p.tag === "Boleta" ? "🧾" : "🛒"}
                  </div>
                  <div>
                    <p className="text-text-primary font-semibold">
                      ${p.amount.toLocaleString("es-CL")}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-text-muted text-xs">
                        {p.supermarket}
                      </span>
                      {p.tag && (
                        <span className="text-greenCustom-600 text-xs">
                          · {p.tag}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-text-muted text-sm">
                    {new Date(p.purchased_at + "T12:00:00").toLocaleDateString(
                      "es-CL",
                      { day: "numeric", month: "long" },
                    )}
                  </span>
                  <div className="relative">
                    <button
                      onClick={() => onDeletePurchase(p.id)}
                      title={
                        p.tag === "Boleta"
                          ? "Eliminar compra (los códigos de barra se conservan)"
                          : "Eliminar compra"
                      }
                      className="text-text-muted cursor-pointer rounded-lg p-1.5 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-bg-soft flex items-center justify-between rounded-b-2xl px-6 py-4">
              <span className="text-text-secondary text-sm font-medium">
                Total gastado
              </span>
              <span className="text-text-primary text-lg font-bold">
                ${monthSpent.toLocaleString("es-CL")}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
