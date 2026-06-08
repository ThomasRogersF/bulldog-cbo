# Bulldog CBO

Sistema de punto de venta (POS) e inventario para **Bulldog CBO**, un negocio de
carritos de perros calientes venezolanos. Interfaz en español (es-VE), pensada como
PWA para escritorio (laptop del carrito) y móvil (teléfonos del equipo y del dueño).

## Stack

- SvelteKit + Svelte 5 (solo runes)
- TypeScript (strict)
- Tailwind CSS 3 — design tokens vía variables CSS
- Supabase (Postgres + Auth + Realtime + Edge Functions)
- PWA (escritorio + móvil)

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo en http://localhost:5173
npm run check      # verificación de tipos (svelte-check)
npm run lint       # prettier + eslint
npm run test       # pruebas unitarias (vitest)
```

### Variables de entorno

Crea un archivo `.env.local` (ignorado por git) con:

```
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...
```

## Convenciones

Las reglas no negociables del proyecto están en [`CLAUDE.md`](./CLAUDE.md). En resumen:

- Solo runes de Svelte 5 (sin `export let`, sin `$:`, sin stores `writable`).
- Todo acceso a datos pasa por `src/lib/db.ts`.
- Todo texto visible pasa por `t()` (`src/lib/i18n`).
- Sin colores, tipografías ni radios hardcodeados — usar variables CSS.

El historial de cambios está en [`CHANGELOG.md`](./CHANGELOG.md).
