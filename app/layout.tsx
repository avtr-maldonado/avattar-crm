import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Avattar CRM",
  description: "CRM comercial de Avattar IT Solutions — México, Colombia, Chile",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
