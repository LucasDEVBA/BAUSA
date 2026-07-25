"use client";

import { Link } from "@/i18n/navigation";
import { trackCtaClick, type CtaSource } from "@/lib/tracking/events";
import { cn } from "@/lib/utils";

/**
 * O CTA primário — único em todo o site (BAU-02 Parte 1, item 3).
 *
 * O texto NÃO é parametrizável de propósito: o guia diagnosticou cinco nomes
 * para a mesma ação ("Fale Conosco", "Iniciar Avaliação", "Agende uma
 * reunião"…) e prescreveu um só. A ação mantém o mesmo nome do botão à página
 * de destino. Quem precisar de outro texto está querendo um `ArrowLink`.
 *
 * Regra de composição: UM por viewport. É o único uso de vermelho na tela
 * junto com o ponto do frame REC.
 */
export function CtaPrimary({
  source,
  className,
  label,
  variant = "solid",
}: {
  source: CtaSource;
  className?: string;
  /** Texto do botão. Vem da copy (site.cta.primary) — nunca inventar variação. */
  label: string;
  /**
   * `outline` é obrigatório no header.
   *
   * O checklist do BAU-02 exige UM botão vermelho por viewport. Como o header
   * é fixo, um CTA sólido lá tornaria TODO viewport do site vermelho — e
   * nenhum CTA de seção poderia mais ser sólido. O vermelho cheio fica
   * reservado ao CTA da página; o do header apenas o ecoa.
   */
  variant?: "solid" | "outline";
}) {
  return (
    <Link
      href="/avaliacao"
      onClick={() => trackCtaClick(source)}
      className={cn(
        "group relative inline-flex min-h-[56px] items-center justify-center",
        "bau-mono rounded-[var(--radius-bau)] px-8 py-[18px] text-[13px] transition-colors duration-200",
        variant === "solid"
          ? "bg-bau-red text-bau-ivory hover:bg-[#7a141f]"
          : "border border-bau-red/70 text-bau-ivory hover:border-bau-red hover:bg-bau-red/15",
        className,
      )}
    >
      {label}
      {/* Hairline gold que aparece no hover — o "filete de excelência". */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 -bottom-px h-px scale-x-0 bg-bau-gold transition-transform duration-200 group-hover:scale-x-100"
      />
    </Link>
  );
}
