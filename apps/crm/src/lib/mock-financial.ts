import {
  type Contract,
  type Receivable,
  type FixedCost,
  type VariableCost,
  type FinancialSummary,
} from "@/types/financial";

const now = new Date();
function daysFromNow(d: number) {
  const dt = new Date(now);
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().split("T")[0];
}
function daysAgo(d: number) {
  const dt = new Date(now);
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().split("T")[0];
}

export const MOCK_CONTRACTS: Contract[] = [
  {
    id: "c1",
    client_name: "Rafael Oliveira Mendes",
    plan: "Legacy",
    payment_method: "parcelado",
    total_value: 32000,
    signal_paid: 4500,
    remaining_balance: 27500,
    installments: 12,
    installment_value: 2291.67,
    signed_at: daysAgo(45),
  },
  {
    id: "c2",
    client_name: "Victor Henrique Barbosa",
    plan: "Legacy",
    payment_method: "pix",
    total_value: 28500,
    signal_paid: 4500,
    remaining_balance: 24000,
    installments: 6,
    installment_value: 4000,
    signed_at: daysAgo(60),
  },
  {
    id: "c3",
    client_name: "Guilherme Santos Prado",
    plan: "Journey",
    payment_method: "parcelado",
    total_value: 26000,
    signal_paid: 4500,
    remaining_balance: 21500,
    installments: 10,
    installment_value: 2150,
    signed_at: daysAgo(80),
  },
  {
    id: "c4",
    client_name: "Mateus Oliveira Cruz",
    plan: "Journey",
    payment_method: "pix",
    total_value: 23000,
    signal_paid: 4500,
    remaining_balance: 18500,
    installments: 8,
    installment_value: 2312.5,
    signed_at: daysAgo(120),
  },
  {
    id: "c5",
    client_name: "Pedro Alves Costa",
    plan: "Journey",
    payment_method: "parcelado",
    total_value: 26000,
    signal_paid: 4500,
    remaining_balance: 21500,
    installments: 10,
    installment_value: 2150,
    signed_at: daysAgo(30),
  },
  {
    id: "c6",
    client_name: "Thiago Barbosa Almeida",
    plan: "Legacy",
    payment_method: "parcelado",
    total_value: 32000,
    signal_paid: 4500,
    remaining_balance: 27500,
    installments: 12,
    installment_value: 2291.67,
    signed_at: daysAgo(22),
  },
];

export const MOCK_RECEIVABLES: Receivable[] = [
  // Rafael Oliveira Mendes - Legacy parcelado
  { id: "r1", contract_id: "c1", client_name: "Rafael Oliveira Mendes", plan: "Legacy", description: "Sinal", installment: 0, total_installments: 13, amount: 4500, due_date: daysAgo(45), paid_at: daysAgo(44), status: "recebido" },
  { id: "r2", contract_id: "c1", client_name: "Rafael Oliveira Mendes", plan: "Legacy", description: "Parcela 1/12", installment: 1, total_installments: 12, amount: 2291.67, due_date: daysAgo(15), paid_at: daysAgo(14), status: "recebido" },
  { id: "r3", contract_id: "c1", client_name: "Rafael Oliveira Mendes", plan: "Legacy", description: "Parcela 2/12", installment: 2, total_installments: 12, amount: 2291.67, due_date: daysFromNow(15), status: "previsto" },
  { id: "r4", contract_id: "c1", client_name: "Rafael Oliveira Mendes", plan: "Legacy", description: "Parcela 3/12", installment: 3, total_installments: 12, amount: 2291.67, due_date: daysFromNow(45), status: "previsto" },

  // Victor Henrique Barbosa - Legacy pix
  { id: "r5", contract_id: "c2", client_name: "Victor Henrique Barbosa", plan: "Legacy", description: "Sinal", installment: 0, total_installments: 7, amount: 4500, due_date: daysAgo(60), paid_at: daysAgo(59), status: "recebido" },
  { id: "r6", contract_id: "c2", client_name: "Victor Henrique Barbosa", plan: "Legacy", description: "Parcela 1/6", installment: 1, total_installments: 6, amount: 4000, due_date: daysAgo(30), paid_at: daysAgo(29), status: "recebido" },
  { id: "r7", contract_id: "c2", client_name: "Victor Henrique Barbosa", plan: "Legacy", description: "Parcela 2/6", installment: 2, total_installments: 6, amount: 4000, due_date: daysFromNow(0), status: "previsto" },
  { id: "r8", contract_id: "c2", client_name: "Victor Henrique Barbosa", plan: "Legacy", description: "Parcela 3/6", installment: 3, total_installments: 6, amount: 4000, due_date: daysFromNow(30), status: "previsto" },

  // Guilherme Santos Prado - Journey parcelado
  { id: "r9", contract_id: "c3", client_name: "Guilherme Santos Prado", plan: "Journey", description: "Sinal", installment: 0, total_installments: 11, amount: 4500, due_date: daysAgo(80), paid_at: daysAgo(79), status: "recebido" },
  { id: "r10", contract_id: "c3", client_name: "Guilherme Santos Prado", plan: "Journey", description: "Parcela 1/10", installment: 1, total_installments: 10, amount: 2150, due_date: daysAgo(50), paid_at: daysAgo(49), status: "recebido" },
  { id: "r11", contract_id: "c3", client_name: "Guilherme Santos Prado", plan: "Journey", description: "Parcela 2/10", installment: 2, total_installments: 10, amount: 2150, due_date: daysAgo(20), paid_at: daysAgo(19), status: "recebido" },
  { id: "r12", contract_id: "c3", client_name: "Guilherme Santos Prado", plan: "Journey", description: "Parcela 3/10", installment: 3, total_installments: 10, amount: 2150, due_date: daysFromNow(10), status: "previsto" },

  // Mateus Oliveira Cruz - Journey pix (atrasado)
  { id: "r13", contract_id: "c4", client_name: "Mateus Oliveira Cruz", plan: "Journey", description: "Sinal", installment: 0, total_installments: 9, amount: 4500, due_date: daysAgo(120), paid_at: daysAgo(119), status: "recebido" },
  { id: "r14", contract_id: "c4", client_name: "Mateus Oliveira Cruz", plan: "Journey", description: "Parcela 1/8", installment: 1, total_installments: 8, amount: 2312.5, due_date: daysAgo(12), status: "atrasado" },
  { id: "r15", contract_id: "c4", client_name: "Mateus Oliveira Cruz", plan: "Journey", description: "Parcela 2/8", installment: 2, total_installments: 8, amount: 2312.5, due_date: daysFromNow(18), status: "previsto" },

  // Pedro Alves Costa - Journey parcelado
  { id: "r16", contract_id: "c5", client_name: "Pedro Alves Costa", plan: "Journey", description: "Sinal", installment: 0, total_installments: 11, amount: 4500, due_date: daysAgo(30), paid_at: daysAgo(29), status: "recebido" },
  { id: "r17", contract_id: "c5", client_name: "Pedro Alves Costa", plan: "Journey", description: "Parcela 1/10", installment: 1, total_installments: 10, amount: 2150, due_date: daysFromNow(0), status: "previsto" },

  // Thiago Barbosa Almeida - Legacy parcelado (sem sinal ainda)
  { id: "r18", contract_id: "c6", client_name: "Thiago Barbosa Almeida", plan: "Legacy", description: "Sinal", installment: 0, total_installments: 13, amount: 4500, due_date: daysAgo(20), status: "atrasado" },
];

export const MOCK_FIXED_COSTS: FixedCost[] = [
  { id: "fc1", name: "Head de Sucesso e Experiência da Família", amount_monthly: 4500, active: true },
  { id: "fc2", name: "IA (ferramentas e licenças)", amount_monthly: 800, active: true },
  { id: "fc3", name: "Designer", amount_monthly: 2200, active: true },
  { id: "fc4", name: "Infraestrutura (sistema, domínio, cloud)", amount_monthly: 350, active: true },
  { id: "fc5", name: "Marketing e Tráfego Pago", amount_monthly: 3000, active: true },
  { id: "fc6", name: "Outros custos fixos", amount_monthly: 1200, active: true },
];

export const MOCK_VARIABLE_COSTS: VariableCost[] = [
  { id: "vc1", plan: "Journey", name: "Psicóloga Intercultural", amount: 1200 },
  { id: "vc2", plan: "Legacy", name: "Psicóloga Intercultural", amount: 1200 },
  { id: "vc3", plan: "Legacy", name: "Suporte VIP Adicional", amount: 800 },
];

const totalFixedMonthly = MOCK_FIXED_COSTS.filter((c) => c.active).reduce((s, c) => s + c.amount_monthly, 0);
const activeContracts = MOCK_CONTRACTS.length;
const fixedCostPerClient = activeContracts > 0 ? totalFixedMonthly / activeContracts : 0;

export const MOCK_FINANCIAL_SUMMARY: FinancialSummary = {
  mrr_brl: 21083,
  total_received_brl: 47266,
  total_receivable_brl: 98750,
  overdue_brl: 6812.5,
  fixed_costs_monthly: totalFixedMonthly,
  variable_costs_monthly: 6000,
  net_margin_pct: Math.round(((21083 - totalFixedMonthly - 1000) / 21083) * 100),
};

export { fixedCostPerClient };
