export type PlanType = "Journey" | "Legacy" | "Start";
export type PaymentMethod = "parcelado" | "pix";
export type ReceivableStatus = "previsto" | "recebido" | "atrasado";

export const PLAN_CONFIG: Record<
  PlanType,
  { price: number; pix_price: number; signal: number; description: string; color: string; bg: string }
> = {
  Journey: {
    price: 26000,
    pix_price: 23000,
    signal: 4500,
    description: "Plano completo com acompanhamento psicológico intercultural",
    color: "text-blue-300",
    bg: "bg-blue-500/15 border-blue-500/30",
  },
  Legacy: {
    price: 32000,
    pix_price: 28500,
    signal: 4500,
    description: "Plano premium com serviços exclusivos e suporte VIP",
    color: "text-purple-300",
    bg: "bg-purple-500/15 border-purple-500/30",
  },
  Start: {
    price: 18000,
    pix_price: 16000,
    signal: 4500,
    description: "Plano essencial para famílias em início de jornada",
    color: "text-zinc-300",
    bg: "bg-zinc-500/15 border-zinc-500/30",
  },
};

export const RECEIVABLE_STATUS_CONFIG: Record<ReceivableStatus, { label: string; color: string; bg: string }> = {
  previsto: { label: "Previsto", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  recebido: { label: "Recebido", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  atrasado: { label: "Atrasado", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
};

export interface Contract {
  id: string;
  client_name: string;
  plan: PlanType;
  payment_method: PaymentMethod;
  total_value: number;
  signal_paid: number;
  remaining_balance: number;
  installments: number;
  installment_value: number;
  signed_at: string;
  notes?: string;
}

export interface Receivable {
  id: string;
  contract_id: string;
  client_name: string;
  plan: PlanType;
  description: string;
  installment: number;
  total_installments: number;
  amount: number;
  due_date: string;
  paid_at?: string;
  status: ReceivableStatus;
}

export interface FixedCost {
  id: string;
  name: string;
  amount_monthly: number;
  active: boolean;
}

export interface VariableCost {
  id: string;
  plan: PlanType;
  name: string;
  amount: number;
}

export interface AdditionalCost {
  id: string;
  client_name?: string;
  type: string;
  description: string;
  amount: number;
  date: string;
}

export interface ClientProfitability {
  client_name: string;
  plan: PlanType;
  contract_value: number;
  fixed_costs_share: number;
  variable_costs: number;
  additional_costs: number;
  estimated_profit: number;
  profit_margin_pct: number;
}

export interface FinancialSummary {
  mrr_brl: number;
  total_received_brl: number;
  total_receivable_brl: number;
  overdue_brl: number;
  fixed_costs_monthly: number;
  variable_costs_monthly: number;
  net_margin_pct: number;
}
