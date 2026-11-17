// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const autenticacao = vi.hoisted(() => ({ autenticarMcp: vi.fn() }));

vi.mock("@/lib/mcp/auth", async (original) => {
  const real = (await original()) as Record<string, unknown>;
  return { ...real, autenticarMcp: autenticacao.autenticarMcp };
});

import { DELETE, GET, POST } from "./route";

/** Supabase falso: qualquer encadeamento devolve o builder; `await` dá lista vazia. */
function supabaseVazio() {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "is", "gte", "lt", "or", "order", "limit", "range", "maybeSingle"]) {
    builder[m] = () => builder;
  }
  builder.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(ok);
  return { from: () => builder };
}

const CABECALHOS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  authorization: "Bearer token",
};

const post = (corpo: unknown, extra: Record<string, string> = {}) =>
  POST(new Request("https://engine.example/api/mcp", { method: "POST", headers: { ...CABECALHOS, ...extra }, body: JSON.stringify(corpo) }));

describe("POST /api/mcp (stateless)", () => {
  beforeEach(() => {
    autenticacao.autenticarMcp.mockResolvedValue({
      ok: true,
      contexto: { supabase: supabaseVazio(), usuarioId: "u1", clientId: "c1" },
    });
  });

  it("should serve initialize, tools/list and tools/call as independent requests", async () => {
    const init = await post({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "teste", version: "1" } },
    });
    expect(init.status).toBe(200);
    expect(init.headers.get("mcp-session-id")).toBeNull();
    const inicio = (await init.json()) as { result: { protocolVersion: string; serverInfo: { name: string } } };
    expect(inicio.result.serverInfo.name).toBe("bausa-engine");
    const versao = { "mcp-protocol-version": inicio.result.protocolVersion };

    const avisado = await post({ jsonrpc: "2.0", method: "notifications/initialized" }, versao);
    expect(avisado.status).toBe(202);

    const lista = await post({ jsonrpc: "2.0", id: 2, method: "tools/list" }, versao);
    expect(lista.status).toBe(200);
    const ferramentas = (await lista.json()) as { result: { tools: { name: string }[] } };
    expect(ferramentas.result.tools).toHaveLength(5);

    const chamada = await post(
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "fila_aprovacao", arguments: {} } },
      versao,
    );
    expect(chamada.status).toBe(200);
    const resultado = (await chamada.json()) as { result: { content: { text: string }[]; isError?: boolean } };
    expect(resultado.result.isError).toBeFalsy();
    expect(JSON.parse(resultado.result.content[0].text)).toEqual({ total_na_fila: 0, leads: [] });
  });

  it("should pass the auth failure response through untouched", async () => {
    const negado = new Response("{}", { status: 401, headers: { "WWW-Authenticate": 'Bearer resource_metadata="x"' } });
    autenticacao.autenticarMcp.mockResolvedValue({ ok: false, resposta: negado });
    const r = await post({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(r.status).toBe(401);
    expect(r.headers.get("WWW-Authenticate")).toBe('Bearer resource_metadata="x"');
  });

  it("should answer 500 with a JSON-RPC error (no stack) when auth throws", async () => {
    autenticacao.autenticarMcp.mockRejectedValue(new Error("perfil indisponível"));
    const r = await post({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ jsonrpc: "2.0", error: { code: -32603, message: "Erro interno do conector." }, id: null });
  });
});

describe("GET/DELETE /api/mcp", () => {
  it("should reject methods that need a session with 405", () => {
    expect(GET().status).toBe(405);
    expect(DELETE().status).toBe(405);
    expect(GET().headers.get("Allow")).toBe("POST");
  });
});
