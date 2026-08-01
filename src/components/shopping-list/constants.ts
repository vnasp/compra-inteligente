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

const UNITS: Unit[] = ["un", "kg", "L", "g", "ml"];

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
  category: string;
  quantity: string;
  unit: Unit;
  package_size: string;
  package_unit: Unit;
  is_required: boolean;
  jumbo_sku: string | null;
  jumbo_name: string | null;
  /** Imagen del producto en Supermercado — transitoria, solo para la vista previa. */
  jumbo_image: string | null;
  last_price: number | null;
  price_updated_at: string | null;
}

export const EMPTY_FORM: FormState = {
  name: "",
  category: "Despensa",
  quantity: "1",
  unit: "un",
  package_size: "",
  package_unit: "g",
  is_required: true,
  jumbo_sku: null,
  jumbo_name: null,
  jumbo_image: null,
  last_price: null,
  price_updated_at: null,
};
