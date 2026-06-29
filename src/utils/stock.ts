import type { ShoppingListItem } from "@/types/shopping";

export const STOCK_LEVELS = [
  {
    value: 0,
    label: "Nada",
    color: "#BE123C",
    bg: "#FFF1F2",
    bar: "#FB7185",
  },
  {
    value: 25,
    label: "Casi Nada",
    color: "#C2410C",
    bg: "#FFF7ED",
    bar: "#FB923C",
  },
  {
    value: 50,
    label: "Medio",
    color: "#A16207",
    bg: "#FEFCE8",
    bar: "#FBBF24",
  },
  {
    value: 100,
    label: "Lleno",
    color: "#15803D",
    bg: "#F0FDF4",
    bar: "#34D399",
  },
] as const;

export function getStockConfig(level: number) {
  if (level <= 0) return STOCK_LEVELS[0];
  if (level <= 25) return STOCK_LEVELS[1];
  if (level <= 50) return STOCK_LEVELS[2];
  return STOCK_LEVELS[3];
}

export function suggestedQty(
  item: ShoppingListItem,
  level: number | null,
  bought = 0,
): number {
  // Descontamos lo ya comprado este ciclo de la cantidad mensual.
  const remaining = Math.max(0, item.quantity - bought);
  if (remaining === 0) return 0;
  if (level === null) return Math.ceil(remaining);
  return Math.ceil(remaining * (1 - level / 100));
}

export function formatQty(item: ShoppingListItem, qty: number): string {
  if (item.package_size)
    return `${qty} × ${item.package_size} ${item.package_unit}`;
  return `${qty} ${item.unit}`;
}

export function formatPrice(price: number | null): string {
  if (!price) return "";
  return `$${price.toLocaleString("es-CL")}`;
}
