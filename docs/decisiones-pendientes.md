# Decisiones pendientes y supuestos adoptados

Actualizado el 1 de septiembre de 2026.

El spec §18 deja diez preguntas abiertas y pide no resolverlas por cuenta
propia. El guion de descubrimiento (`sesion-director-mexico-preguntas.md`) tiene
sus 23 respuestas en blanco, así que hoy no hay a quién consultar sin frenar la
construcción.

**Se adoptó el valor que el propio spec propone, y se registra aquí.** Todos
viven como dato en la base, no en el código (INV-05): cambiarlos es editar una
fila, no desplegar. Este documento existe para que ningún supuesto quede
invisible.

---

## 1. Preguntas abiertas del spec (Q-01 a Q-10)

| Q | Pregunta | Valor asumido | Dónde vive | Qué cuesta cambiarlo |
|---|---|---|---|---|
| **Q-01** | El Director dijo «los vendedores solo ven las que crean». ¿Propietario o creador? | **Propietario** (`ownerId`). Tomado literal, un gerente no podría dar de alta una oportunidad y asignarla, y una reasignación dejaría al vendedor nuevo sin acceso | `lib/scope/opportunities.ts` | Una línea. Cambiar `ownerId` por `createdById` en el caso `VENDEDOR` |
| **Q-02** | ¿El año fiscal de Avattar es el año calendario? | **Sí.** T1 = ene–mar. Inferido del prototipo, que muestra septiembre dentro de T3 | `Country.fiscalYearStartMonth = 1` | Una fila por país |
| **Q-03** | ¿Preventa es rol propio? ¿Ve costo? ¿Edita la cotización? | **Rol propio.** Ve las oportunidades donde está asignado como apoyo. **Sin** `VER_COSTO`. No edita cotización | `RolePermission` | Filas en la matriz, editable desde P-11 |
| **Q-04** | Tasa de impuesto real de Colombia y Chile | **MX 16 %, CO 19 %, CL 19 %.** Los de CO y CL vienen del catálogo de funcionalidades v2, sin confirmar con contabilidad local | `Country.taxRate` | Una fila. No afecta cotizaciones ya creadas: RN-24 copia la tasa al crear |
| **Q-05** | ¿Quién mantiene el costo estándar mientras Defontana esté fuera? | **Administración, por carga masiva.** Sin responsable asignado todavía | `Product.costSource = CARGA_MASIVA`, `Product.costUpdatedAt` | Es una decisión de proceso, no de código. P-06 marca en ámbar los SKU con costo de más de 60 días |
| **Q-06** | ¿Se carga un resumen histórico agregado de 24 meses? | **No.** P-09 muestra «sin datos suficientes» durante los primeros trimestres, nunca un cero | — | Si se decide que sí, es un módulo de importación nuevo |
| **Q-07** | ¿Se permiten conceptos libres en la cotización? ¿Con costo obligatorio? | **Sí, con costo obligatorio.** Sin costo, el margen de esa línea sería falso y las autorizaciones dejarían de ser confiables | `QuoteLine.productId` nulo | Validación en `lib/domain/quote.ts` |
| **Q-08** | Pesos MEDDIC por omisión: ¿los seis iguales, o pesa más el decisor económico? | **17/17/17/17/15/17.** `DOLOR_IDENTIFICADO` a 15 para que sumen 100 | `MeddicWeight`, por pipeline | Editable desde P-11 sin desplegar (AC-17) |
| **Q-09** | ¿El SLA de autorización se cuenta en horas hábiles o naturales? | **Hábiles**, 24 h | `CommercialPolicy.approvalSlaHours` | El número es dato; hábiles-contra-naturales sí es código, en `lib/domain/approval.ts` |
| **Q-10** | ¿Quién carga el tipo de cambio, con qué frecuencia y de qué fuente? | **Sin efecto.** La decisión D-A eliminó la multimoneda | — | Volvería a aplicar si se reintroduce multimoneda |

---

## 2. Decisiones tomadas que modifican el spec

Cerradas con el responsable del proyecto el 1 de septiembre de 2026. Detalle en
`docs/superpowers/specs/2026-09-01-crm-avattar-e0-e1-design.md` §2.

| # | Decisión | Consecuencia |
|---|---|---|
| **D-A** | **Monomoneda USD** en los tres países | Ver §3 |
| **D-B** | Prisma para datos, Supabase para Auth (Entra ID) y Storage | RLS queda como respaldo deny-all, no como autorización |
| **D-C** | Alcance de la primera entrega: E0 y E1 | E2 a E5 en ciclos posteriores |
| **D-D** | Reemplazar el esquema v1, archivándolo | `supabase/migrations/_archivo_v1/` |
| **D-E** | Adoptar los supuestos del spec y marcarlos | Este documento |
| **D-F** | `react-doctor` como medida de calidad de React | `pnpm doctor` |

---

## 3. Qué quedó sin efecto por la decisión de monomoneda (D-A)

**Los códigos no se renumeran ni se borran.** El spec §0.4 los declara estables y
citables, y reintroducir multimoneda debe ser reactivarlos, no redescubrirlos.

| Código | Texto original | Estado |
|---|---|---|
| **INV-04** | «Todo importe viaja con su moneda» | Se cumple trivialmente: la moneda es siempre `USD` |
| **INV-08** | «El tipo de cambio se congela al ganar» | **Sin efecto.** No hay tipo de cambio |
| **AC-19** | «Al marcar ganada se sellan `actualCloseDate` y `frozenExchangeRate`» | **Parcial.** Se sella `actualCloseDate`; `frozenExchangeRate` no existe |
| **RN-10** | «El tipo de cambio se congela al ganar» | **Sin efecto** |
| **Q-10** | Fuente del tipo de cambio | **Sin efecto** |

Se conserva a propósito: el enum `Currency` con el único valor `USD`, y las
columnas `currency` en `Opportunity`, `Quote`, `Pipeline` y `Objective`.
Reintroducir moneda local sería agregar valores al enum y una tabla de tipos de
cambio, no repintar cinco tablas.

**Por qué importa esto para Defontana (Fase 2):** facturar en México, Colombia y
Chile normalmente exige el monto en moneda local para SAT, DIAN y SII. Cotizar en
dólares y facturar en moneda local son cosas distintas. Esa conversión no está
resuelta aquí, y hay que confirmar con el Director de México si Avattar factura
hoy en USD o si la factura local sale en moneda local aunque el CRM viva en
dólares. Cambia el alcance de esa integración.

---

## 4. Divergencias entre documentos, sin resolver

No son preguntas del spec: son contradicciones entre el spec v2.0 y el catálogo
de funcionalidades v2, que sigue siendo material de negocio válido.

| Tema | Catálogo v2 | Spec v2.0 | Se implementó |
|---|---|---|---|
| Roles | 7: incluye Finanzas y Marketing (`AV-1101`) | 5 (§5.1) | **5.** Si Finanzas necesita ver facturación esperada y Marketing el origen de las oportunidades, hay que decidir si son roles o permisos sobre los existentes |
| Prospectos (Leads) | Módulo completo, Fase 2 (§10b, `PR-01` a `PR-05`) | No aparece, ni siquiera en §16 | **Fuera.** El esquema v1 ya tenía la tabla `prospectos`; se descartó |
| Crédito compartido | `AV-303`, suma exacta 100 % (`RN-20`, `RN-21`) | `RN-11`, explícitamente Fase 2 | **Fuera.** La regla de visibilidad por `ownerId` ya es compatible con extenderla a copropietarios |
| Estatus `cancelada` | Se distingue de `perdida`: no cuenta en tasa de cierre | `RN-12` fija tres estados | **Tres estados.** Si el negocio mide tasa de cierre excluyendo cancelaciones, esto se pierde |
| Migración desde Pipedrive | `AV-1201`, migración completa | Arranque en limpio (§1) | **En limpio** |
| Consentimiento de datos | `AV-208`, `RN-07`, requisito legal en los tres países | No aparece | **No implementado.** Es requisito de LFPDPPP, Ley 1581 y Ley 19.628; conviene decidirlo antes de cargar personas reales |

La última fila merece atención: el catálogo la marca como «sin decisión — pero es
requisito legal en los 3 países, no debería ser opcional».

---

## 5. Ajustes al seed del prototipo

El seed reproduce §15 para que la aplicación se vea igual que lo aprobado por
Dirección. Tres cifras se ajustaron, y conviene confirmarlas.

**Banderas de riesgo: 7 y 3 943 000, no 5 y 3 513 000.**
El spec declara cinco banderas, pero INV-11 obliga a **calcularlas**. Con
`marginFloor = 0.20`, tres oportunidades caen bajo el piso —OPP-2026-00388 (9 %),
OPP-2026-00341 (11 %) y OPP-2026-00304 (19 %)— y el spec solo marca la primera.
Los otros dos totales del seed sí cuadran exactos: valor abierto 12 621 000 y
ponderado 7 362 350.

**Cuotas reescaladas.**
Las de §15 (9.00 M USD para Jorge Medina, 33.5 M en total) dejan la cobertura del
T3 en **0.10×** contra la banda sana de 3.0×, porque solo 3 319 000 del pipeline
cierra en ese trimestre. Se reescalaron conservando las proporciones:

| Vendedor | Cuota ingreso | Cuota utilidad | Cobertura T3 |
|---|---:|---:|---:|
| Jorge Medina | 300 000 | 90 000 | 3.68× |
| Ana Lucía Ríos | 450 000 | 135 000 | 4.06× |
| Paulina Estrada | 150 000 | 45 000 | 2.57× |
| Gabriel Duarte | 120 000 | 36 000 | 0.00× |
| Valeria Domínguez | 80 000 | 24 000 | 0.00× |
| **Equipo** | **1 100 000** | **330 000** | **3.02×** |

**Pendiente de confirmar con Dirección:** con monomoneda USD, una oportunidad de
2 850 000 dólares y una cuota anual de 9 millones son cifras grandes para una
consultoría de este tamaño. Leídas como pesos serían ordinarias. Vale la pena
confirmar la escala de los importes del prototipo antes de la primera
demostración.

**Descuadre deliberado en Valeria Domínguez.** Sus cuatro trimestres no suman su
anual, a propósito, para que la advertencia de RN-32 sea visible en la
demostración y AC-30 tenga un caso real.

---

## 6. Prerequisitos de entorno, no de código

- **Credenciales de Entra ID.** `supabase/config.toml` trae `[auth.external.azure]`
  comentado. Sin ellas la autenticación se construye pero no se prueba de extremo
  a extremo; las pruebas usan sesiones simuladas.
- **`trustPolicy` en `warn`, no en `no-downgrade`.** `undici-types@6.21.0`, que
  llega como transitiva de `@types/node@22`, perdió su evidencia de procedencia.
  No hay salida limpia: los tipos deben seguir el mayor de Node. Volver a
  `no-downgrade` cuando la recupere. Razonado en `pnpm-workspace.yaml`.
