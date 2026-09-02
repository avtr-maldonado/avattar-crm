# CRM Avattar · Contrato de trabajo

CRM de ventas para Avattar IT Solutions (consultoría de TI, opera en México, Colombia y Chile).
Reemplaza a Pipedrive. Lo que lo distingue: gobierna **margen** y **cobro**, no solo etapas.

**La especificación completa está en `docs/CRM-AVTR-SPEC.md`.** Este archivo es el resumen que
siempre debe estar en contexto. Cuando una tarea toque modelo de datos, reglas de negocio,
pantallas o criterios de aceptación, **lee la sección correspondiente del spec antes de escribir
código**. No deduzcas reglas de negocio: o están en el spec, o están en §18 como pregunta abierta.

Dos documentos más mandan sobre el spec cuando hay conflicto, porque son posteriores:

- `docs/superpowers/specs/2026-09-01-crm-avattar-e0-e1-design.md` — decisiones de construcción
  tomadas con el negocio, incluida la de monomoneda.
- `docs/decisiones-pendientes.md` — qué se asumió, dónde vive ese supuesto y qué cuesta cambiarlo.

## Stack

Next.js (App Router) · TypeScript · Prisma · PostgreSQL (Supabase) · Tailwind · Server Actions.
Autenticación con Microsoft Entra ID vía Supabase Auth.

Supabase es **identidad y almacenamiento**, no la capa de datos: los datos de negocio pasan por
Prisma a través de `lib/scope`. RLS está en deny-all como respaldo, no como autorización — RLS
filtra filas, y el invariante más delicado del sistema (INV-02) es de columnas.

## Los quince invariantes

Nunca se violan. Si una tarea parece exigirlo, la tarea está mal planteada: dilo en lugar de
improvisar. Detalle en `docs/CRM-AVTR-SPEC.md` §3.

1. **INV-01** Toda lectura de oportunidades, organizaciones, actividades y objetivos pasa por
   `lib/scope`. Nunca `prisma.opportunity.findMany` directo en una ruta, componente o acción.
2. **INV-02** El costo y la utilidad **no se serializan** para quien no tiene `VER_COSTO`.
   Ocultarlos en el componente no cuenta. Selectores explícitos, nunca `select: *`.
3. **INV-03** El dinero es `Decimal(18,4)` y se opera con `Decimal`, nunca con `number`. Los
   porcentajes se guardan como fracción (`0.1500` = 15 %).
4. **INV-04** Todo importe viaja con su moneda. Bajo monomoneda (D-A) esa moneda es siempre `USD`.
5. **INV-05** Ningún umbral en el código. Piso de margen, umbrales de descuento, mínimos MEDDIC,
   días para estancada, tasa de impuesto y probabilidad de etapa se leen de la base. Un literal
   `0.20`, `0.15`, `0.16` o `0.30` en `lib/domain` es un defecto.
6. **INV-06** Una cotización congelada es inmutable. Editar = versión nueva.
7. **INV-07** No se gana sin cumplir todas las condiciones. La validación vive en el servicio de
   dominio, no en el formulario.
8. **INV-08** ~~El tipo de cambio se congela al ganar.~~ **Sin efecto bajo monomoneda (D-A).**
   No se renumera: reintroducir multimoneda es reactivarlo.
9. **INV-09** Las acciones sensibles escriben `AuditLog` en la misma transacción. Si el log falla,
   la operación falla.
10. **INV-10** El estado de los filtros vive en la URL (`searchParams`).
11. **INV-11** Las banderas de riesgo se calculan, no se capturan.
12. **INV-12** El folio es inmutable, incluso al reabrir. Consecutivo **por año**.
13. **INV-13** Las etapas son datos, no `enum`. Un `switch` por nombre de etapa es un defecto.
14. **INV-14** La UI siempre en español. Identificadores en inglés.
15. **INV-15** Nada se borra en duro: `deletedAt`, y las consultas lo excluyen por omisión.

## Nomenclatura

Híbrido: **identificadores en inglés, valores de negocio en español.**

```
opportunities.stage_id · quotes.gross_margin        // tablas y campos en inglés
stage.name = "Negociación" · lossReason = "Precio"  // valores visibles en español
Role = VENDEDOR | GERENTE_PAIS | DIRECCION | ADMINISTRADOR | PREVENTA
rutas: /oportunidades /contactos /objetivos          // visibles → español
componentes y funciones: OpportunityCard, computeMeddicScore   // inglés
```

`snake_case` en Postgres con `@map`, `camelCase` en el cliente Prisma, modelos `PascalCase`
singular.

## Dónde vive cada cosa

```
lib/db.ts       PrismaClient · SOLO lib/scope y lib/domain pueden importarlo
lib/scope/      alcance por rol → INV-01. Toda consulta empieza aquí
lib/domain/     reglas de negocio: quote, milestone, meddic, approval, opportunity, objectives
lib/policy/     lectura de CommercialPolicy y Country → INV-05
lib/money/      Decimal y formateo → INV-03
lib/filters/    definición y parseo de filtros → INV-10
lib/audit/      escritura de AuditLog → INV-09
components/ui/  primitivas del sistema de diseño
app/(app)/      pantallas P-01 a P-11
```

`app/**` y `components/**` **no pueden importar** `lib/db` ni `@prisma/client`. Lo aplica
`eslint.config.mjs` y lo verifica `tests/arquitectura/`. Reciben funciones ya acotadas.

Las mutaciones son Server Actions que **validan con Zod, autorizan, y delegan** en un servicio de
`lib/domain`. Nada de lógica de negocio en un componente. Los cálculos de cotización, puntaje
MEDDIC y cuadre de hitos son funciones puras con tests unitarios.

## Las cinco reglas que más se rompen

- **Visibilidad del vendedor: por `ownerId`, no por `createdById`.** (`RN-31`. Pendiente de
  confirmar con el Director, `Q-01`.) Un vendedor solo ve sus oportunidades, sus actividades y su
  propio renglón de objetivos. Los indicadores de encabezado, para él, se calculan solo sobre su
  conjunto: nunca ve el total de la oficina, ni por agregación.
- **MEDDIC gatea, no pondera.** El ponderado sigue siendo `amount × stage.probability` (`RN-01`).
  El puntaje MEDDIC bloquea el avance a cierre (≥70), el marcado como ganada (≥80, y `E`, `I`, `C`
  confirmados) y la categoría «Compromiso» (≥70). Mínimos configurables.
- **Un rango de fechas siempre dice sobre qué campo aplica** (`CIERRE_ESTIMADO`, `CIERRE_REAL`,
  `CREACION`, `ULTIMA_ACTIVIDAD`). Sin eso, los reportes no se pueden reproducir.
- **Avance de cuota con `actualCloseDate`; cobertura con `expectedCloseDate`.** Mezclarlas produce
  coberturas absurdas a fin de trimestre.
- **Un filtro nunca amplía el alcance.** Primero el alcance por rol, después los filtros del
  usuario.

## Sistema de diseño

Tokens del manual de normas gráficas de Avattar, en `docs/CRM-AVTR-SPEC.md` §13. Se copian
textualmente; no se sustituyen por la paleta por omisión de ninguna librería.

- Azul `#62A8E5` domina, navy `#375172` acompaña. Magenta, lima y coral solo como estado o acento
  puntual, nunca como superficie.
- Montserrat para cuerpo y títulos, Clash Display para títulos cortos.
- Todas las cifras en columna con `font-variant-numeric: tabular-nums`.
- Verde en o sobre el piso de margen, coral debajo: es la señal más importante de la interfaz.
- Los estados vacíos siempre proponen la acción siguiente. Los errores dicen qué falta con el dato
  concreto: «faltan $200,000 por asignar en hitos», no «datos inválidos».

## Orden de construcción

`E0` cimientos → `E1` núcleo comercial → `E2` cotización y margen → `E3` MEDDIC y cierre →
`E4` medición → `E5` regional. **E1 antes que E2, sin excepción.** Detalle y criterios de
aceptación por incremento en §17. El plan vigente está en `docs/superpowers/plans/`.

## Comandos

```bash
pnpm dev                    # desarrollo
pnpm db:diff                # genera el SQL desde schema.prisma, sin conexión
pnpm db:seed                # escenario del prototipo aprobado → §15
pnpm test                   # unitarios de lib/domain
pnpm test:e2e               # criterios de aceptación §14
pnpm lint && pnpm typecheck
pnpm doctor                 # react-doctor sobre las pantallas
```

**Migraciones:** el schema de Prisma es la fuente; Supabase lleva el historial aplicado. Se genera
el SQL con `pnpm db:diff`, se guarda en `supabase/migrations/` y se aplica con el MCP de Supabase,
que además permite verificar en el acto con `list_tables` y `get_advisors`. Nunca editar una
migración ya aplicada.

## Al terminar una tarea

1. Corre `pnpm typecheck`, `pnpm lint` y `pnpm test`. Si tocaste pantallas, `pnpm doctor`.
2. Si tocaste la base, corre `get_advisors` del MCP y revisa que no haya hallazgos nuevos.
3. Verifica que la tarea no violó ningún invariante, en especial `INV-01`, `INV-02` e `INV-05`.
4. Cita en el commit qué regla de negocio implementa (`RN-13`, `HF-04`, `AC-22`…) — ayuda a
   rastrear contra el spec cuando el cliente pregunte «¿por qué se comporta así?».
5. Si escribiste una regla de negocio que no estaba en el spec, dilo explícitamente en el resumen:
   es candidata a entrar al documento o a ser una pregunta para el negocio.
