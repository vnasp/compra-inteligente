"use client";

import { useState } from "react";
import {
  CircleCheck,
  Sparkles as SparklesIcon,
  ExternalLink,
  Check,
  Bookmark,
  X,
} from "lucide-react";
import { CATEGORY_META } from "@/components/shopping-list/constants";
import {
  PurchaseFlowCard,
  type FlowStep,
  type PurchasePhase,
} from "@/components/PurchaseFlowCard";
import { suggestedQty, formatPrice } from "@/utils/stock";
import type { KnapsackItem, KnapsackResult } from "@/utils/knapsack";
import { buildCartBookmarklet, CART_BOOKMARK_NAME } from "@/utils/jumbo";
import type { ShoppingListItem, PriceHistorySummary } from "@/types/shopping";
import { useToast } from "@/components/ui/Toast";
import { PRICE_FRESH_HOURS } from "@/config";

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
  onResetCurrentPurchase: () => void;
  onOpenInventory: () => void;
  onOpenList: () => void;
  onOpenHistory: () => void;
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
  onResetCurrentPurchase,
  onOpenInventory,
  onOpenList,
  onOpenHistory,
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
  const [cartPrepared, setCartPrepared] = useState(false);
  const [purchaseCompleted, setPurchaseCompleted] = useState(false);

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
  const currentPurchaseItems = items.filter((item) => qtyOf(item) > 0);
  const freshPriceCutoff = Date.now() - PRICE_FRESH_HOURS * 3600_000;
  const stalePriceCount = currentPurchaseItems.filter(
    (item) =>
      !item.price_updated_at ||
      new Date(item.price_updated_at).getTime() < freshPriceCutoff,
  ).length;
  const pricesReady = currentPurchaseItems.length > 0 && stalePriceCount === 0;

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
      setCartPrepared(true);
      setPurchaseCompleted(true);
      setMarkOpen(false);
    } catch {
      toast.error("No se pudo registrar la compra");
    } finally {
      setMarking(false);
    }
  };

  // ── Llenar carro en Supermercado ──
  const [cartWarnOpen, setCartWarnOpen] = useState(false);
  // Instrucciones + marcador para llenar el carro (ver utils/jumbo: el deep link
  // de VTEX murió y el BFF solo acepta llamadas desde el origen del super).
  const [cartHelpOpen, setCartHelpOpen] = useState(false);
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

  const handleGenerate = () => {
    setCartPrepared(false);
    setPurchaseCompleted(false);
    onGenerateOptimal();
  };

  const handleCartPrepared = () => {
    setCartPrepared(true);
    setCartHelpOpen(false);
  };

  const handleNewPurchase = () => {
    setCartPrepared(false);
    setPurchaseCompleted(false);
    setBookmarkletCopied(false);
    setSnapshotSaved(false);
    onResetCurrentPurchase();
  };

  const purchasePhase: PurchasePhase = !displayResult
    ? "prepare"
    : purchaseCompleted
      ? "completed"
      : cartPrepared
        ? "cart"
        : "proposal";

  const prepareNeedsPrices =
    purchasePhase === "prepare" &&
    currentPurchaseItems.length > 0 &&
    !pricesReady;
  const prepareHasNoProducts =
    purchasePhase === "prepare" && items.length === 0;
  const prepareHasNoPendingProducts =
    purchasePhase === "prepare" &&
    items.length > 0 &&
    currentPurchaseItems.length === 0;
  const prepareTitle = prepareNeedsPrices
    ? "Actualiza precios antes de optimizar"
    : prepareHasNoProducts
      ? "Agrega productos a tu lista"
      : prepareHasNoPendingProducts
        ? "No hay productos pendientes"
        : "Prepara tu próxima compra";
  const prepareDescription = prepareNeedsPrices
    ? `${stalePriceCount} producto${stalePriceCount !== 1 ? "s tienen" : " tiene"} precios vencidos o sin precio. Actualízalos para generar una propuesta confiable.`
    : prepareHasNoProducts
      ? "Crea una lista con los productos que podrías necesitar para iniciar el flujo de compra."
      : prepareHasNoPendingProducts
        ? "Tu inventario y compras del ciclo indican que no necesitas comprar productos por ahora."
        : "Revisa inventario y lista si hace falta. Cuando estés lista, genera una propuesta optimizada.";
  const prepareCtaLabel = prepareNeedsPrices
    ? scraping
      ? "Actualizando..."
      : "Actualizar precios"
    : prepareHasNoProducts
      ? "Editar lista"
      : prepareHasNoPendingProducts
        ? "Revisar inventario"
        : "Generar Lista Óptima";

  const flowSteps: FlowStep[] = [
    {
      label: "Lista inicial",
      status:
        items.length > 0
          ? "completed"
          : purchasePhase === "prepare"
            ? "current"
            : "pending",
    },
    {
      label: "Inventario revisado",
      status: Object.keys(stockRemaining).length > 0 ? "completed" : "current",
    },
    {
      label: "Precios actualizados",
      status: pricesReady
        ? "completed"
        : currentPurchaseItems.length > 0
          ? "current"
          : "pending",
    },
    {
      label: "Optimización generada",
      status: displayResult ? "completed" : pricesReady ? "current" : "pending",
    },
    {
      label: purchaseCompleted
        ? "Compra realizada"
        : cartPrepared
          ? "Completar compra"
          : "Llenar el carro",
      status: purchaseCompleted
        ? "completed"
        : displayResult
          ? "current"
          : "pending",
    },
  ];

  const flowCopy: Record<
    PurchasePhase,
    {
      title: string;
      description: string;
      statusLabel: string;
      ctaLabel: string;
    }
  > = {
    prepare: {
      statusLabel: "Compra pendiente",
      title: prepareTitle,
      description: prepareDescription,
      ctaLabel: prepareCtaLabel,
    },
    proposal: {
      statusLabel: "Optimización generada",
      title: "Revisa la propuesta",
      description:
        "Ya tienes una lista sugerida. El siguiente paso es llevarla al carro del supermercado.",
      ctaLabel: "Llenar carro",
    },
    cart: {
      statusLabel: "Carro listo",
      title: "Completa la compra",
      description:
        "Cuando hayas terminado la compra, marca los productos como comprados para actualizar el historial.",
      ctaLabel: "Completar compra",
    },
    completed: {
      statusLabel: "Compra completada",
      title: "Compra registrada",
      description:
        "La compra quedó marcada. Puedes revisar el historial o empezar una nueva compra.",
      ctaLabel: "Crear nueva compra",
    },
  };

  const secondaryActions =
    purchasePhase === "prepare"
      ? [
          { label: "Revisar inventario", onClick: onOpenInventory },
          { label: "Editar lista", onClick: onOpenList },
        ]
      : purchasePhase === "proposal" && displayResult
        ? [
            { label: "Recalcular", onClick: handleGenerate },
            {
              label: "Compartir lista",
              onClick: () => onShareWhatsApp(displayResult),
            },
            { label: "Editar lista", onClick: onOpenList },
          ]
        : purchasePhase === "cart" && displayResult
          ? [
              { label: "Llenar carro otra vez", onClick: handleFillCart },
              {
                label: "Compartir lista",
                onClick: () => onShareWhatsApp(displayResult),
              },
            ]
          : [
              { label: "Revisar historial", onClick: onOpenHistory },
              { label: "Actualizar inventario", onClick: onOpenInventory },
            ];

  const handlePrimaryAction = () => {
    if (purchasePhase === "prepare") {
      if (prepareHasNoProducts) {
        onOpenList();
        return;
      }
      if (currentPurchaseItems.length === 0) {
        onOpenInventory();
        return;
      }
      if (!pricesReady) {
        onScrape();
        return;
      }
      handleGenerate();
      return;
    }
    if (purchasePhase === "proposal") {
      handleFillCart();
      return;
    }
    if (purchasePhase === "cart") {
      openMark();
      return;
    }
    handleNewPurchase();
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
          <div className="app-modal fixed top-1/2 left-1/2 z-201 flex max-h-[85vh] w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden">
            <div className="app-modal-header flex shrink-0 items-center justify-between border-b px-6 py-4">
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
              <div className="flex flex-col">
                {markableItems.map((k) => {
                  const fullItem = items.find((i) => i.id === k.id);
                  const meta = fullItem
                    ? (CATEGORY_META[fullItem.category] ??
                      CATEGORY_META["Despensa"])
                    : null;
                  const bought = markState[k.id] ?? true;
                  return (
                    <div
                      key={k.id}
                      className="app-row flex items-center gap-3 border-b py-2.5 last:border-0"
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
                            ? "bg-success text-white hover:opacity-90"
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

            <div className="app-modal-footer flex shrink-0 items-center justify-between gap-3 border-t px-6 py-4">
              <p className="text-text-muted text-xs">
                {markableItems.filter((k) => markState[k.id]).length} de{" "}
                {markableItems.length} comprados
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setMarkOpen(false)}
                  disabled={marking}
                  className="button-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmMark}
                  disabled={marking}
                  className="button-success px-5 py-2"
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
          <div className="app-modal fixed top-1/2 left-1/2 z-201 flex max-h-[85vh] w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden">
            <div className="app-modal-header flex shrink-0 items-center justify-between border-b px-6 py-4">
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
              <div className="flex flex-col">
                {unlinkedItems.map(({ k }) => (
                  <div
                    key={k.id}
                    className="app-row flex items-center gap-3 border-b py-2 last:border-0"
                  >
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

            <div className="app-modal-footer flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4">
              <button
                onClick={() => {
                  setCartWarnOpen(false);
                  onOpenList();
                }}
                className="button-secondary"
              >
                Ir a vincular
              </button>
              <button
                onClick={() => {
                  setCartWarnOpen(false);
                  openJumboCart();
                }}
                disabled={linkedRows.length === 0}
                className="button-success px-5 py-2"
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
          <div className="app-modal fixed top-1/2 left-1/2 z-201 flex max-h-[85vh] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden">
            <div className="app-modal-header flex shrink-0 items-center justify-between border-b px-6 py-4">
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
                    ? "border-brand-200 bg-bg-card"
                    : "border-border-soft bg-bg-soft"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <Bookmark
                    className="text-brand-700 h-4 w-4 shrink-0"
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

              <p className="text-text-muted mt-4 text-[11px] leading-snug">
                Tus datos de sesión no salen de la pestaña del supermercado: el
                código los usa ahí mismo. Esta app solo aporta la lista de
                productos y cantidades
                {snapshotSaved ? " (ya guardada para el marcador)" : ""}.
              </p>
            </div>

            <div className="app-modal-footer flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4">
              <button
                onClick={() => setCartHelpOpen(false)}
                className="button-secondary"
              >
                Cerrar
              </button>
              <button onClick={handleCartPrepared} className="button-success">
                Ya llené el carro
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
                  className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-bold transition-all ${
                    bookmarkletCopied
                      ? "bg-success text-white"
                      : "button-secondary"
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
        <PurchaseFlowCard
          phase={purchasePhase}
          title={flowCopy[purchasePhase].title}
          description={flowCopy[purchasePhase].description}
          statusLabel={flowCopy[purchasePhase].statusLabel}
          steps={flowSteps}
          ctaLabel={flowCopy[purchasePhase].ctaLabel}
          ctaDisabled={
            (purchasePhase === "prepare" && scraping) ||
            (purchasePhase === "proposal" && markableItems.length === 0) ||
            (purchasePhase === "cart" && markableItems.length === 0)
          }
          onCta={handlePrimaryAction}
          secondaryActions={secondaryActions}
        />

        {/* Mejor combinación (resultado optimizado) */}
        <div className="app-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-text-primary text-base font-bold">
                Mejor combinación para ti
              </h2>
              {displayResult && (
                <span className="badge-success">
                  <SparklesIcon className="h-3 w-3" strokeWidth={2} />{" "}
                  Optimización activa
                </span>
              )}
            </div>
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
                Sigue el CTA principal para actualizar precios y optimizar esta
                compra
              </p>
            </div>
          ) : (
            <>
              {displayResult.overBudget && (
                <div className="app-row border-warning-border mt-4 rounded-xl border p-4">
                  <p className="text-warning text-sm font-bold">
                    ⚠️ Tus requeridos no caben en el presupuesto
                  </p>
                  <p className="text-warning mt-1 text-xs leading-snug">
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
                <div className="stat-card-premium w-52 shrink-0 pb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⭐</span>
                    <span className="text-text-primary text-sm font-bold">
                      {coverage >= 90
                        ? "Muy buena elección"
                        : coverage >= 70
                          ? "Buena cobertura"
                          : "Cobertura parcial"}
                    </span>
                  </div>
                  <p className="text-success mt-2 text-xs leading-snug">
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
                        <p className="text-text-muted text-[10px]">{label}</p>
                        <p className={`text-xs font-bold ${cls}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-bg-soft mt-3 h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-success h-full rounded-full transition-all"
                      style={{ width: `${coverage}%` }}
                    />
                  </div>
                </div>

                {/* Productos seleccionados */}
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary mb-3 text-sm font-semibold">
                    Productos seleccionados ({selectedItems.length})
                  </p>
                  <div className="flex flex-col">
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
                          className="app-row flex items-center gap-3 border-b py-2.5 last:border-0"
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
                              <span className="chip-success">Mejor precio</span>
                            )}
                            {!isCheapest && savings > 0 && (
                              <span className="chip-success">
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
                      className="text-brand-700 hover:text-brand-800 mt-2 flex cursor-pointer items-center gap-1 text-xs font-semibold"
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
                <div className="mt-5 pt-1">
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
                    <div className="mt-2 flex flex-col opacity-60">
                      {displayResult.excluded.map((item) => (
                        <div
                          key={item.id}
                          className="app-row flex items-center justify-between border-b py-2 last:border-0"
                        >
                          <p className="text-text-muted flex items-center gap-1.5 text-xs">
                            <span className="line-through">
                              {item.name} — {item.formatQty}
                            </span>
                            {item.is_required && (
                              <span className="chip-brand no-underline">
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
            </>
          )}
        </div>
      </div>

      {/* ── Panel derecho ───────────────────────────────────────────────── */}
      <div className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto">
        {/* Card 1: Precios */}
        <div className="app-card p-4">
          <h3 className="text-text-primary mb-3 font-bold">
            Precios actualizados
          </h3>
          <div className="app-row flex items-center gap-3 rounded-xl px-3 py-2.5">
            <div className="icon-box-brand h-9 w-9 text-sm font-bold">J</div>
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
              className={`h-5 w-5 shrink-0 ${lastScrapeTs ? "text-success" : "text-text-muted"}`}
              strokeWidth={1.75}
            />
          </div>
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
        <div className="app-card p-4">
          <h3 className="text-text-primary mb-3 font-bold">Tu lista óptima</h3>
          {displayResult ? (
            <div className="flex flex-col gap-2">
              {/* Contador para cuadrar con el carro del supermercado, que
                  cuenta unidades (sku × cantidad), no productos distintos. */}
              <div className="app-row divide-border-soft mb-1 flex items-stretch divide-x rounded-xl border">
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
            </div>
          ) : (
            <p className="text-text-muted text-xs">
              Genera la optimización para ver la mejor combinación según tu
              presupuesto.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
