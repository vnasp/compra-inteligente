"use client";

import { useState, useEffect } from "react";
import type { UserConfig } from "@/types/shopping";
import { createClient } from "@/utils/supabase/client";

const DEFAULT_CONFIG: Omit<UserConfig, "id" | "created_at" | "updated_at"> = {
  monthly_budget: 150000,
  shopping_days: [1, 15],
  supermarkets: ["Lider", "Jumbo"],
};

const SUPERMARKET_OPTIONS = [
  "Lider",
  "Jumbo",
  "Santa Isabel",
  "Tottus",
  "Unimarc",
  "Acuenta",
];

export function ConfigPanel({
  config,
  setConfig,
}: {
  config: UserConfig | null;
  setConfig: React.Dispatch<React.SetStateAction<UserConfig | null>>;
}) {
  const [open, setOpen] = useState(false);
  const [budget, setBudget] = useState("");
  const [daysInput, setDaysInput] = useState("");
  const [markets, setMarkets] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Sync local state when config loads or modal opens
  useEffect(() => {
    if (config && open) {
      setBudget(String(config.monthly_budget));
      setDaysInput(config.shopping_days.join(", "));
      setMarkets(config.supermarkets);
    } else if (!config && open) {
      setBudget(String(DEFAULT_CONFIG.monthly_budget));
      setDaysInput(DEFAULT_CONFIG.shopping_days.join(", "));
      setMarkets(DEFAULT_CONFIG.supermarkets);
    }
  }, [config, open]);

  // Load config from Supabase on mount
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("user_config")
      .select("*")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setConfig(data as UserConfig);
      });
  }, [setConfig]);

  const toggleMarket = (name: string) => {
    setMarkets((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const parsedDays = daysInput
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 1 && n <= 31)
      .sort((a, b) => a - b);

    const payload = {
      monthly_budget: parseInt(budget, 10) || DEFAULT_CONFIG.monthly_budget,
      shopping_days: parsedDays.length > 0 ? parsedDays : [1],
      supermarkets: markets.length > 0 ? markets : ["Lider"],
      updated_at: new Date().toISOString(),
    };

    const supabase = createClient();

    if (config) {
      const { data } = await supabase
        .from("user_config")
        .update(payload)
        .eq("id", config.id)
        .select()
        .single();
      if (data) setConfig(data as UserConfig);
    } else {
      const { data } = await supabase
        .from("user_config")
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select()
        .single();
      if (data) setConfig(data as UserConfig);
    }

    setSaving(false);
    setOpen(false);
  };

  return (
    <>
      {/* Trigger — lengueta fija en borde izquierdo, debajo de MI LISTA */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir configuración"
        className="fixed left-0 z-50 flex h-30 w-11 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-r-2xl border-none bg-linear-to-b from-indigo-500 to-indigo-700 p-0 shadow-[3px_0_16px_rgba(67,56,202,0.35)]"
        style={{ top: "calc(50% + 68px)" }}
      >
        <span className="rotate-180 text-sm font-black tracking-[0.05em] text-white [text-orientation:mixed] [writing-mode:vertical-rl]">
          CONFIG
        </span>
      </button>

      {/* Modal */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-200 bg-[rgba(12,74,110,0.25)] backdrop-blur-[3px]"
          />
          <div
            className="fixed z-201 flex flex-col rounded-2xl bg-white shadow-2xl"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(480px, 95vw)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between rounded-t-2xl px-5 py-4"
              style={{
                background:
                  "linear-gradient(135deg, #334155, #475569, #4F46E5)",
              }}
            >
              <h2 className="text-lg font-black text-white">Configuración</h2>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border-none bg-white/20 text-lg text-white"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-col gap-5 p-5">
              {/* Presupuesto */}
              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">
                  Presupuesto Mensual (CLP)
                </label>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  min={0}
                  step={1000}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="150000"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Monto total destinado a compras del mes
                </p>
              </div>

              {/* Fechas de compra */}
              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">
                  Días de Compra del Mes
                </label>
                <input
                  type="text"
                  value={daysInput}
                  onChange={(e) => setDaysInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="1, 15"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Días separados por coma (ej: 1, 15 para quincenal)
                </p>
              </div>

              {/* Supermercados */}
              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">
                  Supermercados a Comparar
                </label>
                <div className="flex flex-wrap gap-2">
                  {SUPERMARKET_OPTIONS.map((name) => {
                    const selected = markets.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleMarket(name)}
                        className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                          selected
                            ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                        }`}
                      >
                        {selected ? "✓ " : ""}
                        {name}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Selecciona dónde quieres comparar precios
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 cursor-pointer rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 cursor-pointer rounded-xl border-none bg-linear-to-r from-indigo-500 to-indigo-700 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:from-indigo-600 hover:to-indigo-800 disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
