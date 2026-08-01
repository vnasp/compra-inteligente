"use client";

import { useState, useEffect } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
  Trash2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  toISO,
  formatLongDate,
  monthGrid,
  nextShoppingDate,
  openGoogleCalendar,
} from "@/utils/dates";
import type { UserConfig } from "@/types/shopping";

const DEFAULT_CONFIG = {
  monthly_budget: 150000,
  shopping_dates: [] as string[],
  supermarkets: ["Supermercado"],
};

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

interface ConfigViewProps {
  config: UserConfig | null;
  setConfig: React.Dispatch<React.SetStateAction<UserConfig | null>>;
}

export function ConfigView({ config, setConfig }: ConfigViewProps) {
  const [budget, setBudget] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Mes visible en el calendario (se fija en el cliente para evitar hydration mismatch)
  const [cursor, setCursor] = useState<{ year: number; month: number } | null>(
    null,
  );
  const [todayISO, setTodayISO] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setTodayISO(toISO(now));
  }, []);

  useEffect(() => {
    const src = config ?? DEFAULT_CONFIG;
    setBudget(String(src.monthly_budget));
    setDates([...(src.shopping_dates ?? [])].sort());
  }, [config]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggleDate = (iso: string) => {
    setDates((prev) =>
      prev.includes(iso)
        ? prev.filter((d) => d !== iso)
        : [...prev, iso].sort(),
    );
  };

  const shiftMonth = (delta: number) => {
    setCursor((prev) => {
      if (!prev) return prev;
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      monthly_budget: parseInt(budget, 10) || DEFAULT_CONFIG.monthly_budget,
      shopping_dates: [...dates].sort(),
      supermarkets: ["Supermercado"],
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
    "input-field bg-bg-soft px-3 py-2.5 focus:border-brand-400";
  const labelClass = "mb-1.5 block text-sm font-semibold text-text-primary";
  const hintClass = "mt-1 text-xs text-text-muted";

  const upcoming = todayISO ? dates.filter((d) => d >= todayISO) : dates;
  const nextDate = todayISO ? nextShoppingDate(dates, new Date()) : null;
  const weeks = cursor ? monthGrid(cursor.year, cursor.month) : [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-text-primary text-2xl font-bold">Configuración</h1>
        <p className="text-text-secondary mt-1 text-sm">
          Ajusta el presupuesto y marca los días en que harás la compra
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* ── Left column: form ── */}
        <div className="flex flex-col gap-5">
          {/* Presupuesto */}
          <div className="app-card">
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

          {/* Calendario de compras */}
          <div className="app-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-text-primary text-sm font-bold">
                Días de compra
              </h2>
              {cursor && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => shiftMonth(-1)}
                    title="Mes anterior"
                    className="button-secondary h-8 w-8 rounded-lg p-0"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                  <span className="text-text-primary w-36 text-center text-xs font-semibold capitalize">
                    {MONTH_NAMES[cursor.month]} {cursor.year}
                  </span>
                  <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    title="Mes siguiente"
                    className="button-secondary h-8 w-8 rounded-lg p-0"
                  >
                    <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              )}
            </div>

            <div className="mb-1.5 grid grid-cols-7 gap-1">
              {WEEKDAY_LABELS.map((name) => (
                <span
                  key={name}
                  className="text-text-muted text-center text-[11px] font-semibold"
                >
                  {name}
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-1">
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.map((iso, di) => {
                    if (!iso) return <span key={di} />;
                    const selected = dates.includes(iso);
                    const isToday = iso === todayISO;
                    const isPast = todayISO !== "" && iso < todayISO;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => toggleDate(iso)}
                        aria-pressed={selected}
                        className={`cursor-pointer rounded-lg border py-2 text-xs font-semibold transition-all ${
                          selected
                            ? "border-brand-600 bg-brand-700 text-white"
                            : isToday
                              ? "border-brand-400 bg-bg-soft text-brand-700"
                              : `border-border-soft bg-bg-soft hover:border-brand-300 ${isPast ? "text-text-muted/60" : "text-text-muted"}`
                        }`}
                      >
                        {parseInt(iso.slice(8), 10)}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <p className={hintClass}>
              Marca los días en que irás al supermercado. La próxima compra se
              sugiere a partir de estas fechas.
            </p>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-3 ${saved ? "button-success" : "button-primary"}`}
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
          {/* Próximas compras */}
          <div className="app-card">
            <h2 className="text-text-primary mb-1 text-sm font-bold">
              Próximas compras
            </h2>
            <p className="text-text-muted mb-4 text-xs">
              Agrégalas a tu calendario para no olvidarlas
            </p>
            {upcoming.length === 0 ? (
              <p className="text-text-muted py-4 text-center text-xs">
                Aún no has marcado días de compra
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {upcoming.map((iso) => (
                  <div
                    key={iso}
                    className={`app-row flex items-center justify-between rounded-xl border px-4 py-2.5 ${
                      iso === nextDate
                        ? "border-success-border bg-bg-card"
                        : "border-border-soft"
                    }`}
                  >
                    <div>
                      <p className="text-text-primary text-sm font-semibold capitalize">
                        {formatLongDate(iso)}
                      </p>
                      {iso === nextDate && (
                        <p className="text-success text-xs">Próxima compra</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openGoogleCalendar(iso)}
                        title="Agregar al Calendario"
                        className="button-secondary h-8 w-8 rounded-lg p-0"
                      >
                        <CalendarPlus className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDate(iso)}
                        title="Quitar fecha"
                        className="text-text-muted hover:bg-danger-bg hover:text-danger flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Supermercado */}
          <div className="app-card">
            <h2 className="text-text-primary mb-1 text-sm font-bold">
              Supermercado
            </h2>
            <p className="text-text-muted mb-4 text-xs">
              Los precios se actualizan desde esta tienda
            </p>
            <div className="app-row flex items-center gap-3 rounded-xl border px-4 py-3">
              <div className="icon-box-brand h-9 w-9 text-sm font-black">J</div>
              <div>
                <p className="text-text-primary font-semibold">Supermercado</p>
                <p className="text-success text-xs">
                  Scraping de precios activo
                </p>
              </div>
            </div>
          </div>

          {/* Resumen actual */}
          <div className="app-card">
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
                  label: "Días marcados",
                  value: String(dates.length),
                },
                {
                  label: "Próxima compra",
                  value: nextDate ? formatLongDate(nextDate) : "—",
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-text-muted text-xs">{label}</span>
                  <span className="text-text-primary text-xs font-semibold capitalize">
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
