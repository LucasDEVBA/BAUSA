import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * Chamada às RPCs financeiras (fin_*) com erro tipado.
 *
 * As RPCs levantam `FIN_<CODIGO>: <mensagem pt-BR>`. Aqui o prefixo vira
 * `code` (para a UI decidir: recarregar, pedir confirmação…) e a mensagem
 * vira o texto do toast. Erro sem prefixo = erro inesperado (programação ou
 * infraestrutura): loga com contexto e devolve mensagem genérica — nunca o
 * texto cru do Postgres para o usuário.
 */

export type FinErroCodigo =
  | "FIN_PERMISSAO"
  | "FIN_CONTRATO_MUDOU"
  | "FIN_REQUER_CONFIRMACAO"
  | "FIN_JUSTIFICATIVA"
  | "FIN_DATA_FUTURA"
  | "FIN_CRONOGRAMA_SALDO"
  | "FIN_CRONOGRAMA_ENTRADA"
  | "FIN_CONTRATO_EXISTE"
  | "FIN_CONTRATO_COM_PLANO"
  | "FIN_PARCELA_JA_BAIXADA"
  | "FIN_CONTRATO_CANCELADO"
  | "FIN_VALIDACAO"
  | "FIN_INESPERADO";

export type FinResult<T> =
  | { success: true; data: T }
  | { success: false; code: FinErroCodigo; error: string };

const CODIGOS_CONHECIDOS = new Set<string>([
  "FIN_PERMISSAO",
  "FIN_CONTRATO_MUDOU",
  "FIN_REQUER_CONFIRMACAO",
  "FIN_JUSTIFICATIVA",
  "FIN_DATA_FUTURA",
  "FIN_CRONOGRAMA_SALDO",
  "FIN_CRONOGRAMA_ENTRADA",
  "FIN_CONTRATO_EXISTE",
  "FIN_CONTRATO_COM_PLANO",
  "FIN_PARCELA_JA_BAIXADA",
  "FIN_CONTRATO_CANCELADO",
]);

const PREFIXO = /^(FIN_[A-Z_]+):\s*([\s\S]+)$/;

export function mapearErroFinanceiro(mensagem: string | undefined | null): {
  code: FinErroCodigo;
  error: string;
} {
  const m = PREFIXO.exec(mensagem ?? "");
  if (!m) {
    return { code: "FIN_INESPERADO", error: "Não foi possível salvar. Tente de novo; se persistir, avise o suporte." };
  }
  const code = (CODIGOS_CONHECIDOS.has(m[1]) ? m[1] : "FIN_VALIDACAO") as FinErroCodigo;
  return { code, error: m[2].trim() };
}

export async function chamarRpcFinanceira<T>(
  nome: string,
  args: Record<string, unknown>,
  contexto: Record<string, unknown> = {},
): Promise<FinResult<T>> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc(nome, args);
    if (error) {
      const mapeado = mapearErroFinanceiro(error.message);
      console.error({
        level: mapeado.code === "FIN_INESPERADO" ? "error" : "warn",
        action: "rpc_financeira_falhou",
        rpc: nome,
        code: mapeado.code,
        pgCode: error.code,
        message: error.message,
        ...contexto,
      });
      return { success: false, ...mapeado };
    }
    return { success: true, data: data as T };
  } catch (err) {
    console.error({
      level: "error",
      action: "rpc_financeira_excecao",
      rpc: nome,
      error: err instanceof Error ? err.message : String(err),
      ...contexto,
    });
    return { success: false, code: "FIN_INESPERADO", error: "Falha de comunicação ao salvar. Tente de novo." };
  }
}
