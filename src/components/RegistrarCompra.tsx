"use client";

import { useState } from "react";
import type { Purchase } from "@/types/shopping";

const SUPERMARKET_OPTIONS = [
  "Lider",
  "Jumbo",
  "Santa Isabel",
  "Tottus",
  "Unimarc",
  "Acuenta",
];

export function RegistrarCompra({
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(amount, 10);
    if (!parsed || parsed <= 0) return;

    setSaving(true);
    try {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const { data, error } = await supabase
        .from("purchases")
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
      console.error("Error registrando compra:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-200"
        style={{
          background: "rgba(12,74,110,0.25)",
          backdropFilter: "blur(3px)",
        }}
      />
      <div
        className="fixed z-201 flex flex-col rounded-2xl bg-white shadow-2xl"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(420px, 90vw)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between rounded-t-2xl p-5"
          style={{
            background: "linear-gradient(135deg, #334155, #475569, #4F46E5)",
          }}
        >
          <div>
            <h2 className="text-lg font-black text-white">Registrar Compra</h2>
            <p className="mt-0.5 text-sm text-white/80">
              Ingresa el total gastado
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          {/* Monto */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase">
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
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Supermercado */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase">
              Supermercado
            </label>
            <select
              value={supermarket}
              onChange={(e) => setSupermarket(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
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
            <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase">
              Fecha
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Tag */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase">
              Etiqueta (opcional)
            </label>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Ej: Compra Mensual"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !amount}
            className="mt-1 w-full cursor-pointer rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Registrar"}
          </button>
        </form>
      </div>
    </>
  );
}
