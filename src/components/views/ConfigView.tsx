"use client";

import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { UserConfig } from "@/types/shopping";

const DEFAULT_CONFIG = {
  monthly_budget: 150000,
  shopping_days: [1, 15],
  shopping_weekday: 4,
  supermarkets: ["Jumbo"],
};

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const SHOPPING_PRESETS = [
  { key: "mensual", label: "Mensual", days: [1] },
  { key: "quincenal", label: "Quincenal", days: [1, 15] },
  { key: "custom", label: "Personalizado", days: null },
] as const;

type ShoppingPreset = (typeof SHOPPING_PRESETS)[number]["key"];

function detectPreset(days: number[]): ShoppingPreset {
  const sorted = [...days].sort((a, b) => a - b).join(",");
  if (sorted === "1") return "mensual";
  if (sorted === "1,15") return "quincenal";
  return "custom";
}

interface ConfigViewProps {
  config: UserConfig | null;
  setConfig: React.Dispatch<React.SetStateAction<UserConfig | null>>;
}

export function ConfigView({ config, setConfig }: ConfigViewProps) {
  const [budget, setBudget] = useState("");
  const [daysInput, setDaysInput] = useState("");
  const [weekday, setWeekday] = useState(4);
  const [daysPreset, setDaysPreset] = useState<ShoppingPreset>("quincenal");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const src = config ?? DEFAULT_CONFIG;
    setBudget(String(src.monthly_budget));
    const days = src.shopping_days ?? DEFAULT_CONFIG.shopping_days;
    setDaysInput(days.join(", "));
    setDaysPreset(detectPreset(days));
    setWeekday(src.shopping_weekday ?? 4);
  }, [config]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
      shopping_weekday: weekday,
      supermarkets: ["Jumbo"],
      updated_at: new Date().toISOString(),
    };

    const supabase = createClient();
    if (config) {
      const { data } = await supabase
        .from("pantry_user_config")
        .update(payload)
        .eq("id", config.id)
        .select()
        .single();
      if (data) setConfig(data as UserConfig);
    } else {
      const { data } = await supabase
        .from("pantry_user_config")
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select()
        .single();
      if (data) setConfig(data as UserConfig);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputClass =
    "w-full rounded-xl border border-border-soft bg-bg-soft px-3 py-2.5 text-sm text-text-primary outline-none focus:border-greenCustom-400";
  const labelClass = "mb-1.5 block text-sm font-semibold text-text-primary";
  const hintClass = "mt-1 text-xs text-text-muted";

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-text-primary text-2xl font-bold">Configuración</h1>
        <p className="text-text-secondary mt-1 text-sm">
          Ajusta el presupuesto y el ciclo de compra
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* ── Left column: form ── */}
        <div className="flex flex-col gap-5">
          {/* Presupuesto */}
          <div className="border-border-soft bg-bg-card rounded-2xl border p-5">
            <h2 className="text-text-primary mb-4 text-sm font-bold">
              Presupuesto mensual
            </h2>
            <label className={labelClass}>Monto (CLP)</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              min={0}
              step={5000}
              className={inputClass}
              placeholder="150000"
            />
            <p className={hintClass}>Total destinado a compras del mes</p>
          </div>

          {/* Frecuencia */}
          <div className="border-border-soft bg-bg-card rounded-2xl border p-5">
            <h2 className="text-text-primary mb-4 text-sm font-bold">
              Frecuencia de compra
            </h2>
            <label className={labelClass}>Ciclo</label>
            <div className="flex gap-2">
              {SHOPPING_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => {
                    setDaysPreset(preset.key);
                    if (preset.days) setDaysInput(preset.days.join(", "));
                  }}
                  className={`flex-1 cursor-pointer rounded-xl border py-2.5 text-xs font-semibold transition-all ${
                    daysPreset === preset.key
                      ? "border-greenCustom-600 bg-greenCustom-700 text-white"
                      : "border-border-soft bg-bg-soft text-text-muted hover:border-greenCustom-300"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {daysPreset === "custom" && (
              <input
                type="text"
                value={daysInput}
                onChange={(e) => setDaysInput(e.target.value)}
                className={`mt-3 ${inputClass}`}
                placeholder="1, 8, 22"
              />
            )}
            <p className={hintClass}>
              La fecha exacta se ajusta al {WEEKDAYS[weekday]} más cercano a los
              días de referencia
            </p>
          </div>

          {/* Día de compra */}
          <div className="border-border-soft bg-bg-card rounded-2xl border p-5">
            <h2 className="text-text-primary mb-4 text-sm font-bold">
              Día de compra
            </h2>
            <div className="flex gap-1.5">
              {WEEKDAYS.map((name, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setWeekday(idx)}
                  className={`flex-1 cursor-pointer rounded-lg border py-2 text-xs font-semibold transition-all ${
                    weekday === idx
                      ? "border-greenCustom-600 bg-greenCustom-700 text-white"
                      : "border-border-soft bg-bg-soft text-text-muted hover:border-greenCustom-300"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            <p className={hintClass}>
              Día de la semana en que habitualmente compras
            </p>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-50 ${
              saved
                ? "bg-greenCustom-600"
                : "bg-button-primary hover:opacity-90"
            }`}
          >
            {saved ? (
              <>
                <Check className="h-4 w-4" strokeWidth={2.5} />
                Guardado
              </>
            ) : saving ? (
              "Guardando…"
            ) : (
              "Guardar cambios"
            )}
          </button>
        </div>

        {/* ── Right column: info cards ── */}
        <div className="flex flex-col gap-5">
          {/* Supermercado */}
          <div className="border-border-soft bg-bg-card rounded-2xl border p-5">
            <h2 className="text-text-primary mb-1 text-sm font-bold">
              Supermercado
            </h2>
            <p className="text-text-muted mb-4 text-xs">
              Los precios se actualizan desde esta tienda
            </p>
            <div className="border-greenCustom-200 bg-greenCustom-50 flex items-center gap-3 rounded-xl border px-4 py-3">
              <div className="bg-greenCustom-700 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white">
                J
              </div>
              <div>
                <p className="text-greenCustom-800 font-semibold">Jumbo</p>
                <p className="text-greenCustom-600 text-xs">
                  Scraping de precios activo
                </p>
              </div>
            </div>
          </div>

          {/* Resumen actual */}
          <div className="border-border-soft bg-bg-card rounded-2xl border p-5">
            <h2 className="text-text-primary mb-4 text-sm font-bold">
              Configuración actual
            </h2>
            <div className="flex flex-col gap-3">
              {[
                {
                  label: "Presupuesto",
                  value: `$${(parseInt(budget, 10) || 0).toLocaleString("es-CL")}`,
                },
                {
                  label: "Ciclo",
                  value:
                    SHOPPING_PRESETS.find((p) => p.key === daysPreset)?.label ??
                    "—",
                },
                {
                  label: "Día de compra",
                  value: WEEKDAYS[weekday],
                },
                {
                  label: "Días del mes",
                  value: daysInput || "—",
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-text-muted text-xs">{label}</span>
                  <span className="text-text-primary text-xs font-semibold">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
