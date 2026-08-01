"use client";

import Image from "next/image";
import {
  Home,
  Package,
  Sparkles,
  Clock,
  ClipboardList,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type AppView =
  | "inicio"
  | "inventario"
  | "optimizacion"
  | "historial"
  | "mi-lista"
  | "configuracion";

const NAV_ITEMS: { key: AppView; label: string; Icon: LucideIcon }[] = [
  { key: "inicio", label: "Inicio", Icon: Home },
  { key: "mi-lista", label: "Mi Lista", Icon: ClipboardList },
  { key: "inventario", label: "Inventario", Icon: Package },
  { key: "optimizacion", label: "Optimización", Icon: Sparkles },
  { key: "historial", label: "Historial", Icon: Clock },
  { key: "configuracion", label: "Configuración", Icon: Settings },
];

export function Sidebar({
  active,
  onChange,
}: {
  active: AppView;
  onChange: (v: AppView) => void;
}) {
  return (
    <aside className="sidebar-shell fixed top-0 left-0 flex h-screen w-60 flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 pt-7 pb-6">
        <Image
          src="/logo.png"
          alt="Logo"
          width={60}
          height={60}
          className="shrink-0"
        />
        <h1 className="text-text-primary text-lg leading-tight font-bold">
          Compra
          <br />
          Inteligente
        </h1>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {NAV_ITEMS.map(({ key, label, Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={`sidebar-nav-item ${isActive ? "sidebar-nav-item-active" : ""}`}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Teaser card */}
      <div className="mx-3 mb-4">
        <div className="app-card flex flex-col items-center gap-3 px-4 py-6 text-center">
          <Image
            src="/icon_left.png"
            alt="Icono canasta"
            width={120}
            height={120}
            className="aspect-square"
          />
          <p className="text-brand-700 text-xs leading-snug">
            Optimiza tu presupuesto para que cubras lo que necesitas sin
            pasarte.
          </p>
        </div>
      </div>

      {/* User */}
      <div className="border-border-soft flex items-center gap-2.5 border-t px-4 py-4">
        <div className="bg-brand-700 text-text-inverse flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
          VM
        </div>
        <span className="text-text-primary flex-1 text-sm font-medium">
          Valentina Muñoz
        </span>
      </div>
    </aside>
  );
}
