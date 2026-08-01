"use client";

import { useState } from "react";
import { Trash2, CalendarCheck, AlertTriangle } from "lucide-react";
import type { Purchase } from "@/types/shopping";

interface HistorialViewProps {
  purchases: Purchase[];
  cycleStart: string;
  monthSpent: number;
  onOpenAnalysis: () => void;
  onOpenPurchase: () => void;
  onDeletePurchase: (id: string) => void;
  onCloseCycle: () => void | Promise<void>;
}

export function HistorialView({
  purchases,
  cycleStart,
  monthSpent,
  onOpenAnalysis,
  onOpenPurchase,
  onDeletePurchase,
  onCloseCycle,
}: HistorialViewProps) {
  const cyclePurchases = purchases.filter((p) => p.purchased_at >= cycleStart);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const handleConfirmClose = async () => {
    setClosing(true);
    try {
      await onCloseCycle();
      setConfirmOpen(false);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="p-8">
      {confirmOpen && (
        <>
          <div
            onClick={() => !closing && setConfirmOpen(false)}
            className="fixed inset-0 z-200 bg-black/30 backdrop-blur-sm"
          />
          <div className="app-modal fixed top-1/2 left-1/2 z-201 w-[min(420px,90vw)] -translate-x-1/2 -translate-y-1/2 p-6">
            <div className="flex items-start gap-3">
              <div className="icon-box-warning flex h-10 w-10 shrink-0 items-center justify-center">
                <AlertTriangle
                  className="text-warning h-5 w-5"
                  strokeWidth={2}
                />
              </div>
              <div>
                <h2 className="text-text-primary text-base font-bold">
                  Cerrar mes
                </h2>
                <p className="text-text-secondary mt-1 text-sm">
                  Se iniciará un nuevo ciclo: el presupuesto vuelve a cero, se
                  reinician los productos ya comprados y se vacía el stock de la
                  despensa. El historial de compras se conserva.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={closing}
                className="button-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmClose}
                disabled={closing}
                className="button-warning"
              >
                {closing ? "Cerrando…" : "Cerrar mes"}
              </button>
            </div>
          </div>
        </>
      )}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-text-primary text-2xl font-bold">
            Historial de Compras
          </h1>
          <p className="text-text-secondary mt-1 text-sm">Desde {cycleStart}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfirmOpen(true)}
            className="button-warning"
          >
            <CalendarCheck className="h-4 w-4" strokeWidth={1.75} />
            Cerrar mes
          </button>
          <button onClick={onOpenAnalysis} className="button-secondary">
            Análisis
          </button>
          <button onClick={onOpenPurchase} className="button-primary">
            + Registrar Compra
          </button>
        </div>
      </div>

      <div className="app-panel">
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
                className="app-row group flex items-center justify-between border-b px-6 py-4 last:border-0"
              >
                <div className="flex items-center gap-4">
                  <div className="icon-box-neutral flex h-10 w-10 items-center justify-center text-base">
                    🛒
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
                        <span className="text-brand-700 text-xs">
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
                      title="Eliminar compra"
                      className="text-text-muted hover:bg-danger-bg hover:text-danger cursor-pointer rounded-lg p-1.5 opacity-0 transition-all group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div className="app-row flex items-center justify-between px-6 py-4">
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
