import type { ShoppingListItem } from "@/types/shopping";

/**
 * Categorías perecederas: no se compran una vez al mes porque se echan a perder,
 * se recompran cada vez según lo que queda hoy. Para ellas NO se descuenta lo ya
 * comprado en el ciclo (`bought`), a diferencia de la despensa de compra mensual.
 */
const PERISHABLE_CATEGORIES = new Set(["Frutas", "Verduras"]);

function isPerishable(item: ShoppingListItem): boolean {
  return PERISHABLE_CATEGORIES.has(item.category);
}

/**
 * Cuántos envases/unidades hay que comprar de un producto en el ciclo actual.
 *
 * Modelo: `quantity` es el objetivo mensual, `remaining` es lo que queda hoy en
 * la despensa (en las mismas unidades que `quantity`) y `bought` es lo ya
 * comprado en el ciclo. La sugerencia es la diferencia, redondeada hacia arriba.
 *
 * Excepción perecederos (Frutas/Verduras): `bought` no se descuenta, porque no
 * se abastecen para todo el mes de una vez; se sugieren cada compra según el
 * stock que queda hoy.
 *
 * @param remaining  lo que queda hoy; null = sin escanear ⇒ se asume 0.
 */
export function suggestedQty(
  item: ShoppingListItem,
  remaining: number | null,
  bought = 0,
): number {
  const have = remaining ?? 0;
  const alreadyBought = isPerishable(item) ? 0 : bought;
  const need = item.quantity - alreadyBought - have;
  return Math.max(0, Math.ceil(need));
}

/** Fracción del objetivo mensual que tienes hoy (0..1). */
export function stockRatio(remaining: number | null, quantity: number): number {
  if (!quantity) return 0;
  const have = remaining ?? 0;
  return Math.max(0, Math.min(1, have / quantity));
}

/** Colores y etiqueta de la barra de stock según la fracción restante (0..1). */
export function stockAppearance(ratio: number): {
  label: string;
  color: string;
  bg: string;
  bar: string;
} {
  if (ratio <= 0)
    return {
      label: "Sin stock",
      color: "var(--color-danger-700)",
      bg: "var(--color-danger-bg)",
      bar: "var(--color-danger)",
    };
  if (ratio < 0.5)
    return {
      label: "Poco",
      color: "var(--color-warning-700)",
      bg: "var(--color-warning-bg)",
      bar: "var(--color-warning)",
    };
  if (ratio < 1)
    return {
      label: "Medio",
      color: "var(--color-warning-700)",
      bg: "var(--color-warning-bg)",
      bar: "var(--color-warning)",
    };
  return {
    label: "Completo",
    color: "var(--color-success-700)",
    bg: "var(--color-success-bg)",
    bar: "var(--color-success)",
  };
}

/** Unidad en que se cuenta el stock/objetivo mensual de un producto. */
export function stockUnit(item: ShoppingListItem): string {
  return item.package_size ? "env." : item.unit;
}

/** Formatea una cantidad de stock sin decimales innecesarios (1, 1.5, 0.25). */
export function formatAmount(n: number): string {
  return Number(n.toFixed(3)).toString().replace(".", ",");
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
