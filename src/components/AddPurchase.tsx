"use client";

import { useState } from "react";
import type { Purchase } from "@/types/shopping";

const SUPERMARKET_OPTIONS = [
  "Lider",
  "Supermercado",
  "Santa Isabel",
  "Tottus",
  "Unimarc",
  "Acuenta",
];

export function AddPurchase({
  supermarkets,
  onSave,
  onClose,
}: {
  supermarkets: string[];
  onSave: (purchase: Purchase) => void;
  onClose: () => void;
}) {
  const options = supermarkets.length > 0 ? supermarkets : SUPERMARKET_OPTIONS;
  const [amount, setAmount] = useState("");
  const [supermarket, setSupermarket] = useState(options[0]);
  const [date, setDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [tag, setTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(amount, 10);
    if (!parsed || parsed <= 0) return;

    setSaving(true);
    setSaveError("");
    try {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const { data, error } = await supabase
        .from("pantry_purchases")
        .insert({
          amount: parsed,
          supermarket,
          purchased_at: date,
          tag: tag.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      onSave(data as Purchase);
      onClose();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Error al guardar la compra",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-200 bg-black/30 backdrop-blur-sm"
      />
      <div
        className="app-modal fixed z-201 flex flex-col"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(420px, 90vw)",
        }}
      >
        {/* Header */}
        <div className="app-modal-header flex items-center justify-between border-b p-5">
          <div>
            <h2 className="text-text-primary text-lg font-black">
              Registrar Compra
            </h2>
            <p className="text-text-muted mt-0.5 text-sm">
              Ingresa el total gastado
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:bg-bg-soft hover:text-text-primary flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-xl"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          {/* Monto */}
          <div>
            <label className="text-text-muted mb-1 block text-xs font-semibold uppercase">
              Monto Total (CLP)
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ej: 85000"
              required
              className="input-field px-4 py-2.5 font-semibold"
            />
          </div>

          {/* Supermercado */}
          <div>
            <label className="text-text-muted mb-1 block text-xs font-semibold uppercase">
              Supermercado
            </label>
            <select
              value={supermarket}
              onChange={(e) => setSupermarket(e.target.value)}
              className="input-field px-4 py-2.5"
            >
              {options.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div>
            <label className="text-text-muted mb-1 block text-xs font-semibold uppercase">
              Fecha
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-field px-4 py-2.5"
            />
          </div>

          {/* Tag */}
          <div>
            <label className="text-text-muted mb-1 block text-xs font-semibold uppercase">
              Etiqueta (opcional)
            </label>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Ej: Compra Mensual"
              className="input-field px-4 py-2.5"
            />
          </div>

          {saveError && (
            <p className="bg-danger-bg text-danger rounded-xl px-3 py-2 text-xs">
              {saveError}
            </p>
          )}
          <button
            type="submit"
            disabled={saving || !amount}
            className="button-primary mt-1 w-full"
          >
            {saving ? "Guardando…" : "Registrar"}
          </button>
        </form>
      </div>
    </>
  );
}
