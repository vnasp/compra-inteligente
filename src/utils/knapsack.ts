import type { ShoppingListItem } from "@/types/shopping";

export interface KnapsackItem {
  id: string;
  name: string;
  brand: string;
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
}

export function solveKnapsack(
  items: KnapsackItem[],
  budget: number,
): KnapsackResult {
  const required = items.filter((i) => i.is_required);
  const optional = items.filter((i) => !i.is_required);

  const requiredCost = required.reduce((s, i) => s + (i.cost ?? 0), 0);
  const remaining = Math.max(0, budget - requiredCost);
  const overBudget = requiredCost > budget;

  // Items sin precio van a "included" con warning (no se pueden optimizar)
  const withPrice = optional.filter((i) => i.cost !== null && i.cost > 0);
  const withoutPrice = optional.filter((i) => i.cost === null || i.cost === 0);

  // Knapsack 0/1: maximizar cantidad de productos dentro del presupuesto restante
  const n = withPrice.length;
  const cap = remaining;

  if (n === 0 || cap <= 0) {
    return {
      required,
      included: withoutPrice,
      excluded: withPrice,
      requiredCost,
      includedCost: 0,
      totalCost: requiredCost,
      budget,
      overBudget,
    };
  }

  // DP table: dp[j] = max number of items that fit in capacity j
  const dp = new Int32Array(cap + 1).fill(0);
  const keep: boolean[][] = [];

  for (let i = 0; i < n; i++) {
    const w = withPrice[i].cost!;
    const row: boolean[] = new Array(cap + 1).fill(false);

    for (let j = cap; j >= w; j--) {
      if (dp[j - w] + 1 > dp[j]) {
        dp[j] = dp[j - w] + 1;
        row[j] = true;
      }
    }
    keep.push(row);
  }

  // Backtrack to find selected items
  const selected = new Set<number>();
  let j = cap;
  for (let i = n - 1; i >= 0; i--) {
    if (keep[i][j]) {
      selected.add(i);
      j -= withPrice[i].cost!;
    }
  }

  const included: KnapsackItem[] = [];
  const excluded: KnapsackItem[] = [];

  for (let i = 0; i < n; i++) {
    if (selected.has(i)) {
      included.push(withPrice[i]);
    } else {
      excluded.push(withPrice[i]);
    }
  }

  // Items sin precio se incluyen (no podemos excluirlos sin info)
  included.push(...withoutPrice);

  const includedCost = included.reduce((s, i) => s + (i.cost ?? 0), 0);

  return {
    required,
    included,
    excluded,
    requiredCost,
    includedCost,
    totalCost: requiredCost + includedCost,
    budget,
    overBudget,
  };
}

export function buildKnapsackItems(
  items: ShoppingListItem[],
  stockLevels: Record<string, number>,
  suggestedQtyFn: (item: ShoppingListItem, level: number | null) => number,
  formatQtyFn: (item: ShoppingListItem, qty: number) => string,
): KnapsackItem[] {
  return items
    .filter(
      (i) => i.is_active && suggestedQtyFn(i, stockLevels[i.id] ?? null) > 0,
    )
    .map((i) => {
      const qty = suggestedQtyFn(i, stockLevels[i.id] ?? null);
      const unitCost = i.last_price ?? null;
      return {
        id: i.id,
        name: i.name,
        brand: i.brand,
        cost: unitCost ? unitCost * qty : null,
        qty,
        is_required: i.is_required,
        unit: i.unit,
        formatQty: formatQtyFn(i, qty),
      };
    });
}
