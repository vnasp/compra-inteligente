"use client";

import { useState } from "react";
import { Pencil, Trash2, Tag, X, Search } from "lucide-react";
import { CategoryTabs } from "@/components/CategoryTabs";
import { FormView } from "@/components/shopping-list/FormView";
import { useToast } from "@/components/ui/Toast";
import {
  CATEGORIES,
  CATEGORY_META,
  sortByCategory,
  type FormState,
} from "@/components/shopping-list/constants";
import type { ShoppingListItem } from "@/types/shopping";

interface MiListaViewProps {
  items: ShoppingListItem[];
  setItems: React.Dispatch<React.SetStateAction<ShoppingListItem[]>>;
}

export function MiListaView({ items, setItems }: MiListaViewProps) {
  const toast = useToast();
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [editing, setEditing] = useState<ShoppingListItem | null>(null);
  const [formResetKey, setFormResetKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("Despensa");
  const [search, setSearch] = useState("");

  const sorted = sortByCategory(items);
  const byCategory =
    activeCategory === "Todos"
      ? sorted
      : sorted.filter((i) => i.category === activeCategory);
  const filtered =
    activeCategory === "Todos" && search.trim()
      ? byCategory.filter((i) =>
          i.name.toLowerCase().includes(search.toLowerCase()),
        )
      : byCategory;

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((i) => next.delete(i.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((i) => next.add(i.id));
        return next;
      });
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkCategoryChange = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setItems((prev) =>
      prev.map((i) =>
        selectedIds.has(i.id) ? { ...i, category: bulkCategory } : i,
      ),
    );
    setSelectedIds(new Set());
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    await supabase
      .from("pantry_shopping_list_items")
      .update({ category: bulkCategory, updated_at: new Date().toISOString() })
      .in("id", ids);
  };

  const handleNew = () => setEditing(null);
  const handleEdit = (item: ShoppingListItem) => setEditing(item);

  const handleToggleRequired = async (id: string, val: boolean) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, is_required: val } : i)),
    );
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    await supabase
      .from("pantry_shopping_list_items")
      .update({ is_required: val, updated_at: new Date().toISOString() })
      .eq("id", id);
  };

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (editing?.id === id) setEditing(null);
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    await supabase.from("pantry_shopping_list_items").delete().eq("id", id);
  };

  const handleSave = async (form: FormState) => {
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    const payload = {
      name: form.name,
      category: form.category,
      quantity: parseFloat(form.quantity) || 1,
      unit: form.unit,
      package_size: form.package_size
        ? parseFloat(form.package_size.replace(",", "."))
        : null,
      package_unit: form.package_size ? form.package_unit : null,
      is_required: form.is_required,
      jumbo_sku: form.jumbo_sku,
      jumbo_name: form.jumbo_name,
      last_price: form.last_price,
      price_updated_at: form.price_updated_at,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editing) {
        const { data, error } = await supabase
          .from("pantry_shopping_list_items")
          .update(payload)
          .eq("id", editing.id)
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setItems((prev) =>
            prev.map((i) =>
              i.id === editing.id ? (data as ShoppingListItem) : i,
            ),
          );
          setEditing(null);
          toast.success("Cambios guardados");
        }
      } else {
        const { data, error } = await supabase
          .from("pantry_shopping_list_items")
          .insert({ ...payload, created_at: new Date().toISOString() })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setItems((prev) => [data as ShoppingListItem, ...prev]);
          setFormResetKey((k) => k + 1);
          toast.success("Producto agregado");
        }
      }
    } catch (err) {
      // Los errores de Supabase son PostgrestError (objeto con `message`), no
      // instancias de Error, por eso los desempaquetamos explícitamente.
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "No se pudo guardar el producto";
      toast.error(msg);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: list ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-8 pr-6">
        {/* Header */}
        <div className="mb-5 flex shrink-0 items-center justify-between">
          <div>
            <h1 className="text-text-primary text-2xl font-bold">Mi Lista</h1>
            <p className="text-text-secondary mt-1 text-sm">
              <span className="text-text-primary font-semibold">
                {items.length}
              </span>{" "}
              {items.length === 1 ? "producto" : "productos"}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-3 shrink-0">
          <CategoryTabs
            items={items}
            activeCategory={activeCategory}
            onSelect={(cat) => {
              setActiveCategory(cat);
              clearSelection();
              setSearch("");
            }}
          />
        </div>

        {/* Search — only in Todos tab */}
        {activeCategory === "Todos" && (
          <div className="relative mb-3 shrink-0">
            <Search
              className="text-text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              strokeWidth={1.75}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="border-border-soft bg-bg-card text-text-primary focus:border-greenCustom-400 placeholder:text-text-muted w-full rounded-xl border py-2.5 pr-4 pl-9 text-sm outline-none"
            />
          </div>
        )}

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="border-greenCustom-200 bg-greenCustom-50 mb-3 flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5">
            <Tag
              className="text-greenCustom-700 h-4 w-4 shrink-0"
              strokeWidth={1.75}
            />
            <span className="text-greenCustom-800 text-sm font-semibold">
              {selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}
            </span>
            <span className="text-greenCustom-400">→</span>
            <select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              className="border-greenCustom-200 text-text-primary flex-1 cursor-pointer rounded-lg border bg-white px-2.5 py-1 text-sm outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c]?.icon} {c}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkCategoryChange}
              className="bg-greenCustom-700 cursor-pointer rounded-lg px-3 py-1 text-xs font-bold text-white transition-all hover:opacity-90"
            >
              Cambiar
            </button>
            <button
              onClick={clearSelection}
              className="text-text-muted hover:bg-greenCustom-100 hover:text-greenCustom-700 cursor-pointer rounded-lg p-1 transition-colors"
              title="Limpiar selección"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Item list */}
        <div className="border-border-soft bg-bg-card flex-1 overflow-y-auto rounded-2xl border">
          {filtered.length === 0 ? (
            <div className="text-text-muted py-16 text-center text-sm">
              Sin productos en esta categoría
            </div>
          ) : (
            <>
              {/* Select-all row */}
              <div className="border-border-soft flex items-center gap-3 border-b px-4 py-2">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAll}
                  className="accent-greenCustom-700 h-4 w-4 cursor-pointer"
                />
                <span className="text-text-muted text-xs">
                  {allVisibleSelected
                    ? "Deseleccionar todos"
                    : "Seleccionar todos"}
                </span>
              </div>

              {filtered.map((item) => {
                const meta =
                  CATEGORY_META[item.category] ?? CATEGORY_META["Despensa"];
                const isEditing = editing?.id === item.id;
                const isChecked = selectedIds.has(item.id);
                return (
                  <div key={item.id}>
                    {/* Main row */}
                    <div
                      className={`border-border-soft flex items-center gap-3 border-b px-4 py-3 transition-colors ${
                        isChecked
                          ? "bg-greenCustom-50"
                          : isEditing
                            ? "bg-bg-soft"
                            : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelect(item.id)}
                        className="accent-greenCustom-700 h-4 w-4 shrink-0 cursor-pointer"
                      />

                      {/* Icon */}
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm"
                        style={{ background: meta.bg }}
                      >
                        {meta.icon}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="text-text-primary truncate text-sm font-semibold">
                          {item.name}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="bg-bg-soft text-text-secondary rounded-full px-2 py-0.5 text-[10px] font-medium">
                            {item.package_size
                              ? `${item.quantity} × ${item.package_size} ${item.package_unit}`
                              : `${item.quantity} ${item.unit}`}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          onClick={() =>
                            handleToggleRequired(item.id, !item.is_required)
                          }
                          title={
                            item.is_required
                              ? "Requerido — click para hacerlo opcional"
                              : "Opcional — click para hacerlo requerido"
                          }
                          className={`cursor-pointer rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                            item.is_required
                              ? "bg-tag-essential-bg text-tag-essential-text hover:opacity-80"
                              : "bg-bg-soft text-text-muted hover:text-text-primary"
                          }`}
                        >
                          {item.is_required ? "Requerido" : "Opcional"}
                        </button>
                        <button
                          onClick={() =>
                            isEditing ? handleNew() : handleEdit(item)
                          }
                          title={isEditing ? "Deseleccionar" : "Editar"}
                          className={`cursor-pointer rounded-lg p-1.5 transition-colors ${
                            isEditing
                              ? "bg-greenCustom-100 text-greenCustom-700"
                              : "text-text-muted hover:bg-bg-soft hover:text-text-primary"
                          }`}
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          title="Eliminar"
                          className="text-text-muted cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ── Right: always-visible form ── */}
      <div className="border-border-soft bg-bg-card my-8 mr-8 w-80 shrink-0 overflow-y-auto rounded-2xl border">
        <FormView
          key={editing?.id ?? `new-${formResetKey}`}
          initial={editing}
          onSave={handleSave}
          onCancel={handleNew}
        />
      </div>
    </div>
  );
}
