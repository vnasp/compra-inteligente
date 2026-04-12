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
    "w-full px-3 py-2.5 rounded-xl border-[1.5px] border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none box-border";
  const labelClass = "block font-bold text-xs text-slate-700 mb-1";

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <h3 className="mt-0 mb-4 text-base font-black text-slate-800">
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
          <span className="block text-[13px] font-bold text-slate-700">
            Cantidad a comprar
          </span>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-extrabold text-indigo-700">
            {form.package_size
              ? `${form.quantity || "?"} x ${form.package_size} ${form.package_unit}`
              : `${form.quantity || "?"} ${form.unit}`}
          </span>
        </div>
        <div className="flex flex-col gap-2.5 rounded-xl border-[1.5px] border-slate-200 bg-slate-50 p-3.5">
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
          <div className="border-t border-dashed border-slate-200" />

          {/* Row 2: package size */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">
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
            <p className="mt-1 mb-0 text-[11px] text-slate-500">
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
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-[1.5px] py-2 text-sm font-bold transition-colors ${
                form.is_required
                  ? "border-indigo-500 bg-indigo-500 text-white"
                  : "border-slate-200 bg-white text-slate-400 hover:border-indigo-300"
              }`}
            >
              Requerido
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_required: false })}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-[1.5px] py-2 text-sm font-bold transition-colors ${
                !form.is_required
                  ? "border-slate-500 bg-slate-500 text-white"
                  : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
              }`}
            >
              Opcional
            </button>
          </div>
          <p className="mt-1 mb-0 text-[11px] text-slate-500">
            {form.is_required
              ? "Siempre se compra, tiene prioridad en el presupuesto."
              : "Se compra solo si queda presupuesto disponible."}
          </p>
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between rounded-xl border-[1.5px] border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <span className="text-xs font-bold text-slate-700">
            Activo en lista
          </span>
          <Toggle
            checked={form.is_active}
            onChange={(v) => setForm({ ...form, is_active: v })}
          />
        </div>

        {/* Notes */}
        <div>
          <label className={labelClass}>Notas</label>
          <textarea
            className={`${inputClass} min-h-17.5 resize-y`}
            placeholder="ej. Maduros preferiblemente"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        {/* Buttons */}
        <div className="mt-1 flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 cursor-pointer rounded-xl border-[1.5px] border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-500"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!form.name.trim()) return;
              onSave(form);
            }}
            className="flex-2 cursor-pointer rounded-xl border-none bg-linear-to-r from-indigo-500 to-indigo-700 py-2.5 text-sm font-extrabold text-white shadow-[0_2px_8px_rgba(67,56,202,0.3)]"
          >
            {initial ? "Guardar cambios" : "Agregar producto"}
          </button>
        </div>
      </div>
    </div>
  );
}
