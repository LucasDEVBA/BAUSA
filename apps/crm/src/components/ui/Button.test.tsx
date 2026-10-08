import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

describe("Button", () => {
  it("renderiza um <button> nativo com type=button por padrão, para não submeter formulário por acidente", () => {
    render(<Button>Salvar</Button>);

    expect(screen.getByRole("button", { name: "Salvar" })).toHaveAttribute("type", "button");
  });

  it("dispara onClick no clique e ignora o clique quando desabilitado", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Confirmar</Button>);

    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Confirmar
      </Button>,
    );
    const desabilitado = screen.getByRole("button", { name: "Confirmar" });
    expect(desabilitado).toBeDisabled();
    await user.click(desabilitado);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("com asChild estiliza o filho (link) sem injetar type", () => {
    render(
      <Button asChild variant="secondary">
        <a href="https://bolsaatletausa.com">Abrir site</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Abrir site" });
    expect(link).not.toHaveAttribute("type");
    expect(link).toHaveClass("inline-flex");
  });

  it("não tem violações de acessibilidade (axe) nas variantes", async () => {
    const { container } = render(
      <div>
        <Button>Primário</Button>
        <Button variant="secondary">Secundário</Button>
        <Button variant="ghost">Discreto</Button>
        <Button variant="destructive">Excluir</Button>
        <Button size="icon" aria-label="Fechar">
          <svg aria-hidden="true" viewBox="0 0 16 16" />
        </Button>
      </div>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("axe acusa botão de ícone sem nome acessível (prova de que a checagem roda de verdade)", async () => {
    const { container } = render(
      <Button size="icon">
        <svg aria-hidden="true" viewBox="0 0 16 16" />
      </Button>,
    );

    const resultado = await axe(container);
    expect(resultado.violations.map((violacao) => violacao.id)).toContain("button-name");
  });
});
