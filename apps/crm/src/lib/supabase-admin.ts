import { createClient } from "@supabase/supabase-js";

/**
 * Client service-role — SOMENTE servidor (server actions). NUNCA importar em
 * client components nem expor a chave ao browser. Ignora RLS; usado apenas para
 * operações administrativas que o anon key não permite (criar/remover usuário
 * no Supabase Auth). A chave vem de SUPABASE_SERVICE_KEY (não NEXT_PUBLIC_*).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_KEY ausente no ambiente.");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** true se a service-role key está configurada (habilita criação de usuários). */
export function hasServiceKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_KEY);
}
