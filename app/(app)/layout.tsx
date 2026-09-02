import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import {
  BarraLateral,
  type SeccionNavegacion,
} from "@/components/ui/BarraLateral";

/**
 * Estructura de la aplicación · §13.5.
 *
 * Dos regiones: la barra lateral, que ocupa el alto exacto de la pantalla y no
 * se desplaza, y el contenido, que es lo único con scroll. Cada pantalla pone
 * su propio encabezado con `BarraSuperior`, porque el subtítulo de contexto
 * —conteos, totales— cambia con la pantalla y un layout no puede conocerlo.
 *
 * `requireSession` redirige a `/login` o a `/sin-acceso` según la causa. De
 * aquí en adelante toda pantalla asume que hay usuario.
 *
 * Los rubros se recortan por permiso, pero **ocultar un enlace no es
 * autorización**: la ruta de análisis responde 403 por su cuenta (AC-02).
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();

  const secciones: SeccionNavegacion[] = [
    {
      titulo: "Comercial",
      rubros: [
        { href: "/oportunidades", etiqueta: "Oportunidades" },
        { href: "/contactos", etiqueta: "Contactos" },
        { href: "/productos", etiqueta: "Productos" },
        { href: "/actividades", etiqueta: "Actividades" },
        { href: "/objetivos", etiqueta: "Objetivos" },
        ...(can(session, "VER_ANALISIS")
          ? [{ href: "/analisis", etiqueta: "Análisis" }]
          : []),
        { href: "/autorizaciones", etiqueta: "Autorizaciones", urgente: true },
      ],
    },
    {
      titulo: "Sistema",
      rubros: can(session, "EDITAR_CATALOGOS")
        ? [{ href: "/admin", etiqueta: "Administración" }]
        : [],
    },
  ];

  return (
    <div className="flex min-h-screen bg-superficie-pagina">
      <BarraLateral
        secciones={secciones}
        usuario={{
          nombre: session.name,
          rol: session.role,
          paises: session.countryCodes,
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
