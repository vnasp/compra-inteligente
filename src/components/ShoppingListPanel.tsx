"use client";

import { useState, useEffect } from "react";
import type { ShoppingListItem } from "@/types/shopping";
import { createClient } from "@/utils/supabase/client";
import {
  INITIAL_ITEMS,
  CATEGORY_META,
  sortByCategory,
  type FormState,
} from "./shopping-list/constants";
import { ListView } from "./shopping-list/ListView";
import { FormView } from "./shopping-list/FormView";

// Re-exports para compatibilidad con page.tsx
export { INITIAL_ITEMS, CATEGORY_META, sortByCategory };

export function ShoppingListPanel({
  items,
  setItems,
}: {
  items: ShoppingListItem[];
  setItems: React.Dispatch<React.SetStateAction<ShoppingListItem[]>>;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<ShoppingListItem | null>(null);

  // Cargar items desde Supabase al montar
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("shopping_list_items")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setItems(data as ShoppingListItem[]);
      });
  }, [setItems]);

  const handleAdd = () => {
    setEditing(null);
    setView("form");
  };

  const handleEdit = (item: ShoppingListItem) => {
    setEditing(item);
    setView("form");
  };

  const handleToggleActive = async (id: string, val: boolean) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, is_active: val } : i)),
    );
    const supabase = createClient();
    await supabase
      .from("shopping_list_items")
      .update({ is_active: val, updated_at: new Date().toISOString() })
      .eq("id", id);
  };

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    const supabase = createClient();
    await supabase.from("shopping_list_items").delete().eq("id", id);
  };

  const handleSave = async (form: FormState) => {
    const supabase = createClient();
    const payload = {
      name: form.name,
      brand: form.brand,
      category: form.category,
      quantity: parseFloat(form.quantity) || 1,
      unit: form.unit,
      package_size: form.package_size
        ? parseFloat(form.package_size.replace(",", "."))
        : null,
      package_unit: form.package_size ? form.package_unit : null,
      supermarket: form.supermarket,
      is_active: form.is_active,
      is_required: form.is_required,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };

    if (editing) {
      const { data } = await supabase
        .from("shopping_list_items")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single();
      if (data) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === editing.id ? (data as ShoppingListItem) : i,
          ),
        );
      }
    } else {
      const { data } = await supabase
        .from("shopping_list_items")
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select()
        .single();
      if (data) {
        setItems((prev) => [data as ShoppingListItem, ...prev]);
      }
    }
    setEditing(null);
    setView("list");
  };

  const handleCancel = () => {
    setEditing(null);
    setView("list");
  };

  return (
    <div>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir lista de compras"
        className="fixed top-1/2 left-0 z-50 flex h-30 w-11 -translate-y-1/2 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-r-2xl border-none bg-linear-to-b from-indigo-500 to-indigo-700 p-0 shadow-[3px_0_16px_rgba(67,56,202,0.35)]"
      >
        <span className="rotate-180 text-sm font-black tracking-[0.05em] text-white [text-orientation:mixed] [writing-mode:vertical-rl]">
          MI LISTA
        </span>
      </button>

      {/* Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-100 bg-[rgba(12,74,110,0.18)] backdrop-blur-[2px]"
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 bottom-0 left-0 z-101 flex w-120 max-w-[95vw] flex-col bg-slate-50 shadow-[8px_0_32px_rgba(67,56,202,0.12)] transition-transform duration-320 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="relative overflow-hidden bg-linear-to-r from-indigo-600 via-indigo-500 to-indigo-400 px-5 pt-6 pb-5">
          <div className="absolute -top-5 right-7.5 h-20 w-20 rounded-full bg-white opacity-[0.15]" />
          <div className="absolute top-2.5 right-20 h-12.5 w-12.5 rounded-full bg-white opacity-10" />
          <div className="absolute top-10 right-2.5 h-10 w-10 rounded-full bg-white opacity-[0.12]" />

          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="m-0 text-[22px] leading-tight font-black text-white">
                Lista de Compras
              </h2>
              <p className="mt-1 mb-0 text-[13px] text-white/85">
                {items.filter((i) => i.is_active).length} productos activos
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border-none bg-white/20 text-lg text-white"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {view === "list" ? (
            <ListView
              items={items}
              onAdd={handleAdd}
              onEdit={handleEdit}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
            />
          ) : (
            <FormView
              initial={editing}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
