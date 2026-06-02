"use client";

import { CATEGORY_META } from "@/components/shopping-list/constants";

interface CategoryTabsProps {
  items: { category: string }[];
  activeCategory: string;
  onSelect: (cat: string) => void;
}

export function CategoryTabs({
  items,
  activeCategory,
  onSelect,
}: CategoryTabsProps) {
  const uniqueCategories = Array.from(new Set(items.map((i) => i.category)));
  const tabs = ["Todos", ...uniqueCategories];

  const countFor = (cat: string) =>
    cat === "Todos"
      ? items.length
      : items.filter((i) => i.category === cat).length;

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((cat) => {
        const isActive = activeCategory === cat;
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
              isActive
                ? "bg-greenCustom-700 text-white"
                : "bg-bg-soft text-text-muted hover:bg-greenCustom-100 hover:text-greenCustom-700"
            }`}
          >
            {cat !== "Todos" && <span>{CATEGORY_META[cat]?.icon}</span>}
            {cat}
            <span
              className={`rounded-full px-1.5 text-[10px] font-bold ${
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-border-soft text-text-muted"
              }`}
            >
              {countFor(cat)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
