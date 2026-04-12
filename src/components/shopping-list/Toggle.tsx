"use client";

export function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative h-5 w-11 shrink-0 cursor-pointer rounded-full border-none transition-colors duration-200"
      style={{ background: checked ? "#4F46E5" : "#CBD5E1" }}
    >
      <span
        className="absolute top-1/2 block h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.18)] transition-[left] duration-200"
        style={{ left: checked ? "calc(100% - 20px)" : "2px" }}
      />
    </button>
  );
}
