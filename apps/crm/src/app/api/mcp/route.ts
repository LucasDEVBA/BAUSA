import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { autenticarMcp } from "@/lib/mcp/auth";
import { criarServidorMcp } from "@/lib/mcp/ferramentas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Conector do Claude — servidor MCP remoto (Streamable HTTP, SEM sessão).
 * Cada POST autentica o Bearer (OAuth do Supabase), monta um servidor novo
 * com o client do usuário e responde em JSON. Stateless de propósito: a
 * Vercel não garante a mesma instância entre requisições.
 */
export async function POST(req: Request): Promise<Response> {
  const origem = new URL(req.url).origin;
  try {
    const auth = await autenticarMcp(req, origem);
    if (!auth.ok) return auth.resposta;

    const server = criarServidorMcp(auth.contexto);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    return await transport.handleRequest(req);
  } catch (e) {
    console.error({ level: "error", action: "mcp_requisicao", message: e instanceof Error ? e.message : String(e) });
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32603, message: "Erro interno do conector." }, id: null },
      { status: 500 },
    );
  }
}

/** Sem sessão = sem stream de notificações (GET) nem encerramento (DELETE). */
function metodoNaoPermitido(): Response {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Método não permitido." }, id: null },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export const GET = metodoNaoPermitido;
export const DELETE = metodoNaoPermitido;
