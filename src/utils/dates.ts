// Utilidades de fechas para el ciclo de compra.
// Las fechas se manejan como strings ISO "YYYY-MM-DD" en hora local (nunca
// `new Date(iso)` a secas, que interpretaría UTC y podría correr un día).

/** Date → "YYYY-MM-DD" en hora local */
export function toISO(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** "YYYY-MM-DD" → Date al mediodía local (evita saltos por zona horaria) */
export function fromISO(iso: string): Date {
  return new Date(iso + "T12:00:00");
}

/** "2026-08-03" → "3 de agosto" */
export function formatLongDate(iso: string): string {
  return fromISO(iso).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
  });
}

/**
 * Próxima compra: la primera fecha marcada que sea hoy o posterior.
 * null si no quedan fechas marcadas por delante.
 */
export function nextShoppingDate(
  dates: string[],
  today = new Date(),
): string | null {
  const todayISO = toISO(today);
  return [...dates].sort().find((d) => d >= todayISO) ?? null;
}

/**
 * Inicio del ciclo cuando no hay `cycle_start` manual: la primera fecha de
 * compra marcada del mes en curso que ya pasó. Si aún no hay compras este mes,
 * el ciclo vigente sigue siendo el que abrió la primera compra del mes anterior.
 * Sin fechas marcadas, cae al día 1 del mes.
 */
export function autoCycleStart(dates: string[], today = new Date()): string {
  const todayISO = toISO(today);
  const monthStart = toISO(new Date(today.getFullYear(), today.getMonth(), 1));
  const past = [...dates].filter((d) => d <= todayISO).sort();

  const thisMonth = past.find((d) => d >= monthStart);
  if (thisMonth) return thisMonth;

  const prevMonthStart = toISO(
    new Date(today.getFullYear(), today.getMonth() - 1, 1),
  );
  const prevMonth = past.find((d) => d >= prevMonthStart && d < monthStart);
  if (prevMonth) return prevMonth;

  return monthStart;
}

/**
 * Grilla del mes para el calendario: semanas de 7 celdas empezando en lunes.
 * Las celdas fuera del mes son null.
 */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay(): 0=Dom … 6=Sáb → offset con la semana empezando en lunes
  const offset = (first.getDay() + 6) % 7;

  const cells: (string | null)[] = Array(offset).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toISO(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Abre Google Calendar con un evento de compra de todo el día en `dateISO` */
export function openGoogleCalendar(dateISO: string) {
  const start = new Date(dateISO + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const compact = (d: Date) => toISO(d).replace(/-/g, "");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "🛒 Compras en el supermercado",
    dates: `${compact(start)}/${compact(end)}`,
    details: "Compra generada por Compra Inteligente.",
  });

  window.open(
    `https://calendar.google.com/calendar/render?${params}`,
    "_blank",
  );
}
