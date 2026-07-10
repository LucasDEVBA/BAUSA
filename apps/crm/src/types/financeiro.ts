/**
 * Tipos do módulo Financeiro — gestão de saídas (despesas) e folha
 * (colaboradores). Espelha a migration 20260707023149 (TEXT + CHECK no banco).
 *
 * NÃO confundir com `types/financial.ts` (legado, PascalCase inglês) que tipa
 * a UI atual de contratos/recebíveis. Este arquivo é a fonte canônica das
 * SAÍDAS e é usado pelo DRE/Fluxo de Caixa (F3).
 */

// ─── Colaboradores (folha) ───────────────────────────────────────────────────

export type TipoContrato = "clt" | "pj" | "socio" | "estagio" | "outro";

export const TIPO_CONTRATO_LABEL: Record<TipoContrato, string> = {
  clt: "CLT",
  pj: "PJ",
  socio: "Sócio",
  estagio: "Estágio",
  outro: "Outro",
};

export interface Colaborador {
  id: string;
  nome: string;
  cargo: string | null;
  cpf: string | null;
  tipo_contrato: TipoContrato;
  custo_mensal_brl: number;
  ativo: boolean;
  data_admissao: string | null;
  data_desligamento: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

/** Dados da empresa (pagador) para recibos — config `empresa_dados`. */
export interface EmpresaDados {
  razao_social: string;
  cnpj: string;
  cidade: string;
}

// ─── Despesas (saídas) ───────────────────────────────────────────────────────

export type DespesaCategoria =
  | "folha"
  | "marketing"
  | "ferramentas"
  | "servicos"
  | "impostos"
  | "comissoes"
  | "ocupacao"
  | "outros";

export type DespesaTipo = "fixa" | "variavel";

export type DespesaStatus = "previsto" | "pago" | "atrasado" | "cancelado";

export type DespesaMetodo =
  | "pix"
  | "boleto"
  | "cartao"
  | "transferencia"
  | "debito_automatico"
  | "dinheiro"
  | "outro";

export const DESPESA_CATEGORIA_LABEL: Record<DespesaCategoria, string> = {
  folha: "Folha",
  marketing: "Marketing",
  ferramentas: "Ferramentas",
  servicos: "Serviços",
  impostos: "Impostos",
  comissoes: "Comissões",
  ocupacao: "Ocupação",
  outros: "Outros",
};

export const DESPESA_STATUS_LABEL: Record<DespesaStatus, string> = {
  previsto: "Previsto",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

export const DESPESA_METODO_LABEL: Record<DespesaMetodo, string> = {
  pix: "Pix",
  boleto: "Boleto",
  cartao: "Cartão",
  transferencia: "Transferência",
  debito_automatico: "Débito automático",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

export interface Despesa {
  id: string;
  descricao: string;
  categoria: DespesaCategoria;
  tipo: DespesaTipo;
  valor_brl: number;
  competencia: string; // YYYY-MM-01
  vencimento: string | null;
  status: DespesaStatus;
  pago_at: string | null;
  metodo: DespesaMetodo | null;
  fornecedor: string | null;
  recorrente: boolean;
  recorrencia_dia: number | null;
  recorrencia_ativa: boolean;
  despesa_origem_id: string | null;
  colaborador_id: string | null;
  comprovante_url: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}
