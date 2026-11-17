import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";

const dossie = vi.hoisted(() => ({ obterLeadDossieInterno: vi.fn() }));
vi.mock("@/lib/leads-lista", () => dossie);

import { type ContextoMcp } from "./auth";
import { criarServidorMcp } from "./ferramentas";

type Resposta = { data: unknown; error: { message: string } | null; count?: number | null };

/** Query builder falso: qualquer encadeamento devolve o mesmo builder; `await` resolve a resposta da tabela. */
function supabaseFalso(respostas: Record<string, Resposta>) {
  const from = vi.fn((tabela: string) => {
    const resposta = respostas[tabela] ?? { data: [], error: null, count: 0 };
    const builder: Record<string, unknown> = {};
    for (const metodo of ["select", "eq", "in", "is", "gte", "lt", "or", "order", "limit", "range", "maybeSingle"]) {
      builder[metodo] = () => builder;
    }
    builder.then = (ok: (r: Resposta) => unknown, erro: (e: unknown) => unknown) => Promise.resolve(resposta).then(ok, erro);
    return builder;
  });
  return { from };
}

async function conectar(respostas: Record<string, Resposta>) {
  const supabase = supabaseFalso(respostas);
  const ctx = { supabase, usuarioId: "u1", clientId: "c1" } as unknown as ContextoMcp;
  const [lado, ladoServidor] = InMemoryTransport.createLinkedPair();
  await criarServidorMcp(ctx).connect(ladoServidor);
  const client = new Client({ name: "teste", version: "1.0.0" });
  await client.connect(lado);
  return { client, supabase };
}

const textoDe = (r: unknown): string => {
  const conteudo = (r as { content: { type: string; text: string }[] }).content;
  return conteudo[0]?.text ?? "";
};

describe("conector MCP do Engine", () => {
  it("should expose exactly the five read-only tools", async () => {
    const { client } = await conectar({});
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "buscar_leads",
      "dossie_lead",
      "fila_aprovacao",
      "funil_periodo",
      "resumo_pipeline",
    ]);
    for (const t of tools) expect(t.annotations?.readOnlyHint, t.name).toBe(true);
  });

  it("should compute the pipeline conversion with signed contracts as wins and timing losses excluded", async () => {
    const { client } = await conectar({
      configuracoes_sistema: { data: [], error: null },
      deals: {
        data: [
          { etapa: "contrato_assinado", motivo_perda: null },
          { etapa: "sinal_pago", motivo_perda: null },
          { etapa: "perdido", motivo_perda: "financeiro" },
          { etapa: "perdido", motivo_perda: "timing" },
          { etapa: "lead", motivo_perda: null },
        ],
        error: null,
      },
    });
    const r = await client.callTool({ name: "resumo_pipeline", arguments: {} });
    const dados = JSON.parse(textoDe(r)) as Record<string, unknown>;
    expect(dados).toMatchObject({
      total_deals: 5,
      contratos_ganhos: 2,
      perdidos: 1,
      perdidos_por_timing_fora_da_taxa: 1,
      taxa_conversao_pct: 67,
      base_da_taxa: "2 ganhos de 3 decididos",
    });
  });

  it("should return an error result (never a partial number) when a query fails", async () => {
    const { client } = await conectar({
      form_submissions: { data: null, error: { message: "permission denied" }, count: null },
    });
    const r = await client.callTool({ name: "fila_aprovacao", arguments: {} });
    expect((r as { isError?: boolean }).isError).toBe(true);
    expect(textoDe(r)).toContain("permission denied");
  });

  it("should return the dossier with the approval decision and without full address or birth date", async () => {
    dossie.obterLeadDossieInterno.mockResolvedValue({
      id: "7f3a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b",
      athlete_name: "Atleta",
      age: 15,
      birth_date: "2011-03-02",
      address_street: "Rua X",
      address_number: "10",
      address_cep: "01310-100",
      address_city: "São Paulo",
      address_state: "SP",
    });
    const { client } = await conectar({
      form_submissions: {
        data: { aprovacao_status: "aprovado", aprovacao_decidida_em: "2026-11-10T12:00:00Z", aprovacao_motivo: null },
        error: null,
      },
    });
    const r = await client.callTool({ name: "dossie_lead", arguments: { id: "7f3a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b" } });
    const dados = JSON.parse(textoDe(r)) as Record<string, unknown>;
    expect(dados).toMatchObject({ age: 15, address_city: "São Paulo", aprovacao_status: "aprovado" });
    for (const campo of ["birth_date", "address_street", "address_number", "address_cep"]) {
      expect(dados, campo).not.toHaveProperty(campo);
    }
  });

  it("should reject a dossier request with an invalid id before touching the database", async () => {
    const { client, supabase } = await conectar({});
    const r = await client.callTool({ name: "dossie_lead", arguments: { id: "nao-e-uuid" } });
    expect((r as { isError?: boolean }).isError).toBe(true);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
