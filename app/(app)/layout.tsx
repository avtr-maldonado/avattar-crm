import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";

/**
 * Layout de la aplicación · §13.5.
 *
 * Barra lateral fija navy con las secciones «Comercial» y «Sistema». A partir
 * de aquí todas las pantallas asumen que hay sesión: `requireSession` redirige
 * a `/login` o a `/sin-acceso` según la causa, que son situaciones distintas.
 *
 * Los rubros se recortan por permiso. Análisis no aparece para un Vendedor —
 * §2.3 lo deja fuera— y además la ruta responde 403, porque ocultar el enlace
 * no es autorización (AC-02).
 */
const COMERCIAL = [
  { href: "/oportunidades", etiqueta: "Oportunidades" },
  { href: "/contactos", etiqueta: "Contactos" },
  { href: "/actividades", etiqueta: "Actividades" },
  { href: "/productos", etiqueta: "Productos" },
  { href: "/objetivos", etiqueta: "Objetivos" },
] as const;

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();

  const sistema = [
    ...(can(session, "VER_ANALISIS") ? [{ href: "/analisis", etiqueta: "Análisis" }] : []),
    { href: "/autorizaciones", etiqueta: "Autorizaciones" },
    ...(can(session, "EDITAR_CATALOGOS")
      ? [{ href: "/admin", etiqueta: "Administración" }]
      : []),
  ];

  return (
    <div className="flex min-h-screen">
      <nav className="flex w-56 shrink-0 flex-col bg-navy-900 text-navy-100">
        <div className="px-5 py-6">
          <p className="text-lg font-semibold text-white">Avattar</p>
          <p className="text-xs text-navy-300">CRM comercial</p>
        </div>

        <Seccion titulo="Comercial" rubros={COMERCIAL} />
        <Seccion titulo="Sistema" rubros={sistema} />

        <div className="mt-auto border-t border-navy-800 px-5 py-4">
          <p className="text-sm font-medium text-white">{session.name}</p>
          <p className="text-xs text-navy-300">
            {ETIQUETA_ROL[session.role]} · {session.countryCodes.join(", ")}
          </p>
        </div>
      </nav>

      <main className="min-w-0 flex-1 bg-superficie-pagina">{children}</main>
    </div>
  );
}

function Seccion({
  titulo,
  rubros,
}: {
  titulo: string;
  rubros: readonly { href: string; etiqueta: string }[];
}) {
  if (rubros.length === 0) return null;
  return (
    <div className="px-3 py-2">
      <p className="eyebrow px-2 pb-1 text-navy-400">{titulo}</p>
      <ul>
        {rubros.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              className="block rounded-sm px-2 py-1.5 text-sm text-navy-100 transition-colors duration-rapido ease-estandar hover:bg-navy-800 hover:text-white"
            >
              {r.etiqueta}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ETIQUETA_ROL: Record<string, string> = {
  VENDEDOR: "Vendedor",
  GERENTE_PAIS: "Gerente de país",
  DIRECCION: "Dirección",
  ADMINISTRADOR: "Administración",
  PREVENTA: "Preventa",
};
