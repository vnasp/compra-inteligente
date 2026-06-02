"use client";

import type { ShoppingListItem } from "@/types/shopping";
import { sortByCategory } from "./constants";
import { ItemRow } from "./ItemRow";

export function ListView({
  items,
  onAdd,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  items: ShoppingListItem[];
  onAdd: () => void;
  onEdit: (item: ShoppingListItem) => void;
  onToggleActive: (id: string, val: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const active = items.filter((i) => i.is_active).length;

  return (
    <div className="flex h-full flex-col">
      {/* Counter */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-indigo-600 px-3 py-0.5 text-[13px] font-extrabold text-white">
            {active} activos
          </span>
          <span className="text-xs text-slate-500">
            de {items.length} productos
          </span>
        </div>
        <button
          onClick={onAdd}
          className="cursor-pointer rounded-xl border-none bg-linear-to-r from-indigo-500 to-indigo-700 px-3.5 py-1.5 text-[13px] font-extrabold text-white shadow-[0_2px_8px_rgba(67,56,202,0.25)]"
        >
          + Agregar
        </button>
      </div>

      {/* List */}
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 pb-4">
        {items.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Tu lista está vacía
          </div>
        ) : (
          sortByCategory(items).map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onEdit={onEdit}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
