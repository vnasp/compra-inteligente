"use client";

import { Wallet, CircleCheck, CalendarPlus } from "lucide-react";

interface TopBarProps {
  remainingBudget: number;
  budgetDisplay: string;
  pctUsed: number;
  lastScrapeTs: string | null;
  nextShoppingDate: string;
  nextShoppingDateISO: string | null;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} días`;
}

function openGoogleCalendar(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  const next = new Date(d);
  next.setDate(next.getDate() + 1);

  const fmt = (dt: Date) =>
    [
      dt.getFullYear(),
      String(dt.getMonth() + 1).padStart(2, "0"),
      String(dt.getDate()).padStart(2, "0"),
    ].join("");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "🛒 Compra del mes — Smart Pantry",
    dates: `${fmt(d)}/${fmt(next)}`,
    details: "Compra mensual generada por Smart Pantry.",
  });

  window.open(
    `https://calendar.google.com/calendar/render?${params}`,
    "_blank",
  );
}

export function TopBar({
  remainingBudget,
  budgetDisplay,
  pctUsed,
  lastScrapeTs,
  nextShoppingDate,
  nextShoppingDateISO,
}: TopBarProps) {
  return (
    <div className="border-border-soft bg-bg-card mx-6 mt-5 mb-1 flex shrink-0 items-center rounded-2xl border px-6 py-4">
      {/* Presupuesto disponible */}
      <div className="flex items-center gap-3 pr-6">
        <div className="bg-greenCustom-100 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Wallet className="text-greenCustom-700 h-5 w-5" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-text-muted text-xs">Presupuesto disponible</p>
          <p
            className={`text-xl font-bold ${remainingBudget < 0 ? "text-danger" : "text-text-primary"}`}
          >
            {budgetDisplay}
          </p>
        </div>
      </div>

      <div className="bg-border-soft mx-4 h-10 w-px shrink-0" />

      {/* % utilizado */}
      <div className="flex-1 px-2">
        <p className="text-text-primary mb-2 text-sm font-semibold">
          {pctUsed}% utilizado este mes
        </p>
        <div className="bg-border-soft h-2 w-full overflow-hidden rounded-full">
          <div
            className={`h-full rounded-full transition-all ${pctUsed >= 100 ? "bg-danger" : pctUsed >= 80 ? "bg-warning" : "bg-greenCustom-700"}`}
            style={{ width: `${pctUsed}%` }}
          />
        </div>
      </div>

      <div className="bg-border-soft mx-4 h-10 w-px shrink-0" />

      {/* Último scraping */}
      <div className="flex items-center gap-2.5 px-2">
        <CircleCheck
          className={`h-6 w-6 shrink-0 ${lastScrapeTs ? "text-greenCustom-600" : "text-text-muted"}`}
          strokeWidth={1.75}
        />
        <div>
          <p className="text-text-muted text-xs">Último scraping</p>
          <p className="text-text-primary text-sm font-medium">
            {lastScrapeTs
              ? `Jumbo · ${timeAgo(lastScrapeTs)}`
              : "Sin datos aún"}
          </p>
        </div>
      </div>

      <div className="bg-border-soft mx-4 h-10 w-px shrink-0" />

      {/* Próxima compra */}
      <div className="flex items-center gap-2.5 pl-2">
        <div className="bg-greenCustom-100 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <CalendarPlus
            className="text-greenCustom-700 h-5 w-5"
            strokeWidth={1.75}
          />
        </div>
        <div>
          <p className="text-text-muted text-xs">Próxima compra</p>
          <p className="text-text-primary text-sm font-semibold">
            {nextShoppingDate}
          </p>
        </div>
        {nextShoppingDateISO && (
          <button
            onClick={() => openGoogleCalendar(nextShoppingDateISO)}
            title="Agregar al Calendario"
            className="border-border-soft bg-bg-soft text-text-muted hover:border-greenCustom-200 hover:bg-greenCustom-100 hover:text-greenCustom-700 ml-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-all"
          >
            <CalendarPlus className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>
    </div>
  );
}
