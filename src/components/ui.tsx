import { getStockConfig } from "@/utils/stock";

export function StockBadge({ level }: { level: number | null }) {
  if (level === null)
    return <span className="text-xs text-slate-400 italic">Sin datos</span>;
  const cfg = getStockConfig(level);
  return (
    <span
      className="rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

export function ChevronRight() {
  return (
    <svg
      className="h-3 w-3 text-slate-400"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-100/80 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
