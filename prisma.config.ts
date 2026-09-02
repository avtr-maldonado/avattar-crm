import path from "node:path";
import "dotenv/config";
import { defineConfig } from "prisma/config";

// Reemplaza a package.json#prisma, deprecado a partir de Prisma 7.
// Al detectar este archivo, Prisma deja de cargar .env por su cuenta:
// el import de dotenv de arriba es lo que repone DATABASE_URL y DIRECT_URL.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
