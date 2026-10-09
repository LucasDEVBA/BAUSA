"use client";

import { forwardRef, useEffect, useId, useRef, useState } from "react";

import { formatarValorBRL, parseValorBRL } from "@/lib/financeiro/calculo.mjs";
import { cn } from "@/lib/utils";

/**
 * MoneyInput — dinheiro BRL COM centavos (T6).
 *
 * O bug da Amanda: `<input type="number">` lê "7.800" como 7,8. Aqui o campo é
 * texto (inputMode decimal), o parse é pt-BR ("7800", "7.800", "7.800,50"
 * → número certo) e, ao sair do campo, o texto vira "7.800,00". Enquanto a
 * pessoa digita, o texto NÃO é reformatado (o cursor não pula) e o valor só
 * sobe para o form quando é válido (`onValueChange(null)` = vazio/ inválido).
 *
 * Texto inválido ("4.500.00") NÃO é "vazio": o 2º argumento traz
 * `{ invalido: true }` e quem usa TRAVA o envio com o motivo visível — nunca
 * trocar o null por 0/"valor cheio" (o form gravava R$ 0 de entrada). Nesse
 * caso, guarde null ou deixe o valor como estava (nunca outro número): um
 * valor NOVO vindo de fora com o campo fora de foco (ex.: clicar num serviço)
 * descarta o texto inválido e avisa `onValueChange(valor, { invalido: false })`.
 *
 * Componente de MÓDULO (nunca declarar dentro de render — remonta e perde o
 * foco a cada tecla, o outro bug do formulário antigo). Integra com RHF via
 * <Controller>. text-base no mobile evita o zoom do iOS em input < 16px.
 */

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode"> {
  value: number | null;
  /** `info.invalido` = texto que não é dinheiro (valor null): TRAVAR o envio. */
  onValueChange: (valor: number | null, info: { invalido: boolean }) => void;
  /** Mensagem de erro (aria-invalid + aria-describedby). */
  erro?: string;
  /** Texto de apoio abaixo do campo. */
  ajuda?: React.ReactNode;
  label?: string;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onValueChange, erro, ajuda, label, id, className, onBlur, onFocus, disabled, placeholder = "0,00", ...props },
  ref,
) {
  const gerado = useId();
  const inputId = id ?? `money-${gerado}`;
  const ajudaId = `${inputId}-ajuda`;
  const erroId = `${inputId}-erro`;
  // rascunho = texto em edição; null = exibe o valor formatado (derivado — um
  // valor vindo de fora, ex. "usar sugestão", aparece sem efeito colateral).
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [invalido, setInvalido] = useState(false);
  const [focado, setFocado] = useState(false);
  const [valorVisto, setValorVisto] = useState(value);

  // Valor novo vindo de FORA com o campo fora de foco descarta o texto
  // inválido — senão ele continuava na tela e o próximo blur apagava o valor.
  // (null não conta: é o eco do próprio "inválido".)
  if (value !== valorVisto) {
    setValorVisto(value);
    if (invalido && !focado && value !== null) {
      setRascunho(null);
      setInvalido(false);
    }
  }

  // Avisa quem usa que o inválido foi descartado por valor externo (as outras
  // transições já avisam no próprio evento).
  const invalidoAntes = useRef(invalido);
  useEffect(() => {
    const antes = invalidoAntes.current;
    invalidoAntes.current = invalido;
    if (antes && !invalido && !focado) onValueChange(value, { invalido: false });
  }, [invalido, focado, value, onValueChange]);

  const texto = rascunho ?? formatarValorBRL(value);

  const describedBy = [ajuda ? ajudaId : null, erro || invalido ? erroId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex items-center rounded-lg border bg-card transition-colors focus-within:ring-2 focus-within:ring-ring/25",
          erro || invalido ? "border-sys-red/60" : "border-input focus-within:border-primary",
          disabled && "opacity-50",
        )}
      >
        <span aria-hidden className="pl-3 text-sm font-medium text-label-tertiary">
          R$
        </span>
        <input
          ref={ref}
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={Boolean(erro || invalido) || undefined}
          aria-describedby={describedBy}
          value={texto}
          onFocus={(e) => {
            setFocado(true);
            // Zero começa vazio: com "0,00" no campo, digitar 7800 colava no
            // fim ("0,007800"), o parse recusava e a entrada voltava vazia.
            setRascunho(value === 0 ? "" : texto);
            onFocus?.(e);
          }}
          onChange={(e) => {
            const bruto = e.target.value.replace(/[^\d.,]/g, "");
            setRascunho(bruto);
            if (bruto === "") {
              setInvalido(false);
              onValueChange(null, { invalido: false });
              return;
            }
            const v = parseValorBRL(bruto);
            // Ainda digitando ("7," / "1.") → não acusa até sair do campo.
            if (v !== null) {
              setInvalido(false);
              onValueChange(v, { invalido: false });
            }
          }}
          onBlur={(e) => {
            setFocado(false);
            const v = parseValorBRL(texto);
            if (texto !== "" && v === null) {
              // mantém o texto digitado visível, com erro
              setInvalido(true);
              onValueChange(null, { invalido: true });
            } else {
              setInvalido(false);
              setRascunho(null); // volta a exibir o valor formatado ("7.800,00")
            }
            onBlur?.(e);
          }}
          className={cn(
            "h-10 w-full bg-transparent px-2 text-base tabular-nums text-foreground outline-none sm:h-9 sm:text-sm",
            className,
          )}
          {...props}
        />
      </div>
      {ajuda && (
        <p id={ajudaId} className="text-[11px] leading-relaxed text-label-tertiary">
          {ajuda}
        </p>
      )}
      {(erro || invalido) && (
        <p id={erroId} role="alert" className="text-[11px] font-medium text-sys-red">
          {erro ?? "Valor inválido. Use o formato 7.800,00."}
        </p>
      )}
    </div>
  );
});
