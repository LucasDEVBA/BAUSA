import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CadastroEncontrado } from "@/lib/actions/leads-busca";

import { detalharSemClassificacao, ForaDoPipelineFaixa } from "./ForaDoPipelineFaixa";

const acoes = vi.hoisted(() => ({
  classificarCadastroAgora: vi.fn(),
  enviarFrioParaAprovacao: vi.fn(),
  enviarIncompletoParaAprovacao: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("@/lib/actions/qualify-retry", () => ({ classificarCadastroAgora: acoes.classificarCadastroAgora }));
vi.mock("@/lib/actions/leads", () => ({
  enviarFrioParaAprovacao: acoes.enviarFrioParaAprovacao,
  enviarIncompletoParaAprovacao: acoes.enviarIncompletoParaAprovacao,
}));
vi.mock("@/lib/actions/leads-busca", () => ({}));
vi.mock("sonner", () => ({ toast }));

const ID = "7f3a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b";

const semClasse = (extra: Partial<CadastroEncontrado> = {}): CadastroEncontrado => ({
  id: ID,
  athlete_name: "Atleta Sem Classe",
  guardian_name: "Responsável Teste",
  qualification_classification: null,
  qualification_reason: null,
  aprovacao_status: null,
  aprovacao_decidida_em: null,
  aprovacao_motivo: null,
  timing_status: null,
  submitted_at: "2026-11-17T12:00:00.000Z",
  meeting_scheduled: false,
  meeting_scheduled_at: null,
  deal_id: null,
  deal_etapa: null,
  deal_motivo_perda: null,
  local: { tipo: "fora_sem_classificacao", noBoard: false },
  ...extra,
});

const renderFaixa = (item: CadastroEncontrado, onAtualizado = vi.fn()) =>
  render(
    <ForaDoPipelineFaixa
      estado={{ status: "ok", termo: "atleta", itens: [item], total: 1 }}
      estaVisivel={() => false}
      rotuloEtapa={(e) => e}
      onAbrirDossie={vi.fn()}
      onAbrirRevisao={vi.fn()}
      onAtualizado={onAtualizado}
      onTentarDeNovo={vi.fn()}
    />,
  );

describe("detalharSemClassificacao", () => {
  it("should keep the generic text when there is no diagnosis", () => {
    expect(detalharSemClassificacao(undefined)).toBe("Qualificação pendente ou com falha");
  });

  it("should say the AI was never called when there are no attempts, errors or missing fields", () => {
    expect(
      detalharSemClassificacao({ tentativas: 0, ultimoErro: null, ultimaTentativaEm: null, camposFaltando: [] }),
    ).toBe("Qualificação ainda não rodou — a IA nunca foi chamada para este cadastro");
  });

  it("should list attempts, last error and missing fields", () => {
    expect(
      detalharSemClassificacao({
        tentativas: 3,
        ultimoErro: "Gemini timeout",
        ultimaTentativaEm: "2026-11-17T12:05:00.000Z",
        camposFaltando: ["faixa de investimento"],
      }),
    ).toBe("3 tentativas · último erro: Gemini timeout · faltam: faixa de investimento");
  });
});

describe("ForaDoPipelineFaixa — Classificar agora", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show the button only for unclassified leads", () => {
    renderFaixa(semClasse({ qualification_classification: "FRIO", local: { tipo: "fora_janela", noBoard: false } }));
    expect(screen.queryByRole("button", { name: /classificar agora/i })).toBeNull();
  });

  it("should classify the lead and refresh the strip when the AI answers", async () => {
    const user = userEvent.setup();
    const onAtualizado = vi.fn();
    acoes.classificarCadastroAgora.mockResolvedValue({
      success: true,
      classificacao: "MORNO",
      pendente: false,
      ultimoErro: null,
    });
    renderFaixa(semClasse(), onAtualizado);

    await user.click(screen.getByRole("button", { name: /classificar agora/i }));

    await waitFor(() => expect(onAtualizado).toHaveBeenCalledTimes(1));
    expect(acoes.classificarCadastroAgora).toHaveBeenCalledWith(ID);
    expect(toast.success).toHaveBeenCalledWith("Atleta Sem Classe classificado como MORNO", expect.anything());
  });

  it("should warn with the last error when the lead stays unclassified", async () => {
    const user = userEvent.setup();
    acoes.classificarCadastroAgora.mockResolvedValue({
      success: true,
      classificacao: null,
      pendente: true,
      ultimoErro: "HTTP 429",
    });
    renderFaixa(semClasse());

    await user.click(screen.getByRole("button", { name: /classificar agora/i }));

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith("Atleta Sem Classe continua sem classificação", {
        description: "Último erro: HTTP 429",
      }),
    );
  });

  it("should show the action error and not refresh when the action refuses", async () => {
    const user = userEvent.setup();
    const onAtualizado = vi.fn();
    acoes.classificarCadastroAgora.mockResolvedValue({ success: false, error: "Este cadastro já foi classificado (FRIO). Refaça a busca." });
    renderFaixa(semClasse(), onAtualizado);

    await user.click(screen.getByRole("button", { name: /classificar agora/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Este cadastro já foi classificado (FRIO). Refaça a busca."));
    expect(onAtualizado).not.toHaveBeenCalled();
  });

  it("should render the diagnosis and have no accessibility violations", async () => {
    const { container } = renderFaixa(
      semClasse({
        diagnostico: { tentativas: 2, ultimoErro: "Gemini timeout", ultimaTentativaEm: null, camposFaltando: [] },
      }),
    );
    expect(screen.getByText(/2 tentativas · último erro: Gemini timeout/)).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });
});
