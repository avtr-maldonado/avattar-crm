import type { CountryCode, OpportunityStatus, Role } from "@/lib/dto";

/**
 * Los textos visibles · INV-14.
 *
 * «La UI siempre está en español. Identificadores en inglés, valores de negocio
 * y textos visibles en español.» Este módulo es donde se traduce lo uno a lo
 * otro, en un solo lugar: si el mapa vive junto a un componente, la segunda
 * pantalla que lo necesita lo copia y las dos se desincronizan.
 *
 * Va aquí y no en `components/ui` también por una razón práctica: un archivo de
 * componente que exporta cosas que no son componentes rompe el Fast Refresh de
 * React, que deja de preservar el estado al editar.
 */
export const ETIQUETA_ROL: Record<Role, string> = {
  VENDEDOR: "Vendedor",
  GERENTE_PAIS: "Gerente de país",
  DIRECCION: "Dirección",
  ADMINISTRADOR: "Administración",
  PREVENTA: "Preventa",
};

export const NOMBRE_PAIS: Record<CountryCode, string> = {
  MX: "México",
  CO: "Colombia",
  CL: "Chile",
};

export const ETIQUETA_ESTATUS: Record<OpportunityStatus, string> = {
  ABIERTA: "Abierta",
  GANADA: "Ganada",
  PERDIDA: "Perdida",
};
