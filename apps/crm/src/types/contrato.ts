// Tipos do contrato financeiro de ponta a ponta (T5/T6/T9/T10/T11/T18).
// Espelha as migrations *_financeiro_contrato_flexivel / *_financeiro_rpcs. Arquivo NOVO para não
// conflitar com as mudanças de outros grupos em types/crm.ts.

import type { EstadoContrato, MetodoParcela, FormaEntrada, FormaSaldo } from "@/lib/financeiro/calculo.mjs";
import type { PlanoContrato, FormaPlano, TipoItemContrato, ServicoCatalogo } from "@/lib/financeiro/schemas";

export type { EstadoContrato };

export interface ContratoRow {
  id: string;
  deal_id: string;
  /** null = AGUARDANDO PLANO (só sinal registrado — T11). */
  plano: PlanoContrato | null;
  forma_pagamento_plano: FormaPlano | null;
  valor_total: number;
  /** Preço do plano escolhido; null = legado (base = total − itens) ou aguardando. */
  valor_base_plano: number | null;
  valor_customizado: number | null;
  justificativa_customizacao: string | null;
  sinal_abatido: boolean;
  entrada_valor: number;
  entrada_forma: FormaEntrada | null;
  entrada_parcelas: number;
  entrada_paga: boolean;
  entrada_paga_at: string | null;
  saldo_remanescente: number;
  saldo_forma: FormaSaldo | null;
  saldo_parcelas: number | null;
  inclui_psicologa: boolean;
  custo_psicologa: number | null;
  nf_status: "pendente" | "emitida" | "nao_aplicavel";
  nf_numero: string | null;
  nf_emitida_at: string | null;
  nf_valor: number | null;
  plano_definido_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParcelaRow {
  id: string;
  contrato_id: string;
  tipo: "entrada" | "saldo";
  numero_parcela: string;
  valor: number;
  vencimento: string;
  metodo: MetodoParcela;
  status: "previsto" | "recebido" | "atrasado" | "cancelado";
  recebido_at: string | null;
  comprovante_url: string | null;
  parcelas_cartao: number | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContratoItemRow {
  id: string;
  tipo: TipoItemContrato;
  descricao: string;
  /** Com sinal: serviço +, desconto −, ajuste ±. */
  valor: number;
  catalogo_chave: string | null;
  created_at: string;
}

export type TipoEventoContrato =
  | "contrato_criado" | "sinal_registrado" | "plano_escolhido" | "condicoes_editadas"
  | "parcela_editada" | "parcela_baixada" | "parcela_estornada" | "sinal_removido"
  | "contrato_quitado" | "contrato_descartado";

export interface ContratoEventoRow {
  id: string;
  tipo: TipoEventoContrato;
  justificativa: string | null;
  detalhes: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
  /** Nome do autor (user_profiles); null = sistema/script. */
  autorNome: string | null;
}

export interface CustoAlunoRow {
  id: string;
  descricao: string;
  categoria: string;
  valor_brl: number;
  competencia: string;
  vencimento: string | null;
  status: "previsto" | "pago" | "atrasado" | "cancelado";
  pago_at: string | null;
  metodo: string | null;
  fornecedor: string | null;
  observacao: string | null;
}

export interface PlanoTabela {
  valor: number;
  valor_pix: number;
  psicologa: boolean;
}

export interface ContratoCompleto {
  dealId: string;
  /** Etapa atual do deal (chave do enum — o client traduz pelo stageConfig). */
  etapaDeal: string | null;
  atletaId: string | null;
  atletaNome: string | null;
  contrato: ContratoRow | null;
  parcelas: ParcelaRow[];
  itens: ContratoItemRow[];
  eventos: ContratoEventoRow[];
  custos: CustoAlunoRow[];
  /** Token CAS (fin_versao_contrato) — devolver nas edições. */
  versao: string | null;
  estado: EstadoContrato;
  resumo: {
    valorTotal: number;
    recebido: number;
    aReceber: number;
    emAtraso: number;
    qtdAtrasadas: number;
    pagas: number;
    totalParcelas: number;
    sinalRecebido: number;
    semCronograma: number;
    pctRecebido: number | null;
  } | null;
  planosTabela: { legacy: PlanoTabela; journey: PlanoTabela; start: PlanoTabela };
  entradaPadrao: number;
  psicologaPadrao: number;
  catalogo: ServicoCatalogo[];
  hoje: string;
}
