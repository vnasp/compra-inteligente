"use client";

import { useState, useRef } from "react";
import {
  X,
  FileUp,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  CircleHelp,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  CATEGORY_META,
  sortByCategory,
} from "@/components/shopping-list/constants";
import type { ShoppingListItem, Purchase } from "@/types/shopping";

interface BoletaLine {
  barcode: string;
  rawName: string;
  price: number;
  quantity: number;
}

interface BoletaModalProps {
  items: ShoppingListItem[];
  barcodeMappings: Record<string, string>; // barcode → item_id
  onSave: (newMappings: Record<string, string>, purchase: Purchase) => void;
  onClose: () => void;
}

function parseBoletaText(rawText: string | string[]): BoletaLine[] {
  // Normalize: handle array (unpdf per-page) or merged string; collapse all whitespace to spaces
  const content = (
    Array.isArray(rawText) ? rawText.join(" ") : rawText
  ).replace(/\r\n?/g, "\n");

  const seen: Record<string, BoletaLine> = {};

  // Global regex — doesn't rely on newlines.
  // Format per boleta Jumbo: {EAN-13} {NAME UPPERCASE} {price}
  // Price is either thousands-separated (9.300, 1.690) or plain (770, 850, 900).
  // Lookahead (?=\s|$) prevents "120GR" matching "120" as price.
  const pattern =
    /(\d{13})\s+([\s\S]+?)\s+(\d{1,3}(?:\.\d{3})+|\d{3,4})(?=\s|$)/g;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(content)) !== null) {
    const barcode = m[1];
    const rawName = m[2].replace(/\s+/g, " ").trim();
    const price = parseInt(m[3].replace(/\./g, ""), 10);
    if (!price || price <= 0 || price > 999_999) continue;
    if (seen[barcode]) {
      seen[barcode].price += price;
      seen[barcode].quantity += 1;
    } else {
      seen[barcode] = { barcode, rawName, price, quantity: 1 };
    }
  }
  return Object.values(seen);
}

// Extracts the final TOTAL from the boleta text (not SUB TOTAL or NETO).
// Jumbo format: " TOTAL $ 56.054 "
function extractBoletaTotal(rawText: string | string[]): number | null {
  const content = Array.isArray(rawText) ? rawText.join(" ") : rawText;
  // Match standalone TOTAL line — negative lookbehind on "SUB" and "NETO"
  const matches = [...content.matchAll(/(?<![A-Z])TOTAL\s+\$\s*([\d.]+)/g)];
  if (matches.length === 0) return null;
  // Use the last match (the final TOTAL, not SUB TOTAL)
  const last = matches[matches.length - 1];
  return parseInt(last[1].replace(/\./g, ""), 10) || null;
}

function today(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function BoletaModal({
  items,
  barcodeMappings,
  onSave,
  onClose,
}: BoletaModalProps) {
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [lines, setLines] = useState<BoletaLine[]>([]);
  // barcode → item_id or "ignore"
  const [localMappings, setLocalMappings] = useState<Record<string, string>>(
    {},
  );
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [boletaTotal, setBoletaTotal] = useState("");
  const [autoMatchedOpen, setAutoMatchedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".pdf")) {
      setParseError("El archivo debe ser un PDF.");
      return;
    }
    setParsing(true);
    setParseError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-boleta", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al procesar el PDF");
      const parsed = parseBoletaText(json.text as string | string[]);
      if (parsed.length === 0)
        throw new Error(
          "No se encontraron líneas con código de barras en el PDF.",
        );
      const extracted = extractBoletaTotal(json.text as string | string[]);
      setLines(parsed);
      setBoletaTotal(extracted ? extracted.toLocaleString("es-CL") : "");
      setStep("review");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
    } finally {
      setParsing(false);
    }
  };

  const autoMatched = lines.filter((l) => barcodeMappings[l.barcode]);
  const unmatched = lines.filter((l) => !barcodeMappings[l.barcode]);

  // Items available for a specific unmatched row (excludes globally mapped + selected in other rows)
  const availableFor = (barcode: string): ShoppingListItem[] => {
    const globallyMapped = new Set(Object.values(barcodeMappings));
    const sessionMapped = new Set(
      Object.entries(localMappings)
        .filter(([bc, v]) => bc !== barcode && v && v !== "ignore")
        .map(([, v]) => v),
    );
    return sortByCategory(
      items.filter(
        (i) => !globallyMapped.has(i.id) && !sessionMapped.has(i.id),
      ),
    );
  };

  const setMapping = (barcode: string, value: string) => {
    setLocalMappings((prev) => ({ ...prev, [barcode]: value }));
  };

  // Codes mapped this session (confirmed, not ignored)
  const mappedCount =
    autoMatched.length +
    unmatched.filter(
      (l) => localMappings[l.barcode] && localMappings[l.barcode] !== "ignore",
    ).length;

  // Parse the editable total field (Chilean format: "56.054" → 56054)
  const parsedTotal =
    parseInt(boletaTotal.replace(/\./g, "").replace(/\D/g, ""), 10) || 0;

  const handleConfirm = async () => {
    setSaving(true);
    const newMappings: { barcode: string; item_id: string }[] = [];
    for (const [barcode, value] of Object.entries(localMappings)) {
      if (value && value !== "ignore") {
        newMappings.push({ barcode, item_id: value });
      }
    }

    const supabase = createClient();

    if (newMappings.length > 0) {
      await supabase.from("pantry_barcode_mappings").upsert(newMappings);
    }

    const { data } = await supabase
      .from("pantry_purchases")
      .insert({
        amount: parsedTotal,
        supermarket: "Jumbo",
        purchased_at: purchaseDate,
        tag: "Boleta",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    setSaving(false);
    if (data) {
      const newMappingsRecord: Record<string, string> = {};
      for (const m of newMappings) newMappingsRecord[m.barcode] = m.item_id;
      onSave(newMappingsRecord, data as Purchase);
    }
    onClose();
  };

  // Group available items by category for <optgroup>
  const groupedItems = (available: ShoppingListItem[]) => {
    const groups: Record<string, ShoppingListItem[]> = {};
    for (const item of available) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="border-border-soft bg-bg-card fixed top-1/2 left-1/2 z-50 flex max-h-[88vh] w-[min(680px,95vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border shadow-2xl">
        {/* Header */}
        <div className="border-border-soft flex shrink-0 items-center justify-between border-b px-6 py-4">
          <div>
            <p className="text-text-muted text-xs font-medium">Jumbo · PDF</p>
            <h2 className="text-text-primary text-base font-bold">
              {step === "upload" ? "Subir boleta" : "Revisar boleta"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {step === "review" && (
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="border-border-soft bg-bg-soft text-text-primary focus:border-greenCustom-400 cursor-pointer rounded-lg border px-3 py-1.5 text-sm outline-none"
              />
            )}
            <button
              onClick={onClose}
              className="text-text-muted hover:bg-bg-soft cursor-pointer rounded-lg p-1.5"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Step 1: upload ── */}
          {step === "upload" && (
            <div className="flex h-full min-h-64 flex-col items-center justify-center p-8">
              <input
                ref={inputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <button
                onClick={() => inputRef.current?.click()}
                disabled={parsing}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFile(f);
                }}
                className="border-border-default bg-bg-soft hover:border-greenCustom-400 hover:bg-greenCustom-50 flex w-full cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-8 py-12 transition-colors disabled:opacity-60"
              >
                <div className="bg-bg-card flex h-14 w-14 items-center justify-center rounded-2xl">
                  <FileUp
                    className="text-text-muted h-7 w-7"
                    strokeWidth={1.5}
                  />
                </div>
                <div className="text-center">
                  <p className="text-text-primary font-semibold">
                    {parsing
                      ? "Procesando PDF…"
                      : "Arrastra el PDF o haz clic para seleccionar"}
                  </p>
                  <p className="text-text-muted mt-1 text-xs">
                    Boleta de compra de Jumbo en formato PDF
                  </p>
                </div>
              </button>
              {parseError && (
                <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">
                  {parseError}
                </p>
              )}
            </div>
          )}

          {/* ── Step 2: review ── */}
          {step === "review" && (
            <div className="p-6">
              {/* Auto-matched section */}
              {autoMatched.length > 0 && (
                <div className="mb-5">
                  <button
                    onClick={() => setAutoMatchedOpen((v) => !v)}
                    className="mb-2 flex w-full cursor-pointer items-center gap-2 text-left"
                  >
                    <CheckCircle2
                      className="text-greenCustom-600 h-4 w-4 shrink-0"
                      strokeWidth={2}
                    />
                    <span className="text-greenCustom-700 text-sm font-semibold">
                      Reconocidos automáticamente ({autoMatched.length})
                    </span>
                    {autoMatchedOpen ? (
                      <ChevronUp
                        className="text-text-muted ml-auto h-4 w-4"
                        strokeWidth={1.75}
                      />
                    ) : (
                      <ChevronDown
                        className="text-text-muted ml-auto h-4 w-4"
                        strokeWidth={1.75}
                      />
                    )}
                  </button>
                  {autoMatchedOpen && (
                    <div className="border-greenCustom-100 bg-greenCustom-50/50 rounded-xl border">
                      {autoMatched.map((line) => {
                        const item = items.find(
                          (i) => i.id === barcodeMappings[line.barcode],
                        );
                        const meta = item
                          ? (CATEGORY_META[item.category] ??
                            CATEGORY_META["Despensa"])
                          : null;
                        return (
                          <div
                            key={line.barcode}
                            className="border-greenCustom-100/60 flex items-center gap-3 border-b px-4 py-2.5 last:border-0"
                          >
                            {meta && (
                              <span
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm"
                                style={{ background: meta.bg }}
                              >
                                {meta.icon}
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-text-primary truncate text-sm font-medium">
                                {item?.name ?? line.rawName}
                              </p>
                              <p className="text-text-muted text-[10px]">
                                {line.barcode}
                              </p>
                            </div>
                            {line.quantity > 1 && (
                              <span className="text-text-muted text-xs">
                                ×{line.quantity}
                              </span>
                            )}
                            <span className="text-text-primary text-sm font-semibold">
                              ${line.price.toLocaleString("es-CL")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Unmatched section */}
              {unmatched.length > 0 && (
                <div>
                  <div className="mb-2">
                    <div className="flex items-center gap-2">
                      <CircleHelp
                        className="h-4 w-4 shrink-0 text-amber-500"
                        strokeWidth={2}
                      />
                      <span className="text-text-primary text-sm font-semibold">
                        Sin código de barra asignado ({unmatched.length})
                      </span>
                    </div>
                    <p className="text-text-muted mt-1 text-xs">
                      Asigna el producto de tu lista para guardar el código.
                      &ldquo;Ignorar&rdquo; omite solo el código — el precio
                      igual se suma al total de la boleta.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {unmatched.map((line) => {
                      const available = availableFor(line.barcode);
                      const current = localMappings[line.barcode] ?? "";
                      const ignored = current === "ignore";
                      const groups = groupedItems(available);
                      return (
                        <div
                          key={line.barcode}
                          className={`rounded-xl border px-4 py-3 transition-colors ${ignored ? "border-border-soft bg-bg-soft opacity-50" : "border-amber-200 bg-amber-50/50"}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-text-muted font-mono text-xs">
                                {line.barcode}
                              </p>
                              <p className="text-text-primary mt-0.5 text-sm font-semibold">
                                {line.rawName}
                              </p>
                            </div>
                            {line.quantity > 1 && (
                              <span className="text-text-muted shrink-0 text-xs">
                                ×{line.quantity}
                              </span>
                            )}
                            <span className="text-text-primary shrink-0 text-sm font-bold">
                              ${line.price.toLocaleString("es-CL")}
                            </span>
                          </div>
                          <div className="mt-2.5 flex items-center gap-2">
                            <select
                              value={ignored ? "" : current}
                              disabled={ignored}
                              onChange={(e) =>
                                setMapping(line.barcode, e.target.value)
                              }
                              className="text-text-primary flex-1 cursor-pointer rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <option value="">Selecciona un producto…</option>
                              {Object.entries(groups).map(([cat, catItems]) => (
                                <optgroup
                                  key={cat}
                                  label={`${CATEGORY_META[cat]?.icon ?? ""} ${cat}`}
                                >
                                  {catItems.map((i) => (
                                    <option key={i.id} value={i.id}>
                                      {i.name}
                                      {i.brand ? ` · ${i.brand}` : ""}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            <button
                              onClick={() =>
                                setMapping(
                                  line.barcode,
                                  ignored ? "" : "ignore",
                                )
                              }
                              className={`shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${ignored ? "bg-border-soft text-text-secondary hover:bg-bg-soft" : "text-text-muted hover:bg-amber-100 hover:text-amber-700"}`}
                            >
                              {ignored ? "Deshacer" : "Ignorar"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {lines.length === 0 && (
                <p className="text-text-muted py-12 text-center text-sm">
                  No se detectaron líneas con código de barras.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "review" && (
          <div className="border-border-soft flex shrink-0 items-center gap-4 border-t px-6 py-4">
            <div className="flex-1">
              <p className="text-text-muted mb-1 text-xs">
                {mappedCount} código{mappedCount !== 1 ? "s" : ""} asignado
                {mappedCount !== 1 ? "s" : ""} · {lines.length - mappedCount}{" "}
                sin asignar
              </p>
              <div className="flex items-center gap-2">
                <span className="text-text-secondary text-sm font-semibold">
                  Total boleta
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-text-secondary text-sm font-semibold">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={boletaTotal}
                    onChange={(e) => setBoletaTotal(e.target.value)}
                    placeholder="0"
                    className="border-border-soft bg-bg-soft text-text-primary focus:border-greenCustom-400 w-28 rounded-lg border px-2 py-1 text-base font-bold outline-none"
                  />
                </div>
                {boletaTotal && (
                  <span className="text-text-muted text-[10px]">
                    extraído del PDF · editable
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleConfirm}
              disabled={saving || parsedTotal === 0}
              className="bg-button-primary cursor-pointer rounded-xl px-6 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Confirmar compra"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
