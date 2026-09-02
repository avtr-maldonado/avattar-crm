import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Sin esto, Next infiere la raíz del workspace desde un package-lock.json
  // suelto en el directorio del usuario y avisa en cada arranque.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
