"use client";

import { useState } from "react";
import Image from "next/image";
import { Search, Link2, X, Check } from "lucide-react";
import type { ShoppingListItem, Unit } from "@/types/shopping";
import {
  CATEGORIES,
  UNITS,
  CATEGORY_META,
  EMPTY_FORM,
  type FormState,
} from "./constants";
import { Toggle } from "./Toggle";
import { formatPrice } from "@/utils/stock";
import type { JumboCandidate } from "@/utils/jumbo";
import { useToast } from "@/components/ui/Toast";

export function FormView({
  initial,
  onSave,
  onCancel,
}: {
  initial: ShoppingListItem | null;
  onSave: (form: FormState) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(
    initial
      ? {
          name: initial.name,
          brand: initial.brand ?? "",
          category: initial.category,
          quantity: String(initial.quantity),
          unit: initial.unit,
          package_size:
            initial.package_size != null ? String(initial.package_size) : "",
          package_unit: initial.package_unit ?? "g",
          supermarket: initial.supermarket,
          is_active: initial.is_active,
          is_required: initial.is_required ?? true,
          notes: initial.notes ?? "",
          jumbo_sku: initial.jumbo_sku ?? null,
          jumbo_name: initial.jumbo_name ?? null,
        }
      : EMPTY_FORM,
  );

  // ── Vínculo con Jumbo ──
  const [jumboOpen, setJumboOpen] = useState(false);
  const [jumboQuery, setJumboQuery] = useState("");
  const [jumboLoading, setJumboLoading] = useState(false);
  const [jumboResults, setJumboResults] = useState<JumboCandidate[]>([]);
  const [jumboSearched, setJumboSearched] = useState(false);

  const openJumboSearch = () => {
    const size = form.package_size
      ? ` ${form.package_size} ${form.package_unit}`
      : "";
    setJumboQuery(`${form.name} ${form.brand}${size}`.trim());
    setJumboResults([]);
    setJumboSearched(false);
    setJumboOpen(true);
  };

  const runJumboSearch = async () => {
    const q = jumboQuery.trim();
    if (!q) return;
    setJumboLoading(true);
    setJumboSearched(true);
    try {
      const res = await fetch(`/api/jumbo-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error consultando Jumbo");
      setJumboResults((data.results ?? []) as JumboCandidate[]);
    } catch (err) {
      setJumboResults([]);
      toast.error(
        err instanceof Error ? err.message : "Error consultando Jumbo",
      );
    } finally {
      setJumboLoading(false);
    }
  };

  const linkJumbo = (c: JumboCandidate) => {
    setForm((f) => ({ ...f, jumbo_sku: c.sku, jumbo_name: c.name }));
    setJumboOpen(false);
  };

  const unlinkJumbo = () =>
    setForm((f) => ({ ...f, jumbo_sku: null, jumbo_name: null }));

  const inputClass =
    "w-full px-3 py-2.5 rounded-xl border-[1.5px] border-border-soft bg-bg-soft text-sm text-text-primary outline-none box-border focus:border-greenCustom-400";
  const labelClass = "block font-semibold text-xs text-text-secondary mb-1";

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <h3 className="text-text-primary mt-0 mb-4 text-base font-bold">
        {initial ? "Editar producto" : "Nuevo producto"}
      </h3>

      <div className="flex flex-col gap-4">
        {/* Name */}
        <div>
          <label className={labelClass}>Nombre *</label>
          <input
            className={inputClass}
            placeholder="ej. Leche"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        {/* Brand */}
        <div>
          <label className={labelClass}>Marca</label>
          <input
            className={inputClass}
            placeholder="ej. Colun"
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
          />
        </div>

        {/* Category */}
        <div>
          <label className={labelClass}>Categoría</label>
          <select
            className={`${inputClass} cursor-pointer`}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c]?.icon} {c}
              </option>
            ))}
          </select>
        </div>

        {/* Cantidad + Tamaño del envase */}
        <div className="flex items-center justify-between">
          <span className="text-text-secondary block text-xs font-semibold">
            Cantidad a comprar
          </span>
          <span className="bg-greenCustom-100 text-greenCustom-700 rounded-full px-2.5 py-0.5 text-xs font-bold">
            {form.package_size
              ? `${form.quantity || "?"} × ${form.package_size} ${form.package_unit}`
              : `${form.quantity || "?"} ${form.unit}`}
          </span>
        </div>
        <div className="border-border-soft bg-bg-soft flex flex-col gap-2.5 rounded-xl border-[1.5px] p-3.5">
          {/* Row 1: quantity + unit */}
          <div className="flex gap-2.5">
            <div className="flex-1">
              <label className={labelClass}>Cantidad *</label>
              <input
                className={inputClass}
                type="number"
                min="1"
                step="1"
                placeholder="ej. 2"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            {!form.package_size && (
              <div className="w-22.5">
                <label className={labelClass}>Unidad</label>
                <select
                  className={`${inputClass} cursor-pointer`}
                  value={form.unit}
                  onChange={(e) =>
                    setForm({ ...form, unit: e.target.value as Unit })
                  }
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-border-soft border-t border-dashed" />

          {/* Row 2: package size */}
          <div>
            <label className="text-text-muted mb-1 block text-xs font-semibold">
              Tamaño del envase{" "}
              <span className="text-[11px] font-normal">(opcional)</span>
            </label>
            <div className="flex gap-2.5">
              <input
                className={`${inputClass} flex-1`}
                type="text"
                inputMode="decimal"
                placeholder="ej. 1.5"
                value={form.package_size}
                onChange={(e) =>
                  setForm({ ...form, package_size: e.target.value })
                }
              />
              <div className="w-22.5">
                <select
                  className={`${inputClass} cursor-pointer`}
                  value={form.package_unit}
                  onChange={(e) =>
                    setForm({ ...form, package_unit: e.target.value as Unit })
                  }
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-text-muted mt-1 mb-0 text-[11px]">
              Completa si el producto tiene un tamaño fijo por envase (ej. 850
              g, 1 L, 20 un)
            </p>
          </div>
        </div>

        {/* Prioridad: Requerido / Opcional */}
        <div>
          <label className={labelClass}>Prioridad de compra</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, is_required: true })}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-[1.5px] py-2 text-sm font-semibold transition-colors ${
                form.is_required
                  ? "border-greenCustom-600 bg-greenCustom-700 text-white"
                  : "border-border-soft bg-bg-card text-text-muted hover:border-greenCustom-300"
              }`}
            >
              Requerido
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_required: false })}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-[1.5px] py-2 text-sm font-semibold transition-colors ${
                !form.is_required
                  ? "border-text-secondary bg-text-secondary text-white"
                  : "border-border-soft bg-bg-card text-text-muted hover:border-border-default"
              }`}
            >
              Opcional
            </button>
          </div>
          <p className="text-text-muted mt-1 mb-0 text-[11px]">
            {form.is_required
              ? "Siempre se compra, tiene prioridad en el presupuesto."
              : "Se compra solo si queda presupuesto disponible."}
          </p>
        </div>

        {/* Active toggle */}
        <div className="border-border-soft bg-bg-soft flex items-center justify-between rounded-xl border-[1.5px] px-3.5 py-2.5">
          <span className="text-text-primary text-xs font-semibold">
            Activo en lista
          </span>
          <Toggle
            checked={form.is_active}
            onChange={(v) => setForm({ ...form, is_active: v })}
          />
        </div>

        {/* Vínculo con Jumbo */}
        <div>
          <label className={labelClass}>Vínculo con Jumbo</label>
          {form.jumbo_sku ? (
            <div className="border-greenCustom-200 bg-greenCustom-50 flex items-center gap-2 rounded-xl border-[1.5px] px-3 py-2.5">
              <Check
                className="text-greenCustom-600 h-4 w-4 shrink-0"
                strokeWidth={2.5}
              />
              <div className="min-w-0 flex-1">
                <p className="text-greenCustom-800 truncate text-xs font-semibold">
                  {form.jumbo_name}
                </p>
                <p className="text-greenCustom-600 text-[10px]">
                  SKU {form.jumbo_sku}
                </p>
              </div>
              <button
                type="button"
                onClick={openJumboSearch}
                className="text-greenCustom-700 hover:bg-greenCustom-100 cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold"
              >
                Cambiar
              </button>
              <button
                type="button"
                onClick={unlinkJumbo}
                title="Quitar vínculo"
                className="text-text-muted hover:bg-greenCustom-100 cursor-pointer rounded-lg p-1"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          ) : jumboOpen ? (
            <div className="border-border-soft bg-bg-soft flex flex-col gap-2 rounded-xl border-[1.5px] p-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search
                    className="text-text-muted absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
                    strokeWidth={1.75}
                  />
                  <input
                    autoFocus
                    className={`${inputClass} py-2 pl-8 text-xs`}
                    value={jumboQuery}
                    onChange={(e) => setJumboQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        runJumboSearch();
                      }
                      if (e.key === "Escape") setJumboOpen(false);
                    }}
                    placeholder="Buscar en Jumbo…"
                  />
                </div>
                <button
                  type="button"
                  onClick={runJumboSearch}
                  disabled={jumboLoading}
                  className="bg-greenCustom-700 hover:bg-greenCustom-800 shrink-0 cursor-pointer rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {jumboLoading ? "…" : "Buscar"}
                </button>
              </div>

              {jumboResults.length > 0 && (
                <div className="border-border-soft max-h-64 overflow-y-auto rounded-lg border bg-white">
                  {jumboResults.map((c) => (
                    <button
                      type="button"
                      key={c.sku}
                      onClick={() => linkJumbo(c)}
                      className="border-border-soft hover:bg-greenCustom-50 flex w-full cursor-pointer items-center gap-2.5 border-b px-2.5 py-2 text-left last:border-0"
                    >
                      {c.image ? (
                        <Image
                          src={c.image}
                          alt=""
                          width={36}
                          height={36}
                          unoptimized
                          className="h-9 w-9 shrink-0 rounded-md object-contain"
                        />
                      ) : (
                        <div className="bg-bg-soft h-9 w-9 shrink-0 rounded-md" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-text-primary truncate text-xs font-medium">
                          {c.name}
                        </p>
                        <p className="text-text-muted text-[10px]">
                          SKU {c.sku}
                        </p>
                      </div>
                      <span className="text-text-primary shrink-0 text-xs font-bold">
                        {formatPrice(c.price)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {jumboSearched && !jumboLoading && jumboResults.length === 0 && (
                <p className="text-text-muted py-2 text-center text-[11px]">
                  Sin resultados en Jumbo. Ajusta la búsqueda.
                </p>
              )}

              <button
                type="button"
                onClick={() => setJumboOpen(false)}
                className="text-text-muted hover:text-text-primary cursor-pointer text-[11px] font-semibold"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openJumboSearch}
              className="border-border-soft bg-bg-card text-text-secondary hover:border-greenCustom-300 hover:text-greenCustom-700 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border-[1.5px] py-2.5 text-sm font-semibold transition-colors"
            >
              <Link2 className="h-4 w-4" strokeWidth={1.75} /> Buscar en Jumbo
            </button>
          )}
          <p className="text-text-muted mt-1 mb-0 text-[11px]">
            Vincula el producto para poder llenar el carro de Jumbo con un clic.
          </p>
        </div>

        {/* Buttons */}
        <div className="mt-1 flex gap-2.5">
          <button
            onClick={onCancel}
            className="border-border-soft bg-bg-card text-text-secondary hover:bg-bg-soft flex-1 cursor-pointer rounded-xl border-[1.5px] py-2.5 text-sm font-semibold transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!form.name.trim()) return;
              onSave(form);
            }}
            className="bg-button-primary flex-2 cursor-pointer rounded-xl border-none py-2.5 text-sm font-bold text-white transition-all hover:opacity-90"
          >
            {initial ? "Guardar cambios" : "Agregar producto"}
          </button>
        </div>
      </div>
    </div>
  );
}
