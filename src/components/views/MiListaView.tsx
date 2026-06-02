"use client";

import { useState } from "react";
import { Pencil, Trash2, Tag, X, StickyNote, Search } from "lucide-react";
import { CategoryTabs } from "@/components/CategoryTabs";
import { FormView } from "@/components/shopping-list/FormView";
import { Toggle } from "@/components/shopping-list/Toggle";
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
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [editing, setEditing] = useState<ShoppingListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("Despensa");
  const [noteId, setNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
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
  const activeCount = items.filter((i) => i.is_active).length;

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

  const openNote = (item: ShoppingListItem) => {
    setNoteId(item.id);
    setNoteText(item.notes ?? "");
  };
  const closeNote = () => {
    setNoteId(null);
    setNoteText("");
  };
  const saveNote = async (id: string) => {
    const value = noteText.trim() || null;
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, notes: value } : i)),
    );
    closeNote();
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    await supabase
      .from("pantry_shopping_list_items")
      .update({ notes: value, updated_at: new Date().toISOString() })
      .eq("id", id);
  };

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

  const handleToggleActive = async (id: string, val: boolean) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, is_active: val } : i)),
    );
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    await supabase
      .from("pantry_shopping_list_items")
      .update({ is_active: val, updated_at: new Date().toISOString() })
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
      brand: form.brand || null,
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
        .from("pantry_shopping_list_items")
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
        setEditing(null);
      }
    } else {
      const { data } = await supabase
        .from("pantry_shopping_list_items")
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select()
        .single();
      if (data) {
        setItems((prev) => [data as ShoppingListItem, ...prev]);
      }
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
                {activeCount} activos
              </span>{" "}
              de {items.length} productos
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
                const isNoteOpen = noteId === item.id;
                return (
                  <div key={item.id}>
                    {/* Main row */}
                    <div
                      className={`border-border-soft flex items-center gap-3 border-b px-4 py-3 transition-colors ${
                        isNoteOpen ? "border-b-0" : ""
                      } ${
                        isChecked
                          ? "bg-greenCustom-50"
                          : isEditing
                            ? "bg-bg-soft"
                            : !item.is_active
                              ? "opacity-50"
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
                          {item.brand && (
                            <span className="text-text-muted text-xs">
                              {item.brand}
                            </span>
                          )}
                          <span className="bg-bg-soft text-text-secondary rounded-full px-2 py-0.5 text-[10px] font-medium">
                            {item.package_size
                              ? `${item.quantity} × ${item.package_size} ${item.package_unit}`
                              : `${item.quantity} ${item.unit}`}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              item.is_required
                                ? "bg-tag-essential-bg text-tag-essential-text"
                                : "bg-bg-soft text-text-muted"
                            }`}
                          >
                            {item.is_required ? "Requerido" : "Opcional"}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Toggle
                          checked={item.is_active}
                          onChange={(v) => handleToggleActive(item.id, v)}
                        />
                        <button
                          onClick={() =>
                            isNoteOpen ? closeNote() : openNote(item)
                          }
                          title={item.notes ? "Ver nota" : "Agregar nota"}
                          className={`cursor-pointer rounded-lg p-1.5 transition-colors ${
                            item.notes
                              ? "text-amber-500 hover:bg-amber-50"
                              : isNoteOpen
                                ? "bg-amber-100 text-amber-600"
                                : "text-text-muted hover:bg-bg-soft hover:text-amber-500"
                          }`}
                        >
                          <StickyNote
                            className="h-3.5 w-3.5"
                            strokeWidth={1.75}
                          />
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

                    {/* Inline note panel */}
                    {isNoteOpen && (
                      <div className="border-border-soft border-b bg-amber-50/60 px-4 pt-2 pb-3">
                        <textarea
                          autoFocus
                          rows={2}
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") closeNote();
                            if (e.key === "Enter" && e.metaKey)
                              saveNote(item.id);
                          }}
                          placeholder="Escribe una nota para este producto..."
                          className="text-text-primary placeholder:text-text-muted w-full resize-none rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
                        />
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-text-muted text-[10px]">
                            ⌘↵ para guardar · Esc para cerrar
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={closeNote}
                              className="text-text-muted hover:text-text-primary cursor-pointer rounded-lg px-3 py-1 text-xs transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => saveNote(item.id)}
                              className="cursor-pointer rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-white transition-all hover:opacity-90"
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ── Right: always-visible form ── */}
      <div className="border-border-soft bg-bg-card w-80 shrink-0 overflow-y-auto border-l">
        <FormView
          key={editing?.id ?? "new"}
          initial={editing}
          onSave={handleSave}
          onCancel={handleNew}
        />
      </div>
    </div>
  );
}
