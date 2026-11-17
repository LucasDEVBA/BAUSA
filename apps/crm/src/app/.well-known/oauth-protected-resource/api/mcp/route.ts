import { metadadosRecursoProtegido } from "@/lib/mcp/auth";

export const dynamic = "force-dynamic";

/** Mesmo documento da raiz, no caminho com sufixo que o Claude tenta primeiro (RFC 9728 §3.1). */
export function GET(req: Request): Response {
  return Response.json(metadadosRecursoProtegido(new URL(req.url).origin), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
