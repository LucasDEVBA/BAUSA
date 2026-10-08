import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

// Arquivo .ts de propósito: prova que o `include` cobre testes sem JSX (o
// guard tests/crm-vitest-infra-invariants.test.js trava o padrão). Se o setup
// perder uma das duas metades que o RTL só faz sozinho com globais, falha aqui.
describe("vitest.setup", () => {
  it("liga o ambiente de act do React, para o aviso 'not wrapped in act(...)' aparecer", () => {
    expect((globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT).toBe(true);
  });

  it("renderiza no DOM do jsdom (pré-condição do teste de cleanup a seguir)", () => {
    render(createElement("p", null, "conteúdo do teste anterior"));

    expect(screen.getByText("conteúdo do teste anterior")).toBeInTheDocument();
  });

  it("limpa o DOM entre testes, para um teste não enxergar o render do anterior", () => {
    expect(screen.queryByText("conteúdo do teste anterior")).not.toBeInTheDocument();
    expect(document.body).toBeEmptyDOMElement();
  });
});
