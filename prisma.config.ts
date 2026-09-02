import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Al detectar este archivo, Prisma deja de cargar .env por su cuenta.
//
// Next.js lee .env.local; dotenv, por omisión, lee .env. Cargamos ambos, con
// .env.local primero, para que las variables funcionen sin importar en cuál de
// los dos archivo las hayan puesto. dotenv no sobreescribe lo ya definido, así
// que el primero gana y el segundo solo rellena lo que falte.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
