// Reglas de frescura de precios. Viven acá porque la vista (para decidir si
// se puede optimizar) y el scraping (para decidir qué pedir) tienen que usar
// exactamente el mismo criterio: cuando divergieron, un producto que el
// supermercado no matchea dejaba el flujo trabado en "Actualizar precios".
import { PRICE_FRESH_HOURS } from "@/config";
import type { ShoppingListItem } from "@/types/shopping";

function isFresh(ts: string | null | undefined, now: number): boolean {
  if (!ts) return false;
  return new Date(ts).getTime() >= now - PRICE_FRESH_HOURS * 3600_000;
}

/**
 * true si al producto todavía no se le ha pedido precio en esta ventana.
 * Un precio fresco cuenta como intento fresco: las filas anteriores a la
 * migración 001 no tienen `price_attempted_at`.
 */
export function needsPriceAttempt(
  item: Pick<ShoppingListItem, "price_updated_at" | "price_attempted_at">,
  now: number = Date.now(),
): boolean {
  return (
    !isFresh(item.price_attempted_at, now) &&
    !isFresh(item.price_updated_at, now)
  );
}

/**
 * true si el producto no tiene precio utilizable. Entra igual a la lista
 * óptima: `solveKnapsack` lo trata como `cost: null` y no lo carga al
 * presupuesto, así que no es motivo para bloquear la optimización.
 */
export function isUnpriced(
  item: Pick<ShoppingListItem, "last_price">,
): boolean {
  return item.last_price == null;
}
