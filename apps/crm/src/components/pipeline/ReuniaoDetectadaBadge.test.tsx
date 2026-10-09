import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";

import { ReuniaoDetectadaBadge } from "./ReuniaoDetectadaBadge";

// 02:30 UTC = 23:30 do dia ANTERIOR em Brasília: o fuso do servidor (UTC)
// mostraria 21/09 no SSR e o navegador 20/09 na hidratação.
const DETECTADA_NA_VIRADA_DO_DIA = "2026-09-21T02:30:00Z";

describe("ReuniaoDetectadaBadge (contrato B4)", () => {
  it("mostra a data ABSOLUTA no fuso de Brasília no title e no texto para leitor de tela", () => {
    render(<ReuniaoDetectadaBadge detectadaEm={DETECTADA_NA_VIRADA_DO_DIA} />);

    const badge = screen.getByTitle("Reunião detectada no Google Calendar em 20/09/2026");
    expect(badge).toHaveTextContent("Reunião detectada");
    expect(badge).toHaveTextContent("no Google Calendar em 20/09/2026");
  });

  it('só diz "sem deal" quando quem usa garante que não há deal ativo', () => {
    const { rerender } = render(<ReuniaoDetectadaBadge detectadaEm={DETECTADA_NA_VIRADA_DO_DIA} />);
    expect(screen.getByText("Reunião detectada", { exact: false })).not.toHaveTextContent("não tem deal");

    rerender(<ReuniaoDetectadaBadge detectadaEm={DETECTADA_NA_VIRADA_DO_DIA} semDeal />);
    expect(
      screen.getByTitle(
        "Reunião detectada no Google Calendar em 20/09/2026 — o lead ainda não tem deal no pipeline",
      ),
    ).toHaveTextContent("o lead ainda não tem deal no pipeline");
  });

  it("sem data (ou data inválida) omite o trecho da data em vez de mostrar Invalid Date", () => {
    const { rerender } = render(<ReuniaoDetectadaBadge semDeal />);
    expect(
      screen.getByTitle("Reunião detectada no Google Calendar — o lead ainda não tem deal no pipeline"),
    ).toBeInTheDocument();

    rerender(<ReuniaoDetectadaBadge detectadaEm="não é data" />);
    expect(screen.getByTitle("Reunião detectada no Google Calendar")).not.toHaveTextContent("Invalid");
  });

  it("não tem violações de acessibilidade (axe) nas duas variantes, inclusive dentro de um botão de lista", async () => {
    const { container } = render(
      <div>
        <ReuniaoDetectadaBadge variante="card" detectadaEm={DETECTADA_NA_VIRADA_DO_DIA} semDeal />
        <button type="button">
          Clara Teste
          <ReuniaoDetectadaBadge detectadaEm={DETECTADA_NA_VIRADA_DO_DIA} />
        </button>
      </div>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
