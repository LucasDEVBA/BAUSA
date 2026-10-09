// Tipos de calculo.mjs (o tsc resolve "./calculo.mjs" para este arquivo).
// Manter em sincronia com calculo.mjs — o guard tests/financeiro-calculo.test.js
// confere que todo export do .mjs aparece aqui.

export type FormaEntrada =
  | "pix" | "getnet_parcelado" | "transferencia" | "boleto" | "cartao" | "dinheiro" | "outro";
export type FormaSaldo =
  | "pix_avista" | "pix_parcelado" | "getnet_parcelado" | "transferencia" | "boleto" | "cartao" | "dinheiro" | "outro";
export type MetodoParcela =
  | "pix" | "getnet" | "transferencia" | "boleto" | "cartao" | "dinheiro" | "outro";
export type EstadoContrato =
  | "sem_contrato" | "aguardando_plano" | "cancelado" | "condicoes_pendentes" | "quitado" | "ativo";

export interface ParcelaGerada {
  numero_parcela: string;
  valor: number;
  vencimento: string; // YYYY-MM-DD
  metodo: MetodoParcela;
}

export interface ParcelaParaCalculo {
  tipo?: "entrada" | "saldo";
  valor: number;
  status: "previsto" | "recebido" | "atrasado" | "cancelado";
  vencimento: string;
  deleted_at?: string | null;
}

export declare const VALOR_MAXIMO: number;
export declare const VALOR_IRRISORIO_ABSOLUTO: number;
export declare const VALOR_IRRISORIO_PERCENTUAL: number;
export declare const MAX_PARCELAS: number;
export declare const METODO_DA_FORMA: Readonly<Record<FormaEntrada | FormaSaldo, MetodoParcela>>;

export declare function paraCentavos(valor: number): number;
export declare function deCentavos(centavos: number): number;
export declare function somarValores(valores: number[]): number;
export declare function parseValorBRL(texto: string): number | null;
export declare function formatarValorBRL(valor: number | null | undefined): string;
export declare function formatarMoeda(valor: number | null | undefined): string;
export declare function ehValorIrrisorio(valor: number, total?: number | null): boolean;
export declare function dataIsoValida(iso: string): boolean;
export declare function somarMesesMesmoDia(iso: string, meses: number): string;
export declare function metodoDaForma(forma: FormaEntrada | FormaSaldo): MetodoParcela | null;

export declare function gerarCronograma(args: {
  total: number;
  quantidade: number;
  primeiroVencimento: string;
  metodo: MetodoParcela;
  numeracaoInicio?: number;
  numeracaoTotal?: number;
  rotuloUnico?: string;
}): ParcelaGerada[];

export declare function planejarAbertas(args: {
  totalGrupo: number;
  recebidas: Array<{ valor: number }>;
  quantidadeTotal: number;
  primeiroVencimento: string;
  metodo: MetodoParcela;
  rotuloUnico?: string;
}): { restante: number; parcelas: ParcelaGerada[]; erro: "MENOR_QUE_RECEBIDO" | null };

export declare function composicaoValorTotal(args: {
  valorBase: number;
  itens?: Array<{ valor: number }>;
  entrada?: number;
  sinalAbatido?: boolean;
}): number;

export declare function estadoContrato(
  contrato: { plano: string | null; valor_total: number } | null,
  parcelas?: ParcelaParaCalculo[],
): EstadoContrato;

export declare function resumoFinanceiro(
  contrato: { valor_total: number } | null,
  parcelas: ParcelaParaCalculo[],
  hoje: string,
): {
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
};

export declare function margemAluno(args: {
  valorTotal: number;
  custos?: Array<{ valor: number; categoria: string; status: string }>;
  incluiPsicologa?: boolean;
  custoPsicologa?: number | null;
}): {
  receita: number;
  custosLancados: number;
  psicologaEstimada: number;
  margem: number;
  margemPct: number | null;
};
