import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

/**
 * Cliente de Supabase para usar en Client Components ("use client").
 * Sujeto a RLS — no funcionará para leer/escribir hasta que existan políticas
 * (ver CLAUDE.md).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
