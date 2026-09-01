# Avattar CRM

CRM comercial a la medida para Avattar IT Solutions (México, Colombia, Chile).
Next.js + Supabase. **Antes de escribir código, lee `CLAUDE.md`** — ahí está el
contexto de negocio, el estatus de cada módulo y las decisiones ya tomadas.

## Arranque

```bash
npm install

# Instalar la CLI de Supabase si no la tienes:
#   https://supabase.com/docs/guides/cli/getting-started
npm run supabase:start        # levanta Postgres + Studio local, aplica las
                               # migraciones de supabase/migrations/ automáticamente
npm run supabase:types        # genera types/supabase.ts a partir del esquema

cp .env.example .env.local
# Llenar NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y
# SUPABASE_SERVICE_ROLE_KEY con lo que imprime `supabase start` (o con los
# valores del proyecto remoto si no se usa local).

npm run dev                   # http://localhost:3000
```

## Estructura

```
app/                  Next.js App Router (páginas y Route Handlers)
components/           Componentes de UI compartidos
lib/supabase/         Clientes de Supabase (server.ts, client.ts)
types/supabase.ts      Tipos generados desde el esquema (no editar a mano)
supabase/migrations/   Esquema de base de datos, en orden de aplicación
docs/                  Documentos de negocio: alcance, catálogo de
                       funcionalidades, guion de descubrimiento con el cliente
```

## Estado actual

- ✅ Esquema de base de datos completo (30 tablas, 2 vistas), validado contra
  Postgres real.
- ⚠️ RLS habilitado sin políticas — el frontend con clave `anon` no puede leer
  ni escribir todavía. Ver `CLAUDE.md`.
- ⚠️ Sin UI construida — este repo arranca desde cero en el frontend.
- ⚠️ Sin SSO de Entra ID configurado todavía (placeholder en
  `supabase/config.toml`).

## Siguiente paso sugerido

Definir y aplicar las políticas RLS antes de construir cualquier pantalla que
lea o escriba datos — sin ellas, ningún flujo funcionará más allá de scripts
con `service_role`.
