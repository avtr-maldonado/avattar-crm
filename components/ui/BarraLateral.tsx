import Image from "next/image";
import Link from "next/link";
import type { Role } from "@/lib/dto";
import { ETIQUETA_ROL } from "@/lib/etiquetas";

/**
 * Barra lateral fija · §13.5.
 *
 * **Ocupa exactamente el alto de la pantalla y no se desplaza.** `h-screen` con
 * `sticky top-0`: quien hace scroll es el contenido, no la navegación. Una
 * barra que se va hacia arriba obliga a subir para cambiar de pantalla, y en
 * una aplicación de trabajo eso se paga en cada cambio de contexto.
 *
 * Si algún día los rubros no caben, el que gana scroll es el bloque de rubros
 * —`overflow-y-auto` en el centro—, nunca la barra completa: el logotipo y el
 * usuario se quedan anclados.
 */
export type RubroNavegacion = {
  href: string;
  etiqueta: string;
  /** Pendientes. Solo se pinta si es mayor que cero: un «0» es ruido. */
  contador?: number;
  /** Rojo en vez de azul. Para lo que vence, como las autorizaciones. */
  urgente?: boolean;
};

export type SeccionNavegacion = {
  titulo: string;
  rubros: RubroNavegacion[];
};

export function BarraLateral({
  secciones,
  usuario,
}: {
  secciones: SeccionNavegacion[];
  usuario: { nombre: string; rol: Role; paises: string[] };
}) {
  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-hidden bg-navy-900 text-navy-100">
      <div className="flex items-center gap-3 px-5 py-5">
        <Image
          src="/marca/avattar-blanco.png"
          alt="Avattar IT Solutions"
          width={534}
          height={200}
          priority
          className="h-7 w-auto"
        />
        <span className="border-l border-navy-700 pl-3 text-sm font-semibold tracking-wide text-white">
          CRM
        </span>
      </div>

      {/* El único bloque que puede desplazarse, y solo si hace falta. */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {secciones.map((s) => (
          <Seccion key={s.titulo} seccion={s} />
        ))}
      </nav>

      <div className="shrink-0 border-t border-navy-800 px-5 py-4">
        <p className="eyebrow text-navy-400">Sesión</p>
        <p className="mt-1 text-sm font-medium text-white">{usuario.nombre}</p>
        <p className="text-xs text-navy-300">{ETIQUETA_ROL[usuario.rol]}</p>
        <p className="mt-2 text-xs text-navy-400">{usuario.paises.join(" · ")}</p>
      </div>
    </aside>
  );
}

function Seccion({ seccion }: { seccion: SeccionNavegacion }) {
  if (seccion.rubros.length === 0) return null;

  return (
    <div className="pb-4 pt-2">
      <p className="eyebrow px-2 pb-1 text-navy-400">{seccion.titulo}</p>
      <ul>
        {seccion.rubros.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              className="flex items-center justify-between rounded-sm px-2 py-1.5 text-sm text-navy-100 transition-colors duration-rapido ease-estandar hover:bg-navy-800 hover:text-white"
            >
              <span>{r.etiqueta}</span>
              {r.contador !== undefined && r.contador > 0 && (
                <span
                  className={`tabular rounded-pill px-1.5 py-0.5 text-xs font-semibold ${
                    r.urgente ? "bg-coral/20 text-coral" : "bg-navy-800 text-navy-200"
                  }`}
                >
                  {r.contador}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
