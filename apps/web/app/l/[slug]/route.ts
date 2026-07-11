import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ════════════════════════════════════════════════════════════════════════
// /l/[slug] — resolve o link curto do gerador de UTM e redireciona (302).
// Chama a RPC registrar_clique_link (SECURITY DEFINER): incrementa o clique e
// devolve o destino completo (com as UTMs) atomicamente. O link compartilhado
// fica limpo; as UTMs só aparecem no redirect. 302 (não 301) p/ contar cliques.
// ════════════════════════════════════════════════════════════════════════

// Least-privilege: a RPC registrar_clique_link é SECURITY DEFINER com GRANT p/
// anon, então a anon key basta — não expor service_role neste redirect público.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public";
const FALLBACK = "https://bolsaatletausa.com";

// Allowlist de domínio (defesa em profundidade contra open redirect): mesmo que
// um destino inválido chegue ao banco, o link de marca nunca redireciona p/ fora.
// meet.google.com: links premium de reunião (bolsaatletausa.com/analise-<nome>
// → Google Meet), criados pelo calendar-webhook e pela /agenda do Engine.
const HOSTS_PERMITIDOS = new Set([
  "bolsaatletausa.com",
  "www.bolsaatletausa.com",
  "meet.google.com",
]);

function destinoSeguro(url: string): boolean {
  try {
    return HOSTS_PERMITIDOS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Slug malformado → manda pra home em vez de 404 (link compartilhado nunca "quebra")
  if (!slug || !/^[A-Za-z0-9_-]{3,40}$/.test(slug)) {
    return NextResponse.redirect(FALLBACK, 302);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      db: { schema: SCHEMA },
      auth: { persistSession: false },
    });
    const { data, error } = await supabase.rpc("registrar_clique_link", {
      p_slug: slug,
    });
    const destino = typeof data === "string" ? data : null;
    if (error || !destino || !destinoSeguro(destino)) {
      return NextResponse.redirect(FALLBACK, 302);
    }
    return NextResponse.redirect(destino, 302);
  } catch {
    return NextResponse.redirect(FALLBACK, 302);
  }
}
