# Smart Pantry - Optimizador de Compras

Aplicación web para optimizar las compras del supermercado. Gestiona una lista de compras con precios, calcula la mejor combinación de productos según tu presupuesto mensual (algoritmo knapsack) y permite escanear tu despensa para sugerir cantidades según nivel de stock.

> Nota: Proyecto personal en desarrollo activo.

## Funcionalidades

- Lista de compras con categorías, marcas, precios y supermercado
- Algoritmo knapsack para optimizar compras según presupuesto
- Escaneo de despensa con niveles de stock (vacío, bajo, medio, lleno)
- Sugerencia automática de cantidades a comprar
- Configuración de presupuesto mensual, días de compra y supermercados
- Registro de compras realizadas
- Soporte para productos por envase y a granel
- Autenticación y middleware con Supabase

## Tecnologías

- Next.js 16 (App Router)
- React 19
- TypeScript
- Supabase (Auth, Database, SSR)
- Tailwind CSS 4

## Estructura del Proyecto

```
smart-pantry/
├── src/
│   ├── app/
│   │   ├── api/             # API routes
│   │   ├── page.tsx         # Página principal
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ShoppingListPanel.tsx
│   │   ├── EscanearDespensa.tsx
│   │   ├── RegistrarCompra.tsx
│   │   ├── ConfigPanel.tsx
│   │   └── shopping-list/
│   ├── utils/
│   │   ├── knapsack.ts      # Algoritmo de optimización
│   │   ├── stock.ts         # Lógica de niveles de stock
│   │   └── supabase/
│   ├── types/
│   │   └── shopping.ts
│   └── middleware.ts
└── supabase/
    └── migrations/          # Migraciones SQL
```
