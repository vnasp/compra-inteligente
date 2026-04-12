import type { ShoppingListItem, Unit } from "@/types/shopping";

export const CATEGORIES = [
  "Carnes",
  "Pescados",
  "Congelados",
  "Verduras",
  "Frutas",
  "Frescos",
  "Panadería",
  "Limpieza & Higiene",
  "Bebidas",
  "Conservas",
  "Snacks",
  "Despensa",
] as const;

export const UNITS: Unit[] = ["un", "kg", "L", "g", "ml"];

export const CATEGORY_META: Record<
  string,
  { icon: string; bg: string; dot: string }
> = {
  Carnes: { icon: "🥩", bg: "#F1F5F9", dot: "#94A3B8" },
  Pescados: { icon: "🐟", bg: "#F1F5F9", dot: "#94A3B8" },
  Congelados: { icon: "🧊", bg: "#F1F5F9", dot: "#94A3B8" },
  Verduras: { icon: "🥬", bg: "#F1F5F9", dot: "#94A3B8" },
  Frutas: { icon: "🍎", bg: "#F1F5F9", dot: "#94A3B8" },
  Frescos: { icon: "🧀", bg: "#F1F5F9", dot: "#94A3B8" },
  Panadería: { icon: "🍞", bg: "#F1F5F9", dot: "#94A3B8" },
  "Limpieza & Higiene": { icon: "🧴", bg: "#F1F5F9", dot: "#94A3B8" },
  Bebidas: { icon: "🥤", bg: "#F1F5F9", dot: "#94A3B8" },
  Conservas: { icon: "🥫", bg: "#F1F5F9", dot: "#94A3B8" },
  Snacks: { icon: "🍿", bg: "#F1F5F9", dot: "#94A3B8" },
  Despensa: { icon: "📦", bg: "#F1F5F9", dot: "#94A3B8" },
};

export const INITIAL_ITEMS: ShoppingListItem[] = [];

const CATEGORY_ORDER = Object.fromEntries(
  CATEGORIES.map((c, i) => [c, i]),
) as Record<string, number>;

export function sortByCategory<T extends { category: string }>(
  items: T[],
): T[] {
  return [...items].sort(
    (a, b) =>
      (CATEGORY_ORDER[a.category] ?? 999) - (CATEGORY_ORDER[b.category] ?? 999),
  );
}

export interface FormState {
  name: string;
  brand: string;
  category: string;
  quantity: string;
  unit: Unit;
  package_size: string;
  package_unit: Unit;
  supermarket: string;
  is_active: boolean;
  is_required: boolean;
  notes: string;
}

export const EMPTY_FORM: FormState = {
  name: "",
  brand: "",
  category: "Despensa",
  quantity: "1",
  unit: "un",
  package_size: "",
  package_unit: "g",
  supermarket: "Lider",
  is_active: true,
  is_required: true,
  notes: "",
};
