import type { ShoppingListItem } from "@/types/shopping";

export interface KnapsackItem {
  id: string;
  name: string;
  cost: number | null;
  qty: number;
  is_required: boolean;
  unit: string;
  formatQty: string;
}

export interface KnapsackResult {
  required: KnapsackItem[];
  included: KnapsackItem[];
  excluded: KnapsackItem[];
  requiredCost: number;
  includedCost: number;
  totalCost: number;
  budget: number;
  overBudget: boolean;
  /** Requeridos que no cupieron en el presupuesto (solo los que tienen precio). */
  requiredDropped: KnapsackItem[];
  /** Cuánto más se necesitaría para incluir todos los requeridos que se cayeron. */
  requiredShortfall: number;
}

/**
 * Knapsack 0/1 que maximiza la CANTIDAD de productos que caben en `cap`
 * (no el valor). Favorece los más económicos: entre uno caro y varios baratos,
 * elige los baratos porque suman más productos.
 */
function maxCountKnapsack(
  items: KnapsackItem[],
  cap: number,
): { selected: KnapsackItem[]; rest: KnapsackItem[] } {
  const n = items.length;
  if (n === 0 || cap <= 0) return { selected: [], rest: [...items] };

  // dp[j] = máximo nº de items que caben en capacidad j
  const dp = new Int32Array(cap + 1);
  const keep: boolean[][] = [];

  for (let i = 0; i < n; i++) {
    const w = items[i].cost!;
    const row: boolean[] = new Array(cap + 1).fill(false);
    for (let j = cap; j >= w; j--) {
      if (dp[j - w] + 1 > dp[j]) {
        dp[j] = dp[j - w] + 1;
        row[j] = true;
      }
    }
    keep.push(row);
  }

  const chosen = new Set<number>();
  let j = cap;
  for (let i = n - 1; i >= 0; i--) {
    if (keep[i][j]) {
      chosen.add(i);
      j -= items[i].cost!;
    }
  }

  const selected: KnapsackItem[] = [];
  const rest: KnapsackItem[] = [];
  items.forEach((it, i) => (chosen.has(i) ? selected : rest).push(it));
  return { selected, rest };
}

export function solveKnapsack(
  items: KnapsackItem[],
  budget: number,
): KnapsackResult {
  const required = items.filter((i) => i.is_required);
  const optional = items.filter((i) => !i.is_required);

  const priced = (i: KnapsackItem) => i.cost !== null && i.cost > 0;
  const reqPriced = required.filter(priced);
  const reqUnpriced = required.filter((i) => !priced(i));
  const optPriced = optional.filter(priced);
  const optUnpriced = optional.filter((i) => !priced(i));

  // Fase 1: requeridos tienen prioridad → maximizar cuántos caben en TODO el
  // presupuesto (más baratos primero para que entren más).
  const { selected: reqSelected, rest: requiredDropped } = maxCountKnapsack(
    reqPriced,
    budget,
  );
  const requiredCost = reqSelected.reduce((s, i) => s + (i.cost ?? 0), 0);

  // Fase 2: opcionales optimizan lo que sobra tras los requeridos elegidos.
  const remaining = Math.max(0, budget - requiredCost);
  const { selected: optSelected, rest: optDropped } = maxCountKnapsack(
    optPriced,
    remaining,
  );
  const includedCost = optSelected.reduce((s, i) => s + (i.cost ?? 0), 0);

  // Los sin precio no se pueden optimizar: se incluyen igual con warning.
  const requiredList = [...reqSelected, ...reqUnpriced];
  const includedList = [...optSelected, ...optUnpriced];
  // Excluidos: primero requeridos que no cupieron, luego opcionales.
  const excluded = [...requiredDropped, ...optDropped];

  const requiredShortfall = requiredDropped.reduce(
    (s, i) => s + (i.cost ?? 0),
    0,
  );

  return {
    required: requiredList,
    included: includedList,
    excluded,
    requiredCost,
    includedCost,
    totalCost: requiredCost + includedCost,
    budget,
    overBudget: requiredDropped.length > 0,
    requiredDropped,
    requiredShortfall,
  };
}

export function buildKnapsackItems(
  items: ShoppingListItem[],
  stockRemaining: Record<string, number>,
  suggestedQtyFn: (
    item: ShoppingListItem,
    remaining: number | null,
    bought?: number,
  ) => number,
  formatQtyFn: (item: ShoppingListItem, qty: number) => string,
  boughtThisCycle: Record<string, number> = {},
): KnapsackItem[] {
  return items
    .filter(
      (i) =>
        suggestedQtyFn(
          i,
          stockRemaining[i.id] ?? null,
          boughtThisCycle[i.id] ?? 0,
        ) > 0,
    )
    .map((i) => {
      const qty = suggestedQtyFn(
        i,
        stockRemaining[i.id] ?? null,
        boughtThisCycle[i.id] ?? 0,
      );
      const unitCost = i.last_price ?? null;
      return {
        id: i.id,
        name: i.name,
        cost: unitCost ? unitCost * qty : null,
        qty,
        is_required: i.is_required,
        unit: i.unit,
        formatQty: formatQtyFn(i, qty),
      };
    });
}
