import { metadadosRecursoProtegido } from "@/lib/mcp/auth";

export const dynamic = "force-dynamic";

/**
 * Metadados do recurso protegido (RFC 9728) do conector do Claude: diz que o
 * MCP em /api/mcp aceita tokens do servidor OAuth do Supabase Auth.
 * Servido na raiz E em /.well-known/oauth-protected-resource/api/mcp
 * (o Claude tenta o caminho com sufixo primeiro).
 */
export function GET(req: Request): Response {
  return Response.json(metadadosRecursoProtegido(new URL(req.url).origin), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
