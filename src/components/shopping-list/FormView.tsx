"use client";

import { useState } from "react";
import type { ShoppingListItem, Unit } from "@/types/shopping";
import {
  CATEGORIES,
  UNITS,
  CATEGORY_META,
  EMPTY_FORM,
  type FormState,
} from "./constants";
import { Toggle } from "./Toggle";

export function FormView({
  initial,
  onSave,
  onCancel,
}: {
  initial: ShoppingListItem | null;
  onSave: (form: FormState) => void;
  onCancel: () => void;
}) {
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
        }
      : EMPTY_FORM,
  );

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
