import { ArrowLink } from "./ArrowLink";
import { Eyebrow } from "./Eyebrow";
import { Reveal } from "./Reveal";

/**
 * Card institucional (BAU-02 §2.5): fundo navy, borda de 1px em ivory 8%, sem
 * sombra. No hover a borda vira azul institucional — nenhum lift, nenhum glow.
 * Instituição, não app.
 *
 * É o card de roteamento da home: eyebrow + H3 Caslon + corpo + link seta.
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
      <div className="flex h-full flex-col rounded-[var(--radius-bau)] border border-[var(--bau-hairline)] bg-bau-navy p-8 transition-colors duration-200 hover:border-bau-blue lg:p-10">
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
