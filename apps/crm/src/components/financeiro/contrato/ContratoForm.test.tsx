import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { condicoesContratoSchema, type CondicoesContratoInput } from "@/lib/financeiro/schemas";
import type { ContratoCompleto } from "@/types/contrato";

import { ContratoForm } from "./ContratoForm";
import { PlanoEscolhidoModal } from "./PlanoEscolhidoModal";

const acoes = vi.hoisted(() => ({
  carregarContratoDoDeal: vi.fn(),
  criarContratoCompleto: vi.fn(),
  salvarCondicoesContrato: vi.fn(),
}));
vi.mock("@/lib/actions/financeiro-contrato", () => acoes);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/lib/gamificacao-store", () => ({ celebrar: vi.fn() }));

const HOJE = "2026-10-08";

// Deal sem contrato: o "Criar contrato" do T6 (aba Contrato → "Escolher plano / criar contrato").
const dealSemContrato = (): ContratoCompleto => ({
  dealId: "0b6f4a52-3c1e-4f7a-9d55-6a1f0c2b9e01",
  etapaDeal: "reuniao_realizada",
  atletaId: "5d2c8e17-9a4b-4c3d-8e6f-1a2b3c4d5e6f",
  atletaNome: "Atleta Teste",
  contrato: null,
  parcelas: [],
  itens: [],
  eventos: [],
  custos: [],
  versao: null,
  estado: "sem_contrato",
  resumo: null,
  planosTabela: {
    start: { valor: 18_000, valor_pix: 17_000, psicologa: false },
    journey: { valor: 28_500, valor_pix: 27_000, psicologa: false },
    legacy: { valor: 45_000, valor_pix: 42_000, psicologa: true },
  },
  entradaPadrao: 4_500,
  psicologaPadrao: 1_200,
  catalogo: [],
  hoje: HOJE,
});

const renderForm = () =>
  render(<ContratoForm modo="criar" dados={dealSemContrato()} formId="contrato-teste" onEnviar={vi.fn()} />);

const renderModal = async () => {
  render(
    <PlanoEscolhidoModal
      dealId={dealSemContrato().dealId}
      athleteName="Atleta Teste"
      origem="aba_contrato"
      onCancel={vi.fn()}
      onConfirmed={vi.fn()}
    />,
  );
  await screen.findByRole("radio", { name: /^Journey/ });
};

const botaoSalvar = () => screen.getByRole("button", { name: "Salvar plano" });
const campoEntrada = () => screen.getByLabelText("Valor da entrada");

async function preencherJourneyComEntrada(user: UserEvent, entrada: string) {
  await user.click(screen.getByRole("radio", { name: /^Journey/ }));
  await user.click(campoEntrada());
  await user.keyboard(entrada);
  await user.tab();
}

async function escolherFormas(user: UserEvent) {
  await user.selectOptions(screen.getByLabelText(/Forma da entrada/), "pix");
  await user.selectOptions(screen.getByLabelText(/Forma do saldo/), "pix_avista");
}

beforeEach(() => {
  acoes.carregarContratoDoDeal.mockResolvedValue(dealSemContrato());
  acoes.criarContratoCompleto.mockResolvedValue({
    success: true,
    data: { contratoId: "9f1e2d3c-4b5a-4968-8776-655443322110", movidoParaSinalPago: false },
    avisos: [],
    gamificacao: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ContratoForm — formulário de módulo (T6)", () => {
  it("digitar 7800 na entrada mantém o foco no mesmo campo e o resumo mostra R$ 7.800,00", async () => {
    const user = userEvent.setup();
    renderForm();
    const campo = campoEntrada();

    await user.click(campo);
    for (const digito of "7800") {
      await user.keyboard(digito);
      // O form antigo era declarado dentro do render: remontava e perdia o foco a cada tecla.
      expect(campo).toHaveFocus();
      expect(campoEntrada()).toBe(campo);
    }
    await user.tab();

    expect(campo).toHaveValue("7.800,00");
    const resumo = screen.getByRole("complementary", { name: "Resumo do contrato" });
    expect(within(resumo).getByText(/^R\$ 7\.800,00/)).toBeInTheDocument();
  });

  it("formas da entrada e do saldo começam SEM seleção (nada de Pix/Getnet pré-escolhido)", () => {
    renderForm();

    expect(screen.getByLabelText(/Forma da entrada/)).toHaveValue("");
    expect(screen.getByLabelText(/Forma do saldo/)).toHaveValue("");
  });

  it("não tem violações de acessibilidade (axe), nem com o aviso de entrada irrisória aberto", async () => {
    const user = userEvent.setup();
    const { container } = renderForm();

    expect(await axe(container)).toHaveNoViolations();

    await preencherJourneyComEntrada(user, "50");
    expect(screen.getByRole("checkbox", { name: /Confirmo que o valor está certo/ })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Criar contrato pelo modal — botão, motivo e envio (T6)", () => {
  it("'7.800' na entrada chega ao servidor como 7800, não como R$ 7,80", async () => {
    const user = userEvent.setup();
    await renderModal();

    await preencherJourneyComEntrada(user, "7.800");
    await escolherFormas(user);
    expect(botaoSalvar()).toBeEnabled();
    await user.click(botaoSalvar());

    await waitFor(() => expect(acoes.criarContratoCompleto).toHaveBeenCalledTimes(1));
    const [dealId, valores] = acoes.criarContratoCompleto.mock.calls[0] as [string, CondicoesContratoInput];
    expect(dealId).toBe(dealSemContrato().dealId);
    expect(valores.entrada.valor).toBe(7800);
    expect(valores.entrada.forma).toBe("pix");
    expect(valores.saldo.forma).toBe("pix_avista");
    expect(valores.valorBasePlano).toBe(28_500);
  });

  it("sem a forma da entrada e a do saldo o botão fica desabilitado e explica o motivo", async () => {
    const user = userEvent.setup();
    await renderModal();

    expect(botaoSalvar()).toBeDisabled();
    expect(botaoSalvar()).toHaveAccessibleDescription("Escolha o plano.");

    await preencherJourneyComEntrada(user, "7800");
    expect(botaoSalvar()).toBeDisabled();
    expect(screen.getByText("Escolha a forma da entrada.")).toBeVisible();
    expect(botaoSalvar()).toHaveAccessibleDescription("Escolha a forma da entrada.");

    await user.selectOptions(screen.getByLabelText(/Forma da entrada/), "pix");
    expect(botaoSalvar()).toBeDisabled();
    expect(botaoSalvar()).toHaveAccessibleDescription("Escolha a forma do saldo (ou marque “definir depois”).");

    await user.selectOptions(screen.getByLabelText(/Forma do saldo/), "pix_avista");
    expect(botaoSalvar()).toBeEnabled();
    expect(botaoSalvar()).not.toHaveAccessibleDescription();
  });

  it("o modal inteiro (form + rodapé com o motivo) não tem violações de acessibilidade (axe)", async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <PlanoEscolhidoModal
        dealId={dealSemContrato().dealId}
        athleteName="Atleta Teste"
        origem="mover_coluna"
        destinoLabel="Plano escolhido"
        onCancel={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    );
    await screen.findByRole("radio", { name: /^Journey/ });
    await preencherJourneyComEntrada(user, "7800");

    expect(screen.getByRole("dialog", { name: "Escolher plano · mover para Plano escolhido" })).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("entrada abaixo de R$ 100 exige a confirmação explícita antes de salvar", async () => {
    const user = userEvent.setup();
    await renderModal();

    await preencherJourneyComEntrada(user, "7,80");
    await escolherFormas(user);

    const confirmacao = screen.getByRole("checkbox", { name: /Confirmo que o valor está certo/ });
    expect(confirmacao).not.toBeChecked();
    expect(screen.getByText("Entrada muito baixa")).toBeInTheDocument();
    expect(botaoSalvar()).toBeDisabled();
    expect(botaoSalvar()).toHaveAccessibleDescription(
      "Entrada muito baixa para este contrato — confirme que o valor está certo.",
    );

    await user.click(confirmacao);
    expect(botaoSalvar()).toBeEnabled();
    await user.click(botaoSalvar());

    await waitFor(() => expect(acoes.criarContratoCompleto).toHaveBeenCalledTimes(1));
    const [, valores] = acoes.criarContratoCompleto.mock.calls[0] as [string, CondicoesContratoInput];
    expect(valores.entrada.valor).toBe(7.8);
    expect(valores.confirmarValorBaixo).toBe(true);
  });

  it("valor fora da tabela pede justificativa (Regra 3) antes de liberar o botão", async () => {
    const user = userEvent.setup();
    await renderModal();
    await user.click(screen.getByRole("radio", { name: /^Journey/ }));

    const valorPlano = screen.getByLabelText("Valor do plano");
    await user.clear(valorPlano);
    await user.type(valorPlano, "25.000");
    await user.tab();
    await user.selectOptions(screen.getByLabelText(/Forma do saldo/), "pix_avista");

    expect(botaoSalvar()).toBeDisabled();
    expect(botaoSalvar()).toHaveAccessibleDescription(/exigem justificativa \(Regra 3\)/);

    await user.type(screen.getByLabelText(/Justificativa das condições negociadas/), "Desconto de irmão aprovado pelo CEO");
    expect(botaoSalvar()).toBeEnabled();
  });
});

describe("mesma regra no servidor (schema que criarContratoCompleto usa)", () => {
  const condicoes = (entrada: number, confirmarValorBaixo: boolean): CondicoesContratoInput => ({
    plano: "journey",
    formaPagamentoPlano: "padrao",
    valorBasePlano: 28_500,
    valorTabela: 28_500,
    incluiPsicologa: false,
    entrada: { valor: entrada, forma: "pix", primeiroVencimento: HOJE },
    saldo: { forma: "pix_avista", primeiroVencimento: "2026-11-08" },
    confirmarValorBaixo,
  });

  it("rejeita entrada irrisória sem a confirmação e aceita com ela", () => {
    const sem = condicoesContratoSchema.safeParse(condicoes(7.8, false));
    expect(sem.success).toBe(false);
    expect(sem.error?.issues.map((i) => i.path.join("."))).toContain("confirmarValorBaixo");

    expect(condicoesContratoSchema.safeParse(condicoes(7.8, true)).success).toBe(true);
    expect(condicoesContratoSchema.safeParse(condicoes(7_800, false)).success).toBe(true);
  });
});
