import { describe, expect, it } from "vitest";
import type { Session } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getCommercialPolicy } from "@/lib/policy";
import { listProductos, listVigenciasDePrecio } from "@/lib/scope/productos";
import { money } from "@/lib/money";

/**
 * P-06 contra los datos reales.
 *
 * Dos cosas se prueban aquí y ninguna es cosmética: que el costo no salga sin
 * permiso **ni por aritmética**, y que el catálogo no contenga un precio mínimo
 * imposible.
 */
async function sesionDe(correo: string): Promise<Session> {
  const u = await prisma.user.findUniqueOrThrow({
    where: { email: correo },
    select: { id: true, email: true, name: true, role: true, countryCodes: true },
  });
  const permisos = await prisma.rolePermission.findMany({
    where: { role: u.role, granted: true },
    select: { limitValue: true, permission: { select: { code: true } } },
  });
  return {
    userId: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    countryCodes: u.countryCodes,
    permissions: new Set(permisos.map((p) => p.permission.code)),
    limits: Object.fromEntries(
      permisos.map((p) => [p.permission.code, p.limitValue?.toString() ?? null]),
    ),
  };
}

describe("P-06 · INV-02, el costo no sale sin permiso", () => {
  it("la respuesta de un vendedor no contiene standardCost ni costUpdatedAt", async () => {
    const paulina = await sesionDe("pe@avattar.com");
    const serializado = JSON.stringify(await listProductos(paulina));

    expect(serializado).not.toContain("standardCost");
    expect(serializado).not.toContain("costUpdatedAt");
    expect(serializado).not.toContain("costSource");
    // Lo que sí ve: el piso duro hasta el que puede descontar (RN-08).
    expect(serializado).toContain("minPrice");
  });

  it("la de un gerente sí las trae", async () => {
    const jorge = await sesionDe("jm@avattar.com");
    const serializado = JSON.stringify(await listProductos(jorge));

    expect(serializado).toContain("standardCost");
    expect(serializado).toContain("costUpdatedAt");
  });

  it("la lista de precio se acota igual que el catálogo", async () => {
    const [paulina, jorge] = await Promise.all([
      sesionDe("pe@avattar.com"),
      sesionDe("jm@avattar.com"),
    ]);

    expect(JSON.stringify(await listVigenciasDePrecio(paulina))).not.toContain(
      "standardCost",
    );
    expect(JSON.stringify(await listVigenciasDePrecio(jorge))).toContain("standardCost");
  });
});

describe("P-06 · el costo se recupera del margen · hallazgo §9.2", () => {
  it("precio y margen juntos revelan el costo EXACTO", async () => {
    // Por esto la pantalla no muestra margen sin VER_COSTO, aunque RN-09 los
    // separe. Es la misma aritmética que hacía inútil la vista «sin costo» del
    // esquema archivado.
    const jorge = await sesionDe("jm@avattar.com");
    const productos = await listProductos(jorge);

    for (const p of productos) {
      const precio = p.prices[0];
      if (!precio || !("standardCost" in precio)) continue;

      const lista = money(precio.listPrice.toString());
      const costo = money(precio.standardCost.toString());
      const margen = lista.minus(costo).div(lista);
      const costoRecuperado = lista.times(money("1").minus(margen));

      expect(costoRecuperado.toFixed(4), p.sku).toBe(costo.toFixed(4));
    }
  });
});

describe("P-06 · coherencia del precio mínimo · RN-08", () => {
  it("ningún precio mínimo supera al de lista", async () => {
    // Un piso por encima del techo no significa nada: el producto no se podría
    // vender ni a precio de lista. Pasaba con LIC-M365-E3 antes de topar la
    // derivación.
    const jorge = await sesionDe("jm@avattar.com");
    const vigencias = await listVigenciasDePrecio(jorge);

    for (const v of vigencias) {
      expect(
        Number(v.minPrice) <= Number(v.listPrice),
        `${v.product.sku}: mínimo ${v.minPrice} sobre lista ${v.listPrice}`,
      ).toBe(true);
    }
  });

  it("ningún precio mínimo queda por debajo del costo", async () => {
    // Vender bajo costo no es un descuento: es una pérdida.
    const jorge = await sesionDe("jm@avattar.com");
    const vigencias = await listVigenciasDePrecio(jorge);

    for (const v of vigencias) {
      if (!("standardCost" in v)) continue;
      expect(
        Number(v.minPrice) >= Number(v.standardCost),
        `${v.product.sku}: mínimo bajo el costo`,
      ).toBe(true);
    }
  });
});

describe("P-06 · el hallazgo del piso por línea · §9.1", () => {
  it("LIC-M365-E3 no alcanza el piso por línea ni a precio de lista", async () => {
    // No es un error de captura: la reventa de licencias es un negocio de paso
    // con margen delgado. Pero significa que ese SKU nace violando la política,
    // y toda cotización que lo incluya va a alertar sin que nadie pueda
    // resolverlo bajando el precio.
    const [jorge, politica] = await Promise.all([
      sesionDe("jm@avattar.com"),
      getCommercialPolicy("MX"),
    ]);
    const productos = await listProductos(jorge);
    const licencia = productos.find((p) => p.sku === "LIC-M365-E3")!;
    const precio = licencia.prices[0];

    expect("standardCost" in precio).toBe(true);
    const lista = money(precio.listPrice.toString());
    const costo = money((precio as { standardCost: unknown }).standardCost!.toString());
    const margen = lista.minus(costo).div(lista);

    expect(margen.lt(politica.lineMarginFloor)).toBe(true);
    // Y por eso su mínimo quedó igual al de lista: no hay margen para descontar.
    expect(precio.minPrice.toString()).toBe(precio.listPrice.toString());
  });

  it("es el único SKU en esa situación", async () => {
    // Si aparecen más, la decisión de §9.1 deja de ser un caso y pasa a ser
    // una política que hay que cerrar.
    const [jorge, politica] = await Promise.all([
      sesionDe("jm@avattar.com"),
      getCommercialPolicy("MX"),
    ]);

    const bajoElPiso = (await listProductos(jorge))
      .filter((p) => {
        const precio = p.prices[0];
        if (!precio || !("standardCost" in precio)) return false;
        const lista = money(precio.listPrice.toString());
        const costo = money(precio.standardCost.toString());
        return lista.minus(costo).div(lista).lt(politica.lineMarginFloor);
      })
      .map((p) => p.sku);

    expect(bajoElPiso).toEqual(["LIC-M365-E3"]);
  });
});

describe("P-06 · antigüedad del costo · C-01", () => {
  it("tres SKU pasan de 60 días sin actualizar", async () => {
    // Sin Defontana el costo se mantiene a mano. La columna existe para que eso
    // se vea antes de que alguien cotice contra un número viejo.
    const jorge = await sesionDe("jm@avattar.com");
    const productos = await listProductos(jorge);
    const ahora = new Date();

    const obsoletos = productos
      .filter((p) => {
        if (!("costUpdatedAt" in p) || !p.costUpdatedAt) return false;
        return (ahora.getTime() - p.costUpdatedAt.getTime()) / 86_400_000 > 60;
      })
      .map((p) => p.sku)
      .sort();

    expect(obsoletos).toEqual(["CLD-AWS-CONS", "INF-SRV-R750", "LIC-M365-E3"]);
  });

  it("mientras Defontana esté fuera, el origen del costo es carga masiva", async () => {
    const jorge = await sesionDe("jm@avattar.com");
    for (const p of await listProductos(jorge)) {
      expect("costSource" in p && p.costSource).toBe("CARGA_MASIVA");
    }
  });
});
