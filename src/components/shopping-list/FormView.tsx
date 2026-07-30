"use client";

import { useState } from "react";
import Image from "next/image";
import { Search, Check } from "lucide-react";
import type { ShoppingListItem } from "@/types/shopping";
import {
  CATEGORIES,
  CATEGORY_META,
  EMPTY_FORM,
  type FormState,
} from "./constants";
import { formatPrice } from "@/utils/stock";
import { parseSizeFromName, type JumboCandidate } from "@/utils/jumbo";
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
          category: initial.category,
          quantity: String(initial.quantity),
          unit: initial.unit,
          package_size:
            initial.package_size != null ? String(initial.package_size) : "",
          package_unit: initial.package_unit ?? "g",
          is_required: initial.is_required ?? true,
          jumbo_sku: initial.jumbo_sku ?? null,
          jumbo_name: initial.jumbo_name ?? null,
          jumbo_image: null,
          last_price: initial.last_price,
          price_updated_at: initial.price_updated_at,
        }
      : EMPTY_FORM,
  );

  // ── Búsqueda en Supermercado ──
  // El buscador es el punto de entrada: abierto por defecto si aún no hay
  // producto vinculado.
  const [searching, setSearching] = useState(!form.jumbo_sku);
  const [jumboQuery, setJumboQuery] = useState(initial?.name ?? "");
  const [jumboLoading, setJumboLoading] = useState(false);
  const [jumboResults, setJumboResults] = useState<JumboCandidate[]>([]);
  const [jumboSearched, setJumboSearched] = useState(false);

  const runJumboSearch = async () => {
    const q = jumboQuery.trim();
    if (!q) return;
    setJumboLoading(true);
    setJumboSearched(true);
    try {
      const res = await fetch(`/api/jumbo-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? "Error consultando Supermercado");
      setJumboResults((data.results ?? []) as JumboCandidate[]);
    } catch (err) {
      setJumboResults([]);
      toast.error(
        err instanceof Error ? err.message : "Error consultando Supermercado",
      );
    } finally {
      setJumboLoading(false);
    }
  };

  // Al elegir un producto de Supermercado se autocompleta toda su identidad.
  const selectProduct = (c: JumboCandidate) => {
    const parsed = parseSizeFromName(c.name);
    setForm((f) => ({
      ...f,
      name: c.name,
      package_size: parsed ? String(parsed.size) : "",
      package_unit: parsed ? parsed.unit : f.package_unit,
      unit: parsed ? parsed.unit : "un",
      jumbo_sku: c.sku,
      jumbo_name: c.name,
      jumbo_image: c.image,
      last_price: c.price,
      price_updated_at: new Date().toISOString(),
    }));
    setSearching(false);
  };

  const changeProduct = () => {
    setJumboQuery(form.jumbo_name ?? form.name ?? "");
    setJumboResults([]);
    setJumboSearched(false);
    setSearching(true);
  };

  const inputClass =
    "w-full px-3 py-2.5 rounded-xl border-[1.5px] border-border-soft bg-bg-soft text-sm text-text-primary outline-none box-border focus:border-greenCustom-400";
  const labelClass = "block font-semibold text-xs text-text-secondary mb-1";

  const qtyLabel = form.package_size
    ? `${form.quantity || "?"} × ${form.package_size} ${form.package_unit}`
    : `${form.quantity || "?"} ${form.unit}`;

  const hasProduct = Boolean(form.jumbo_sku);
  const showConfig = (hasProduct || Boolean(initial)) && !searching;
  const canSave =
    (hasProduct || Boolean(initial)) && !searching && Number(form.quantity) > 0;

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <h3 className="text-text-primary mt-0 mb-1 text-base font-bold">
        {initial ? "Editar producto" : "Nuevo producto"}
      </h3>
      <p className="text-text-muted mb-4 text-xs">
        Busca el producto en Supermercado; el precio y los datos se completan
        solos.
      </p>

      <div className="flex flex-col gap-4">
        {/* ── Producto (Supermercado) ── */}
        <div>
          <label className={labelClass}>Producto</label>

          {hasProduct && !searching ? (
            // Producto vinculado
            <div className="border-greenCustom-200 bg-greenCustom-50 flex items-center gap-2.5 rounded-xl border-[1.5px] p-2.5">
              {form.jumbo_image ? (
                <Image
                  src={form.jumbo_image}
                  alt=""
                  width={44}
                  height={44}
                  unoptimized
                  className="h-11 w-11 shrink-0 rounded-lg bg-white object-contain"
                />
              ) : (
                <div className="bg-greenCustom-100 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg">
                  <Check
                    className="text-greenCustom-600 h-5 w-5"
                    strokeWidth={2.5}
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-greenCustom-900 truncate text-sm font-semibold">
                  {form.jumbo_name}
                </p>
                <p className="text-greenCustom-700 text-[11px]">
                  {form.last_price
                    ? formatPrice(form.last_price)
                    : "Sin precio"}{" "}
                  · SKU {form.jumbo_sku}
                </p>
              </div>
              <button
                type="button"
                onClick={changeProduct}
                className="text-greenCustom-700 hover:bg-greenCustom-100 shrink-0 cursor-pointer rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
              >
                Cambiar
              </button>
            </div>
          ) : (
            // Buscador
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
                    }}
                    placeholder="Ej. Leche Colun 1 L"
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
                      onClick={() => selectProduct(c)}
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
                  Sin resultados en Supermercado. Ajusta la búsqueda.
                </p>
              )}

              {hasProduct && (
                <button
                  type="button"
                  onClick={() => setSearching(false)}
                  className="text-text-muted hover:text-text-primary cursor-pointer text-[11px] font-semibold"
                >
                  Cancelar
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Configuración (solo con producto elegido) ── */}
        {showConfig && (
          <>
            {/* Categoría */}
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

            {/* Cantidad a comprar */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className={`${labelClass} mb-0`}>
                  Cantidad a comprar *
                </label>
                <span className="bg-greenCustom-100 text-greenCustom-700 rounded-full px-2.5 py-0.5 text-xs font-bold">
                  {qtyLabel}
                </span>
              </div>
              <input
                className={inputClass}
                type="number"
                min="1"
                step="1"
                placeholder="ej. 2"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
              <p className="text-text-muted mt-1 mb-0 text-[11px]">
                Cuántos envases de este producto compras al mes.
              </p>
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
          </>
        )}

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
              if (!canSave) return;
              onSave(form);
            }}
            disabled={!canSave}
            className="bg-button-primary flex-2 cursor-pointer rounded-xl border-none py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {initial ? "Guardar cambios" : "Agregar producto"}
          </button>
        </div>
      </div>
    </div>
  );
}
