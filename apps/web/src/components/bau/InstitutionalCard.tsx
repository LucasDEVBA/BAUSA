import { ArrowLink } from "./ArrowLink";
import { CornerBrackets } from "./BrandRule";
import { Eyebrow } from "./Eyebrow";
import { Reveal } from "./Reveal";

/**
 * Card institucional (BAU-02 §2.5): fundo navy, borda de 1px em ivory 8%, sem
 * sombra. Instituição, não app — nenhum lift, nenhum arredondamento de 12px.
 *
 * Detalhes de paleta que aparecem só no hover, como recompensa à atenção:
 * cantos em L dourados (eco do frame REC), brilho azul institucional e um
 * filete gold que atravessa o topo do card.
 */
export function InstitutionalCard({
  eyebrow,
  title,
  description,
  href,
  linkLabel,
  delay = 0,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} as="article" className="h-full">
      <div className="bau-glow-hover group relative flex h-full flex-col rounded-[var(--radius-bau)] border border-[var(--bau-hairline)] bg-bau-navy p-8 lg:p-10">
        {/* Filete gold no topo, desenhando-se no hover. */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-gradient-to-r from-bau-gold via-bau-gold/60 to-transparent transition-transform duration-500 group-hover:scale-x-100"
        />

        <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <CornerBrackets />
        </span>

        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="bau-display mt-6 text-[1.75rem] text-bau-ivory">{title}</h3>
        <p className="mt-4 flex-1 text-[16px] leading-relaxed text-bau-stone">{description}</p>
        <ArrowLink href={href} className="mt-8">
          {linkLabel}
        </ArrowLink>
      </div>
    </Reveal>
  );
}
