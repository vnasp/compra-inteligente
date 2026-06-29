export type Unit = "un" | "kg" | "L" | "g" | "ml";

export interface ShoppingListItem {
  id: string;
  name: string;
  brand: string;
  category: string;
  /** Cuántos envases/unidades comprar (ej. 2) */
  quantity: number;
  /** Unidad cuando no hay tamaño de envase (ej. "kg" para tomates a granel) */
  unit: Unit;
  /** Tamaño de cada envase, opcional (ej. 850 para "850 g") */
  package_size: number | null;
  /** Unidad del tamaño de envase (ej. "g") */
  package_unit: Unit | null;
  supermarket: string;
  last_price: number | null; // precio en CLP, sin decimales
  price_updated_at: string | null; // ISO timestamp
  /** SKU del producto en Jumbo (VTEX), para armar el carro online */
  jumbo_sku: string | null;
  /** Nombre del producto en Jumbo, para mostrar el vínculo */
  jumbo_name: string | null;
  is_active: boolean;
  /** true = siempre se compra; false = solo si queda presupuesto */
  is_required: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Para crear un ítem (sin campos autogenerados)
export type NewShoppingListItem = Omit<
  ShoppingListItem,
  "id" | "last_price" | "price_updated_at" | "created_at" | "updated_at"
>;

// ── Configuración del usuario ──────────────────────────────────────────
export interface UserConfig {
  id: string;
  monthly_budget: number;
  shopping_days: number[];
  shopping_weekday: number; // 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
  supermarkets: string[];
  /** Inicio del ciclo activo. Si es null, se calcula automáticamente. */
  cycle_start: string | null;
  created_at: string;
  updated_at: string;
}

// ── Historial de precios ───────────────────────────────────────────────
export interface PriceHistorySummary {
  prevPrice: number | null; // precio anterior al actual (para tendencia ↑↓)
  minPrice: number | null; // mínimo histórico registrado
}

// ── Compras realizadas ─────────────────────────────────────────────────
export interface Purchase {
  id: string;
  amount: number;
  supermarket: string;
  purchased_at: string;
  tag: string | null;
  created_at: string;
}

// ── Unidades compradas por producto (para no re-sugerir en el ciclo) ─────
export interface PurchaseItem {
  id: string;
  item_id: string;
  quantity: number;
  purchased_at: string;
  created_at: string;
}
