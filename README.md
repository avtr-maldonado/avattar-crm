# Avattar CRM

CRM de ventas a la medida para Avattar IT Solutions (México, Colombia, Chile).
Reemplaza a Pipedrive. Gobierna **margen** y **cobro**, no solo etapas.

**Antes de escribir código, lee `CLAUDE.md`.** Ahí están los quince invariantes,
la nomenclatura y las cinco reglas que más se rompen. La especificación completa
está en `docs/CRM-AVTR-SPEC.md`.

## Arranque

```bash
pnpm install

cp .env.example .env.local
# Llenar con los valores del proyecto de Supabase EN LA NUBE.
# Las cadenas de conexión salen de: Dashboard → Connect → ORMs → Prisma.

pnpm db:generate              # cliente de Prisma (no requiere conexión)
pnpm db:seed                  # escenario del prototipo aprobado
pnpm dev                      # http://localhost:3000
```

### Sobre las cadenas de conexión

Van al proyecto de la nube, no a un Postgres local: el SSO de Entra ID está
configurado ahí, y ahí se aplican y verifican las migraciones.

El **puerto** es lo que distingue las dos variables, no el host:

| Variable | Puerto | Modo | Para qué |
|---|---|---|---|
| `DATABASE_URL` | 6543 | transacción | La aplicación, en cada request. Exige `?pgbouncer=true` |
| `DIRECT_URL` | 5432 | sesión | Migraciones y `pnpm db:seed` |

**No uses `db.<ref>.supabase.co` para `DIRECT_URL`.** Esa es la conexión directa
y solo publica IPv6; en una red IPv4 el seed falla con `ENETUNREACH` sin
mencionar IPv6 por ningún lado. El pooler en modo sesión hace lo mismo sobre
IPv4.

## Estructura

```
app/                    Next.js App Router
  (auth)/               login, callback de Entra ID, sin-acceso
  (app)/                pantallas P-01 a P-11
components/ui/          primitivas del sistema de diseño (§13 del spec)
lib/
  db.ts                 PrismaClient · solo lib/scope y lib/domain lo importan
  scope/                alcance por rol → INV-01
  domain/               reglas de negocio, funciones puras con tests
  policy/ money/ auth/ audit/ filters/
prisma/
  schema.prisma         fuente del modelo
  seed.ts               escenario §15, con sus totales verificados
supabase/
  migrations/           SQL generado desde Prisma, aplicado vía MCP
  migrations/_archivo_v1/   esquema anterior · NO aplicar · ver su README
docs/
  CRM-AVTR-SPEC.md      especificación normativa
  decisiones-pendientes.md  supuestos adoptados y qué cuesta cambiarlos
  superpowers/specs/    decisiones de construcción
  superpowers/plans/    plan de implementación vigente
```

## Comandos

```bash
pnpm dev                # desarrollo
pnpm build              # compilación de producción
pnpm test               # unitarios (vitest)
pnpm test:e2e           # criterios de aceptación (playwright)
pnpm lint               # eslint, incluida la frontera de datos de INV-01
pnpm typecheck          # tsc --noEmit
pnpm doctor             # react-doctor
pnpm db:diff            # genera SQL desde schema.prisma, sin conexión
pnpm db:generate        # cliente de Prisma
pnpm db:seed            # siembra el escenario del prototipo
```

## Decisiones que sorprenden si no se conocen

- **Todo se guarda en USD.** No hay multimoneda ni tipo de cambio. Es decisión de
  negocio: la operación real de Avattar en los tres países ya cotiza en dólares.
  Ver `docs/decisiones-pendientes.md` §3 antes de reintroducir moneda local.
- **Supabase no es la capa de datos.** Es identidad y almacenamiento. Los datos
  pasan por Prisma vía `lib/scope`. RLS está en deny-all como respaldo.
- **`app/` y `components/` no pueden importar Prisma.** Lo impide ESLint y lo
  verifica una prueba de arquitectura. Reciben funciones ya acotadas por rol.
- **Nada se borra.** Borrado lógico con `deletedAt`, excluido por omisión.

## Estado

- ✅ E0 en curso: cimientos, esquema, seed, autenticación, librerías de `lib/`.
- ⬜ E1 núcleo comercial · E2 cotización y margen · E3 MEDDIC y cierre ·
  E4 medición · E5 regional.
- ⚠️ SSO de Entra ID pendiente de credenciales (`supabase/config.toml`).
