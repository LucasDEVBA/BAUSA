import { cn } from "@/lib/utils";

import { Eyebrow } from "./Eyebrow";
import { Reveal } from "./Reveal";

/**
 * Destaque numérico como seção-pausa própria (BAU-02 §2.3): o número em Caslon
 * de 96–140px, com a fonte fazendo todo o trabalho — sem caixa, sem gradiente,
 * sem contador girando.
 *
 * Uso canônico: o "96%" da página /jornada.
 */
export function MonumentalStat({
  value,
  eyebrow,
  children,
  className,
}: {
  value: string;
  eyebrow?: string;
  /** Texto de apoio — o dado sozinho não conta a história. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-10 lg:grid-cols-12 lg:items-center", className)}>
      <Reveal className="lg:col-span-5">
        {eyebrow ? <Eyebrow className="mb-6">{eyebrow}</Eyebrow> : null}
        <p className="bau-display text-[5.5rem] leading-[0.9] text-bau-ivory sm:text-[7.5rem] lg:text-[8.75rem]">
          {value}
        </p>
      </Reveal>

      {children ? (
        <Reveal delay={120} className="bau-prose text-[17px] text-bau-stone lg:col-span-6 lg:col-start-7">
          {children}
        </Reveal>
      ) : null}
    </div>
  );
}
