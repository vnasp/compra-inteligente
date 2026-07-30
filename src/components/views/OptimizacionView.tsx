"use client";

import { useState } from "react";
import {
  CircleCheck,
  RefreshCw,
  Sparkles as SparklesIcon,
  ShoppingCart,
  ExternalLink,
  Check,
  Copy,
  Bookmark,
  Terminal,
  X,
} from "lucide-react";
import { CATEGORY_META } from "@/components/shopping-list/constants";
import { suggestedQty, formatPrice } from "@/utils/stock";
import type { KnapsackItem, KnapsackResult } from "@/utils/knapsack";
import {
  buildCartSnippet,
  buildCartBookmarklet,
  CART_BOOKMARK_NAME,
} from "@/utils/jumbo";
import type { ShoppingListItem, PriceHistorySummary } from "@/types/shopping";
import { useToast } from "@/components/ui/Toast";

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} días`;
}

interface OptimizacionViewProps {
  items: ShoppingListItem[];
  stockRemaining: Record<string, number>;
  boughtThisCycle: Record<string, number>;
  knapsackResult: KnapsackResult | null;
  priceHistory: Record<string, PriceHistorySummary>;
  scraping: boolean;
  scrapeMsg: string;
  lastScrapeTs: string | null;
  onScrape: () => void;
  onGenerateOptimal: () => void;
  onShareWhatsApp: (result: KnapsackResult) => void;
  onMarkPurchased: (
    rows: { item_id: string; quantity: number }[],
  ) => void | Promise<void>;
  /** Persiste la lista para que el bookmarklet la lea desde el supermercado */
  onSaveCartSnapshot: (
    rows: { skuId: string; quantity: number }[],
  ) => void | Promise<void>;
  onOpenList: () => void;
}

export function OptimizacionView({
  items,
  stockRemaining,
  boughtThisCycle,
  knapsackResult,
  priceHistory,
  scraping,
  scrapeMsg,
  lastScrapeTs,
  onScrape,
  onGenerateOptimal,
  onShareWhatsApp,
  onMarkPurchased,
  onSaveCartSnapshot,
  onOpenList,
}: OptimizacionViewProps) {
  const toast = useToast();
  const [expandedSection, setExpandedSection] = useState<
    Record<string, boolean>
  >({});
  const [excludedOpen, setExcludedOpen] = useState(false);
  const [markOpen, setMarkOpen] = useState(false);
  // item_id → comprado (true) / no había (false)
  const [markState, setMarkState] = useState<Record<string, boolean>>({});
  const [marking, setMarking] = useState(false);

  const qtyOf = (item: ShoppingListItem) =>
    suggestedQty(
      item,
      stockRemaining[item.id] ?? null,
      boughtThisCycle[item.id] ?? 0,
    );

  // ── Datos derivados ─────────────────────────────────────────────────────
  const displayResult = knapsackResult;
  const selectedItems = displayResult
    ? [...displayResult.required, ...displayResult.included]
    : [];
  // Cuántos productos necesitan compra este ciclo (para calcular cobertura).
  const totalNeeded = items.filter((i) => qtyOf(i) > 0).length;
  const coverage = displayResult
    ? Math.min(
        100,
        Math.round(
          ((displayResult.required.length + displayResult.included.length) /
            Math.max(1, totalNeeded)) *
            100,
        ),
      )
    : 0;
  const estimatedSavings = items.reduce((sum, item) => {
    const hist = priceHistory[item.id];
    if (!hist?.prevPrice || !item.last_price) return sum;
    const drop = hist.prevPrice - item.last_price;
    return drop > 0 ? sum + drop * qtyOf(item) : sum;
  }, 0);

  // Items de la lista óptima que se pueden marcar como comprados
  const markableItems: KnapsackItem[] = displayResult
    ? [...displayResult.required, ...displayResult.included]
    : [];

  const openMark = () => {
    const initial: Record<string, boolean> = {};
    for (const k of markableItems) initial[k.id] = true; // comprado por defecto
    setMarkState(initial);
    setMarkOpen(true);
  };

  const handleConfirmMark = async () => {
    const rows = markableItems
      .filter((k) => markState[k.id])
      .map((k) => ({ item_id: k.id, quantity: k.qty }));
    if (rows.length === 0) {
      setMarkOpen(false);
      return;
    }
    setMarking(true);
    try {
      await onMarkPurchased(rows);
      toast.success(
        `${rows.length} producto${rows.length !== 1 ? "s" : ""} marcado${rows.length !== 1 ? "s" : ""} como comprado${rows.length !== 1 ? "s" : ""}`,
      );
      setMarkOpen(false);
    } catch {
      toast.error("No se pudo registrar la compra");
    } finally {
      setMarking(false);
    }
  };

  // ── Llenar carro en Supermercado ──
  const [cartWarnOpen, setCartWarnOpen] = useState(false);
  // Instrucciones + snippet para pegar en la consola de Jumbo (ver utils/jumbo:
  // el deep link de VTEX murió y el BFF solo acepta llamadas desde su origen).
  const [cartHelpOpen, setCartHelpOpen] = useState(false);
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [bookmarkletCopied, setBookmarkletCopied] = useState(false);
  const [snapshotSaved, setSnapshotSaved] = useState(false);
  // El marcador permanente solo sirve sobre https: desde el sitio del
  // supermercado el navegador bloquea pedir a http:// por contenido mixto.
  const appOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const canUseBookmarklet = appOrigin.startsWith("https://");

  // Cruza la lista óptima con los items para leer el jumbo_sku.
  const linkedRows = markableItems
    .map((k) => ({ k, item: items.find((i) => i.id === k.id) }))
    .filter((x) => x.item?.jumbo_sku)
    .map((x) => ({ sku: x.item!.jumbo_sku!, qty: x.k.qty }));
  const unlinkedItems = markableItems
    .map((k) => ({ k, item: items.find((i) => i.id === k.id) }))
    .filter((x) => !x.item?.jumbo_sku);

  // Unidades totales (sku × cantidad): es lo que cuenta el carro del
  // supermercado, así que sirve para cuadrar lo que quedó agregado.
  const totalUnits = markableItems.reduce((s, k) => s + k.qty, 0);
  const linkedUnits = linkedRows.reduce((s, r) => s + r.qty, 0);

  const copy = async (text: string, mark: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      mark(true);
      setTimeout(() => mark(false), 2500);
    } catch {
      toast.error("No se pudo copiar; selecciona el texto y cópialo a mano");
    }
  };

  const openJumboCart = async () => {
    if (linkedRows.length === 0) return;
    setCartHelpOpen(true);
    // Se guarda al abrir el modal para que el marcador permanente encuentre
    // esta lista, sin depender de que se copie nada.
    try {
      await onSaveCartSnapshot(
        linkedRows.map((r) => ({ skuId: r.sku, quantity: r.qty })),
      );
      setSnapshotSaved(true);
    } catch {
      setSnapshotSaved(false);
    }
  };

  const handleFillCart = () => {
    if (unlinkedItems.length > 0) {
      setCartWarnOpen(true);
      return;
    }
    openJumboCart();
  };

  return (
    <div className="flex h-full gap-6 overflow-hidden p-6">
      {/* ── Modal: Marcar como comprado ──────────────────────────────────── */}
      {markOpen && (
        <>
          <div
            onClick={() => !marking && setMarkOpen(false)}
            className="fixed inset-0 z-200 bg-black/30 backdrop-blur-sm"
          />
          <div className="border-border-soft bg-bg-card fixed top-1/2 left-1/2 z-201 flex max-h-[85vh] w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border shadow-2xl">
            <div className="border-border-soft flex shrink-0 items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-text-primary text-base font-bold">
                  Marcar como comprado
                </h2>
                <p className="text-text-muted mt-0.5 text-xs">
                  Desmarca los productos que no había en el supermercado.
                </p>
              </div>
              <button
                onClick={() => !marking && setMarkOpen(false)}
                className="text-text-muted hover:bg-bg-soft cursor-pointer rounded-lg p-1.5"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-3">
              <div className="divide-border-soft flex flex-col divide-y">
                {markableItems.map((k) => {
                  const fullItem = items.find((i) => i.id === k.id);
                  const meta = fullItem
                    ? (CATEGORY_META[fullItem.category] ??
                      CATEGORY_META["Despensa"])
                    : null;
                  const bought = markState[k.id] ?? true;
                  return (
                    <div key={k.id} className="flex items-center gap-3 py-2.5">
                      {meta && (
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
                          style={{ background: meta.bg }}
                        >
                          {meta.icon}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm font-medium ${bought ? "text-text-primary" : "text-text-muted line-through"}`}
                        >
                          {k.name}
                        </p>
                        <p className="text-text-muted text-[11px]">
                          {k.formatQty}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setMarkState((prev) => ({
                            ...prev,
                            [k.id]: !bought,
                          }))
                        }
                        className={`shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          bought
                            ? "bg-greenCustom-700 text-white hover:opacity-90"
                            : "bg-bg-soft text-text-muted hover:bg-bg-soft"
                        }`}
                      >
                        {bought ? "Comprado" : "No había"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-border-soft flex shrink-0 items-center justify-between gap-3 border-t px-6 py-4">
              <p className="text-text-muted text-xs">
                {markableItems.filter((k) => markState[k.id]).length} de{" "}
                {markableItems.length} comprados
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setMarkOpen(false)}
                  disabled={marking}
                  className="border-border-soft bg-bg-card text-text-secondary hover:bg-bg-soft cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmMark}
                  disabled={marking}
                  className="bg-button-primary cursor-pointer rounded-xl px-5 py-2 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {marking ? "Guardando…" : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Modal: productos sin vincular a Supermercado ────────────────────────── */}
      {cartWarnOpen && (
        <>
          <div
            onClick={() => setCartWarnOpen(false)}
            className="fixed inset-0 z-200 bg-black/30 backdrop-blur-sm"
          />
          <div className="border-border-soft bg-bg-card fixed top-1/2 left-1/2 z-201 flex max-h-[85vh] w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border shadow-2xl">
            <div className="border-border-soft flex shrink-0 items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-text-primary text-base font-bold">
                  Productos sin vincular a Supermercado
                </h2>
                <p className="text-text-muted mt-0.5 text-xs">
                  {unlinkedItems.length} producto
                  {unlinkedItems.length !== 1 ? "s" : ""} no se agregarán al
                  carro porque aún no tienen un equivalente de Supermercado.
                </p>
              </div>
              <button
                onClick={() => setCartWarnOpen(false)}
                className="text-text-muted hover:bg-bg-soft cursor-pointer rounded-lg p-1.5"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-3">
              <div className="divide-border-soft flex flex-col divide-y">
                {unlinkedItems.map(({ k }) => (
                  <div key={k.id} className="flex items-center gap-3 py-2">
                    <span className="text-text-primary text-sm font-medium">
                      {k.name}
                    </span>
                    <span className="text-text-muted ml-auto text-xs">
                      {k.formatQty}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-border-soft flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4">
              <button
                onClick={() => {
                  setCartWarnOpen(false);
                  onOpenList();
                }}
                className="border-border-soft bg-bg-card text-text-secondary hover:bg-bg-soft cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition-all"
              >
                Ir a vincular
              </button>
              <button
                onClick={() => {
                  setCartWarnOpen(false);
                  openJumboCart();
                }}
                disabled={linkedRows.length === 0}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#1fa02e] px-5 py-2 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
              >
                <ExternalLink className="h-4 w-4" strokeWidth={2} />
                Continuar con {linkedRows.length}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Modal: llenar el carro con el snippet ────────────────────────── */}
      {cartHelpOpen && (
        <>
          <div
            onClick={() => setCartHelpOpen(false)}
            className="fixed inset-0 z-200 bg-black/30 backdrop-blur-sm"
          />
          <div className="border-border-soft bg-bg-card fixed top-1/2 left-1/2 z-201 flex max-h-[85vh] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border shadow-2xl">
            <div className="border-border-soft flex shrink-0 items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-text-primary text-base font-bold">
                  Llenar el carro con {linkedRows.length} producto
                  {linkedRows.length !== 1 ? "s" : ""} · {linkedUnits} unidad
                  {linkedUnits !== 1 ? "es" : ""}
                </h2>
                <p className="text-text-muted mt-0.5 text-xs">
                  El supermercado solo acepta cambios al carro desde su propia
                  página, así que el último paso se hace allá. Al terminar, el
                  carro debería marcar {linkedUnits}.
                </p>
              </div>
              <button
                onClick={() => setCartHelpOpen(false)}
                className="text-text-muted hover:bg-bg-soft cursor-pointer rounded-lg p-1.5"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* ── Opción recomendada: marcador permanente ── */}
              <div
                className={`rounded-xl border p-4 ${
                  canUseBookmarklet
                    ? "border-greenCustom-200 bg-greenCustom-50"
                    : "border-border-soft bg-bg-soft"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <Bookmark
                    className="text-greenCustom-700 h-4 w-4 shrink-0"
                    strokeWidth={2}
                  />
                  <h3 className="text-text-primary text-sm font-bold">
                    Marcador (una sola vez, sin consola)
                  </h3>
                </div>
                {canUseBookmarklet ? (
                  <>
                    <ol className="text-text-secondary flex list-decimal flex-col gap-1.5 pl-4 text-[13px] leading-snug">
                      <li>
                        Copia el marcador y créalo en tu navegador con ese texto
                        como dirección, con el nombre{" "}
                        <strong>{CART_BOOKMARK_NAME}</strong>.
                      </li>
                      <li>
                        Estando en el sitio del supermercado con tu sesión
                        iniciada, haz click en el marcador.
                      </li>
                    </ol>
                    <p className="text-text-muted mt-2 text-[11px] leading-snug">
                      Lee siempre tu lista óptima vigente, así que se crea una
                      vez y no hay que rehacerlo cuando la lista cambie.
                    </p>
                  </>
                ) : (
                  <p className="text-text-secondary text-[13px] leading-snug">
                    Disponible cuando abras la app por https. Desde el sitio del
                    supermercado el navegador bloquea las peticiones a{" "}
                    <code className="text-xs">http://localhost</code> por
                    contenido mixto, así que aquí en local usa el código de
                    abajo.
                  </p>
                )}
              </div>

              {/* ── Alternativa: pegar en consola ── */}
              <div className="border-border-soft mt-3 rounded-xl border p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Terminal
                    className="text-text-muted h-4 w-4 shrink-0"
                    strokeWidth={2}
                  />
                  <h3 className="text-text-primary text-sm font-bold">
                    Código para la consola
                  </h3>
                </div>
                <ol className="text-text-secondary flex list-decimal flex-col gap-1.5 pl-4 text-[13px] leading-snug">
                  <li>
                    Copia el código: lleva tus {linkedRows.length} productos
                    dentro.
                  </li>
                  <li>
                    Abre{" "}
                    <a
                      href="https://www.jumbo.cl"
                      target="_blank"
                      rel="noreferrer"
                      className="text-greenCustom-700 font-semibold underline"
                    >
                      el sitio del supermercado
                    </a>{" "}
                    con tu sesión iniciada y tu tienda seleccionada.
                  </li>
                  <li>
                    Abre la consola (⌥⌘C), pega y Enter. Si el código lo pide,
                    abre el carro una vez.
                  </li>
                </ol>
              </div>

              <p className="text-text-muted mt-4 text-[11px] leading-snug">
                Tus datos de sesión no salen de la pestaña del supermercado: el
                código los usa ahí mismo. Esta app solo aporta la lista de
                productos y cantidades
                {snapshotSaved ? " (ya guardada para el marcador)" : ""}.
              </p>
            </div>

            <div className="border-border-soft flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4">
              <button
                onClick={() => setCartHelpOpen(false)}
                className="border-border-soft bg-bg-card text-text-secondary hover:bg-bg-soft cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition-all"
              >
                Cerrar
              </button>
              <button
                onClick={() =>
                  copy(buildCartSnippet(linkedRows), setSnippetCopied)
                }
                className="border-border-default bg-bg-card text-text-primary hover:bg-bg-soft flex cursor-pointer items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition-all"
              >
                {snippetCopied ? (
                  <>
                    <Check className="h-4 w-4" strokeWidth={2.5} /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" strokeWidth={2} /> Copiar código
                  </>
                )}
              </button>
              {canUseBookmarklet && (
                <button
                  onClick={() =>
                    copy(
                      buildCartBookmarklet(
                        appOrigin,
                        process.env.NEXT_PUBLIC_CART_TOKEN,
                      ),
                      setBookmarkletCopied,
                    )
                  }
                  className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-bold text-white transition-all ${
                    bookmarkletCopied
                      ? "bg-success"
                      : "bg-button-primary hover:opacity-90"
                  }`}
                >
                  {bookmarkletCopied ? (
                    <>
                      <Check className="h-4 w-4" strokeWidth={2.5} /> Copiado
                    </>
                  ) : (
                    <>
                      <Bookmark className="h-4 w-4" strokeWidth={2} /> Copiar
                      marcador
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Columna principal ──────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
        {/* Mejor combinación (resultado optimizado) */}
        <div className="border-border-soft bg-bg-card rounded-2xl border p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-text-primary text-base font-bold">
                Mejor combinación para ti
              </h2>
              {displayResult && (
                <span className="bg-greenCustom-100 text-greenCustom-700 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                  <SparklesIcon className="h-3 w-3" strokeWidth={2} />{" "}
                  Optimización activa
                </span>
              )}
            </div>
            <button
              onClick={() => onGenerateOptimal()}
              disabled={items.length === 0}
              className="border-border-default bg-bg-soft text-text-primary hover:bg-greenCustom-100 hover:text-greenCustom-700 flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all disabled:opacity-40"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} /> Recalcular
            </button>
          </div>
          <p className="text-text-muted mt-1 text-sm">
            Seleccionamos la mejor combinación según tu presupuesto y
            prioridades.
          </p>

          {!displayResult ? (
            <div className="mt-6 flex flex-col items-center gap-2 py-8">
              <p className="text-text-secondary font-medium">
                Genera la lista óptima para ver la mejor combinación
              </p>
              <p className="text-text-muted text-xs">
                Actualiza precios primero, luego haz click en Recalcular
              </p>
              <button
                onClick={() => onGenerateOptimal()}
                disabled={items.length === 0}
                className="text-text-primary mt-3 cursor-pointer rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
              >
                Generar Lista Óptima
              </button>
            </div>
          ) : (
            <>
              {displayResult.overBudget && (
                <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-800">
                    ⚠️ Tus requeridos no caben en el presupuesto
                  </p>
                  <p className="mt-1 text-xs leading-snug text-amber-700">
                    {displayResult.requiredDropped.length} producto
                    {displayResult.requiredDropped.length !== 1 ? "s" : ""}{" "}
                    requerido
                    {displayResult.requiredDropped.length !== 1 ? "s" : ""} no
                    entró este ciclo. Necesitarías{" "}
                    <strong>
                      {formatPrice(displayResult.requiredShortfall)}
                    </strong>{" "}
                    más para incluirlos todos. Se priorizaron los que cabían
                    (más productos por tu presupuesto). Súbelos con más
                    presupuesto, márcalos como opcionales, o divídelos en dos
                    compras.
                  </p>
                </div>
              )}
              <div className="mt-4 flex gap-4">
                {/* Stats card */}
                <div className="bg-greenCustom-100 w-52 shrink-0 rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⭐</span>
                    <span className="text-greenCustom-800 text-sm font-bold">
                      {coverage >= 90
                        ? "Muy buena elección"
                        : coverage >= 70
                          ? "Buena cobertura"
                          : "Cobertura parcial"}
                    </span>
                  </div>
                  <p className="text-greenCustom-700 mt-2 text-xs leading-snug">
                    Logramos cubrir el {coverage}% de tus necesidades usando
                    inteligentemente tu presupuesto.
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                    {[
                      {
                        label: "Usado",
                        value: formatPrice(displayResult.totalCost),
                        cls: "text-text-primary",
                      },
                      {
                        label: "Ahorro est.",
                        value:
                          estimatedSavings > 0
                            ? formatPrice(estimatedSavings)
                            : "$0",
                        cls: "text-success",
                      },
                      {
                        label: "Cobertura",
                        value: `${coverage}%`,
                        cls: "text-text-primary",
                      },
                    ].map(({ label, value, cls }) => (
                      <div key={label}>
                        <p className="text-greenCustom-700 text-[10px]">
                          {label}
                        </p>
                        <p className={`text-xs font-bold ${cls}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-greenCustom-200 mt-3 h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-greenCustom-700 h-full rounded-full transition-all"
                      style={{ width: `${coverage}%` }}
                    />
                  </div>
                </div>

                {/* Productos seleccionados */}
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary mb-3 text-sm font-semibold">
                    Productos seleccionados ({selectedItems.length})
                  </p>
                  <div className="divide-border-soft flex flex-col divide-y">
                    {(expandedSection["selected"]
                      ? selectedItems
                      : selectedItems.slice(0, 3)
                    ).map((kItem) => {
                      const fullItem = items.find((i) => i.id === kItem.id);
                      const meta = fullItem
                        ? (CATEGORY_META[fullItem.category] ??
                          CATEGORY_META["Despensa"])
                        : null;
                      const hist = priceHistory[kItem.id];
                      const isCheapest =
                        hist?.minPrice != null &&
                        fullItem?.last_price === hist.minPrice;
                      const savings =
                        hist?.prevPrice &&
                        fullItem?.last_price &&
                        hist.prevPrice > fullItem.last_price
                          ? hist.prevPrice - fullItem.last_price
                          : 0;
                      return (
                        <div
                          key={kItem.id}
                          className="flex items-center gap-3 py-2.5"
                        >
                          {meta && (
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
                              style={{ background: meta.bg }}
                            >
                              {meta.icon}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-text-primary truncate text-sm font-medium">
                              {kItem.name}
                            </p>
                            <p className="text-text-muted text-[11px]">
                              {kItem.formatQty}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-text-primary text-sm font-bold">
                              {kItem.cost ? formatPrice(kItem.cost) : "—"}
                            </p>
                            {isCheapest && (
                              <span className="bg-success-bg text-success rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                                Mejor precio
                              </span>
                            )}
                            {!isCheapest && savings > 0 && (
                              <span className="bg-tag-important-bg text-tag-important-text rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                                Ahorro {formatPrice(savings)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedItems.length > 3 && (
                    <button
                      onClick={() =>
                        setExpandedSection((p) => ({
                          ...p,
                          selected: !p["selected"],
                        }))
                      }
                      className="text-greenCustom-600 hover:text-greenCustom-700 mt-2 flex cursor-pointer items-center gap-1 text-xs font-semibold"
                    >
                      {expandedSection["selected"]
                        ? "Ver menos ↑"
                        : `Ver todos los ${selectedItems.length} productos ↓`}
                    </button>
                  )}
                </div>
              </div>

              {/* Excluidos */}
              {displayResult.excluded.length > 0 && (
                <div className="border-border-soft mt-4 border-t pt-4">
                  <button
                    onClick={() => setExcludedOpen(!excludedOpen)}
                    className="text-text-muted flex w-full cursor-pointer items-center gap-1 text-[11px] font-semibold"
                  >
                    <svg
                      className={`h-3 w-3 transition-transform ${excludedOpen ? "rotate-90" : ""}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    No incluidos por presupuesto (
                    {displayResult.excluded.length})
                  </button>
                  {excludedOpen && (
                    <div className="divide-border-soft mt-2 flex flex-col divide-y opacity-60">
                      {displayResult.excluded.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between py-2"
                        >
                          <p className="text-text-muted flex items-center gap-1.5 text-xs">
                            <span className="line-through">
                              {item.name} — {item.formatQty}
                            </span>
                            {item.is_required && (
                              <span className="bg-tag-essential-bg text-tag-essential-text rounded-full px-1.5 py-0.5 text-[9px] font-bold no-underline">
                                Requerido
                              </span>
                            )}
                          </p>
                          <span className="text-text-muted text-xs">
                            {item.cost ? formatPrice(item.cost) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => onGenerateOptimal()}
                  disabled={items.length === 0}
                  className="bg-accent-gold-soft text-text-primary flex-1 cursor-pointer rounded-xl py-2.5 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                >
                  Generar Lista Óptima
                </button>
                <button
                  onClick={openMark}
                  disabled={markableItems.length === 0}
                  className="bg-greenCustom-700 hover:bg-greenCustom-800 flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
                >
                  <ShoppingCart className="h-4 w-4" strokeWidth={2} /> Marcar
                  como comprado
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Panel derecho ───────────────────────────────────────────────── */}
      <div className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto">
        {/* Card 1: Precios */}
        <div className="border-border-soft bg-bg-card rounded-2xl border p-4">
          <h3 className="text-text-primary mb-3 font-bold">
            Precios actualizados
          </h3>
          <div className="bg-bg-soft flex items-center gap-3 rounded-xl px-3 py-2.5">
            <div className="bg-greenCustom-700 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white">
              J
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-text-primary text-sm font-semibold">
                Supermercado
              </p>
              <p className="text-text-muted truncate text-[11px]">
                {lastScrapeTs
                  ? `Actualizado ${timeAgo(lastScrapeTs)}`
                  : "Sin actualizar aún"}
              </p>
            </div>
            <CircleCheck
              className={`h-5 w-5 shrink-0 ${lastScrapeTs ? "text-greenCustom-600" : "text-text-muted"}`}
              strokeWidth={1.75}
            />
          </div>
          <button
            onClick={onScrape}
            disabled={scraping}
            className="bg-greenCustom-700 hover:bg-greenCustom-800 mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${scraping ? "animate-spin" : ""}`}
              strokeWidth={2}
            />
            {scraping ? "Actualizando…" : "Actualizar precios"}
          </button>
          {scrapeMsg && (
            <p className="text-text-muted mt-2 text-center text-[11px]">
              {scrapeMsg}
            </p>
          )}
          {lastScrapeTs && !scrapeMsg && (
            <p className="text-text-muted mt-2 text-center text-[11px]">
              Última actualización completa: {timeAgo(lastScrapeTs)}
            </p>
          )}
        </div>

        {/* Card 2: Acciones de la lista óptima */}
        <div className="border-border-soft bg-bg-card rounded-2xl border p-4">
          <h3 className="text-text-primary mb-3 font-bold">Tu lista óptima</h3>
          {displayResult ? (
            <div className="flex flex-col gap-2">
              {/* Contador para cuadrar con el carro del supermercado, que
                  cuenta unidades (sku × cantidad), no productos distintos. */}
              <div className="border-border-soft divide-border-soft bg-bg-soft mb-1 flex items-stretch divide-x rounded-xl border">
                {[
                  { label: "Productos", value: markableItems.length },
                  { label: "Unidades", value: totalUnits },
                ].map(({ label, value }) => (
                  <div key={label} className="flex-1 px-3 py-2 text-center">
                    <p className="text-text-primary text-lg leading-tight font-bold">
                      {value}
                    </p>
                    <p className="text-text-muted text-[11px]">{label}</p>
                  </div>
                ))}
              </div>
              {unlinkedItems.length > 0 && (
                <p className="text-text-muted -mt-1 mb-1 text-center text-[11px] leading-snug">
                  Al carro van {linkedUnits} unidades: {unlinkedItems.length}{" "}
                  producto{unlinkedItems.length !== 1 ? "s" : ""} sin vincular
                  quedan fuera.
                </p>
              )}
              <button
                onClick={() => onShareWhatsApp(displayResult)}
                className="cursor-pointer rounded-xl bg-[#25D366] py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
              >
                Compartir por WhatsApp
              </button>
              <button
                onClick={handleFillCart}
                disabled={markableItems.length === 0}
                className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#1fa02e] py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
              >
                <ExternalLink className="h-4 w-4" strokeWidth={2} /> Llenar
                carro en Supermercado
              </button>
            </div>
          ) : (
            <p className="text-text-muted text-xs">
              Genera la lista óptima para compartirla o llenar el carro de
              Supermercado con un click.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
