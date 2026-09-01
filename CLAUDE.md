# CRM Avattar — contexto del proyecto

CRM comercial a la medida para Avattar IT Solutions (consultoría de TI con oficinas en
México, Colombia y Chile). Reemplaza a Pipedrive. El modelo de referencia de UX es
Pipedrive: pipeline visual como pantalla principal, captura rápida, pocos clics.

## Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind.
- **Backend:** Supabase (Postgres + Auth + Storage). Sin backend propio separado —
  la lógica de negocio vive en Postgres (triggers/functions) y en Route Handlers de
  Next.js, no en un servidor intermedio.
- **Auth:** Supabase Auth. SSO con Entra ID vía OIDC (pendiente de configurar).

## Estado del esquema de base de datos

El esquema ya existe y está **validado** (corrido contra Postgres real antes de
entregarse, no solo revisado a ojo): `supabase/migrations/`, 16 archivos, 30 tablas,
2 vistas. Antes de proponer cambios de esquema, leer las migraciones existentes —
no asumir la estructura, confirmarla en el archivo.

**Decisión de arquitectura importante: todos los montos se guardan en USD.**
No hay multimoneda, no hay tabla de tipos de cambio, no hay conversión. Esto es
intencional (la operación real de Avattar en los tres países ya cotiza en dólares) —
ver la nota completa al inicio de `supabase/migrations/20260901000000_extensiones_y_convenciones.sql`
antes de reintroducir cualquier lógica de moneda local. La única excepción conocida:
facturar en México/Colombia/Chile normalmente exige moneda local para SAT/DIAN/SII,
así que la integración con Defontana (Fase 2, fuera del MVP) probablemente necesite
resolver esa conversión en su propia capa — no está resuelta aquí todavía.

**RLS está habilitado en las tablas transaccionales pero SIN políticas todavía.**
Eso significa que ahora mismo, con las claves `anon`/`authenticated`, ninguna consulta
funciona — solo `service_role` puede leer/escribir. Si el frontend no trae datos, es
por esto, no un bug. Las políticas RLS son la siguiente entrega pendiente (ver
`docs/listado-funcionalidades-mvp-v2.md` §11, roles: vendedor, gerente_pais,
direccion_comercial, preventa_consultor, finanzas, marketing, administrador).

## Documentos de referencia (en `docs/`)

Leer en este orden antes de tocar alcance o modelo de datos:

1. `alcance-mvp.md` — qué queda dentro y fuera del MVP, decisiones de cobertura
   (MX/CO/CL desde v1, Defontana fuera, sin migrar histórico de Pipedrive),
   contradicciones detectadas (`C-01` a `C-07`) y decisiones aún pendientes
   (`D-01` a `D-07`).
2. `sesion-director-mexico-preguntas.md` — guion de descubrimiento con el cliente;
   varias respuestas ahí (columna "R:") pueden seguir vacías — no asumir que ya
   están resueltas sin revisar.
3. `listado-funcionalidades-mvp-v2.md` — catálogo de funcionalidades por módulo,
   con el estatus de cada una (`[MVP]` / `[Fase 2]` / `[Fuera]` / `[sin decisión]`)
   y las reglas de negocio referenciadas por código (`RN-xx`, `HF-xx`, `SEG-xx`,
   `MIG-xx`, `PR-xx`, `MD-xx`). **Antes de implementar cualquier módulo, buscar su
   código de regla aquí — el código en el esquema SQL lo cita en comentarios.**

## Convenciones de datos (ver comentarios en las migraciones para el detalle)

- Nada se borra físicamente: `borrado_logico` (tablas transaccionales) o `activo`
  (catálogos). Nunca usar `DELETE` en tablas de negocio.
- Catálogos pequeños (industria, origen, motivo de pérdida, rol de contacto, tipo de
  documento, etc.) viven en una sola tabla genérica `catalogos` con columna `tipo` —
  no crear una tabla nueva por cada catálogo pequeño.
- `custom_fields JSONB` en las entidades principales permite campos por cliente sin
  migrar el esquema.
- El permiso "ver margen sin ver costo" (`SEG-01`/`RN-27`) NO se resuelve con RLS
  (RLS es por fila, no por columna). Usar las vistas `v_cotizacion_lineas_calc`
  (con costo) y `v_cotizacion_lineas_sin_costo` (sin costo), eligiendo cuál exponer
  según el rol del usuario en la capa de aplicación.
- La validación "la suma de hitos debe cuadrar exactamente contra el total antes de
  poder ganar" (`HF-01`/`HF-04`) y "los copropietarios deben sumar exactamente 100%
  antes de ganar" (`RN-20`) NO están como constraint de base de datos — necesitan
  leer el total vigente de la cotización en el momento de cambiar el estatus a
  "ganada". Van en la capa de aplicación (Route Handler o función de Postgres que
  se llame explícitamente al ganar, no un trigger pasivo).

## Módulos y su estatus (resumen — el detalle completo está en el catálogo v2)

| Módulo | Estatus |
|---|---|
| Contactos, Oportunidades, Cotización, Hitos de facturación | MVP |
| Productos y lista de precio única en USD | MVP |
| Actividades, Objetivos, Documentos | MVP |
| Análisis (tableros) | MVP parcial — varios dependen de histórico que no se migra (`C-02`) |
| Prospectos (Leads → conversión a Oportunidad) | Fase 2, alta manual únicamente, sin formulario web |
| Integración Defontana (costo real, facturación) | Fuera del MVP |
| Integración M365/Entra ID (SSO, calendario, correo) | MVP |
| Roles y permisos, bitácora de auditoría | MVP |

## Pendientes conocidos que NO hay que resolver adivinando

- `D-01` a `D-07` y las decisiones nuevas en `alcance-mvp.md` §15 (fuente del tipo
  de cambio — ya no aplica del todo tras la decisión de monomoneda, confirmar con
  el cliente si sigue siendo relevante para Defontana — umbrales de autorización,
  responsables de configuración por país, etc.).
- Si una funcionalidad no tiene estatus claro en el catálogo (`[sin decisión]`),
  no asumir que es MVP. Preguntar o dejarla explícitamente fuera de esta iteración.

## Cómo trabajar en este repo

- Cambios de esquema → nueva migración en `supabase/migrations/`, nunca editar una
  migración ya aplicada.
- Antes de generar código de un módulo, citar en el commit o en el PR qué código de
  regla de negocio implementa (`RN-13`, `HF-04`, etc.) — ayuda a rastrear contra el
  catálogo cuando el cliente pregunte "¿por qué se comporta así?".
