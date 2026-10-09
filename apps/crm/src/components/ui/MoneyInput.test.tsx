import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { MoneyInput } from "./MoneyInput";

// Pai controlado que re-renderiza a cada tecla: é o cenário do bug do T6, em
// que o formulário antigo recriava o campo a cada dígito e o foco caía.
function CampoControlado({
  inicial = null,
  onValor,
}: {
  inicial?: number | null;
  onValor?: (v: number | null, info: { invalido: boolean }) => void;
}) {
  const [valor, setValor] = useState<number | null>(inicial);
  return (
    <>
      <MoneyInput
        label="Entrada"
        value={valor}
        onValueChange={(v, info) => {
          setValor(v);
          onValor?.(v, info);
        }}
      />
      <output aria-label="Valor no estado">{valor === null ? "vazio" : String(valor)}</output>
    </>
  );
}

const valorNoEstado = () => screen.getByRole("status", { name: "Valor no estado" });

describe("MoneyInput (T6)", () => {
  it("mantém o foco no MESMO campo a cada dígito de 7800 e só formata ao sair", async () => {
    const user = userEvent.setup();
    render(<CampoControlado />);
    const campo = screen.getByLabelText("Entrada");

    await user.click(campo);
    for (const digito of "7800") {
      await user.keyboard(digito);
      expect(campo).toHaveFocus();
      // Mesmo nó = o campo não foi remontado (era isso que derrubava o foco).
      expect(screen.getByLabelText("Entrada")).toBe(campo);
    }
    // Enquanto digita, o texto não é reformatado (o cursor não pula).
    expect(campo).toHaveValue("7800");
    expect(valorNoEstado()).toHaveTextContent("7800");

    await user.tab();
    expect(campo).not.toHaveFocus();
    expect(campo).toHaveValue("7.800,00");
  });

  it.each([
    ["7800", 7800, "7.800,00"],
    ["7.800", 7800, "7.800,00"],
    ["7.800,00", 7800, "7.800,00"],
    ["7.800,5", 7800.5, "7.800,50"],
    ["R$ 4.500", 4500, "4.500,00"],
  ])("'%s' vira %d (ponto é milhar: o caso Amanda gravou R$ 7,80)", async (digitado, esperado, exibido) => {
    const user = userEvent.setup();
    const onValor = vi.fn();
    render(<CampoControlado onValor={onValor} />);
    const campo = screen.getByLabelText("Entrada");

    await user.type(campo, digitado);
    await user.tab();

    expect(onValor).toHaveBeenLastCalledWith(esperado, { invalido: false });
    expect(valorNoEstado()).toHaveTextContent(String(esperado));
    expect(campo).toHaveValue(exibido);
  });

  it("começa a digitação do zero quando o valor atual é 0 (sem colar no '0,00')", async () => {
    const user = userEvent.setup();
    render(<CampoControlado inicial={0} />);
    const campo = screen.getByLabelText("Entrada");
    expect(campo).toHaveValue("0,00");

    await user.click(campo);
    await user.keyboard("7800");
    await user.tab();

    expect(valorNoEstado()).toHaveTextContent("7800");
    expect(campo).toHaveValue("7.800,00");
  });

  it("valor inválido fica visível com erro acessível e não sobe para o formulário", async () => {
    const user = userEvent.setup();
    const onValor = vi.fn();
    render(<CampoControlado onValor={onValor} />);
    const campo = screen.getByLabelText("Entrada");

    await user.type(campo, "1.2.3");
    await user.tab();

    expect(campo).toHaveValue("1.2.3");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAccessibleDescription("Valor inválido. Use o formato 7.800,00.");
    expect(screen.getByRole("alert")).toHaveTextContent("Valor inválido");
    // inválido ≠ vazio: o 2º argumento avisa para TRAVAR o envio.
    expect(onValor).toHaveBeenLastCalledWith(null, { invalido: true });
    expect(valorNoEstado()).toHaveTextContent("vazio");
  });

  it("hábito en-US '4.500.00' é inválido (nunca vira 0 nem 4,5)", async () => {
    const user = userEvent.setup();
    const onValor = vi.fn();
    render(<CampoControlado onValor={onValor} />);
    const campo = screen.getByLabelText("Entrada");

    await user.type(campo, "4.500.00");
    await user.tab();

    expect(onValor).toHaveBeenLastCalledWith(null, { invalido: true });
    expect(campo).toHaveAttribute("aria-invalid", "true");
  });

  it("valor novo vindo de fora descarta o texto inválido e avisa que deixou de ser inválido", async () => {
    const user = userEvent.setup();
    const onValor = vi.fn();
    function ComServico() {
      const [valor, setValor] = useState<number | null>(null);
      return (
        <>
          <MoneyInput label="Novo valor" value={valor} onValueChange={(v, info) => { setValor(v); onValor(v, info); }} />
          <button type="button" onClick={() => setValor((v) => (v ?? 0) + 2500)}>+ TOEFL</button>
        </>
      );
    }
    render(<ComServico />);
    const campo = screen.getByLabelText("Novo valor");

    await user.type(campo, "28.5.00");
    await user.click(screen.getByRole("button", { name: "+ TOEFL" }));

    expect(campo).toHaveValue("2.500,00");
    expect(campo).not.toHaveAttribute("aria-invalid");
    expect(onValor).toHaveBeenLastCalledWith(2500, { invalido: false });

    // Sair e voltar ao campo NÃO apaga mais o valor (antes o blur emitia null).
    await user.click(campo);
    await user.tab();
    expect(campo).toHaveValue("2.500,00");
    expect(onValor).toHaveBeenLastCalledWith(2500, { invalido: false });
  });

  it("apagar tudo devolve null (vazio), não zero", async () => {
    const user = userEvent.setup();
    render(<CampoControlado inicial={4500} />);
    const campo = screen.getByLabelText("Entrada");
    expect(campo).toHaveValue("4.500,00");

    await user.clear(campo);

    expect(valorNoEstado()).toHaveTextContent("vazio");
  });

  it("valor que chega de fora (ex.: 'Usar sugestão') aparece formatado", () => {
    const { rerender } = render(<MoneyInput label="Entrada" value={null} onValueChange={vi.fn()} />);
    const campo = screen.getByLabelText("Entrada");
    expect(campo).toHaveValue("");

    rerender(<MoneyInput label="Entrada" value={4500} onValueChange={vi.fn()} />);

    expect(campo).toHaveValue("4.500,00");
  });

  it("não tem violações de acessibilidade (axe) com rótulo, ajuda, erro e aria-label", async () => {
    const { container } = render(
      <div>
        <MoneyInput label="Valor da NF" value={7800} onValueChange={vi.fn()} ajuda="Com centavos, ex.: 7.800,00." />
        <MoneyInput label="Reembolso" value={null} onValueChange={vi.fn()} erro="Informe um valor." />
        <MoneyInput aria-label="Valor do item" value={2500} onValueChange={vi.fn()} />
      </div>,
    );

    expect(await axe(container)).toHaveNoViolations();
    expect(screen.getByLabelText("Valor da NF")).toHaveAccessibleDescription("Com centavos, ex.: 7.800,00.");
    expect(screen.getByLabelText("Reembolso")).toHaveAccessibleDescription("Informe um valor.");
  });
});
