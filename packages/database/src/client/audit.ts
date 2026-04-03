import { createServerSupabaseClient } from "./server";

export async function createAuditedSupabaseClient() {
  const supabase = await createServerSupabaseClient();

  try {
    await supabase.rpc("set_audit_user");
  } catch {
    // Silently continue — audit will have null user_id
  }

  return supabase;
}
