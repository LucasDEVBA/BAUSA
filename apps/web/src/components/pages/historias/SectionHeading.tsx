interface SectionHeadingProps {
  /** id do <h2>, para o aria-labelledby da seção. */
  id: string;
  eyebrow: string;
  titleLead: string;
  /** Trecho em serif itálico com gradiente (o acento da identidade). */
  titleAccent: string;
  /** Pontuação depois do acento, quando o título é uma frase. */
  trailing?: string;
  lead: string;
  tone?: "light" | "dark";
}

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

/** Cabeçalho dividido das seções de /historias: título à esquerda, contexto à direita no desktop. */
export default function SectionHeading({ id, eyebrow, titleLead, titleAccent, trailing = "", lead, tone = "light" }: SectionHeadingProps) {
  const dark = tone === "dark";

  return (
    <div className="grid items-end gap-5 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
      <div>
        <span className={`ba-eyebrow ba-rv max-sm:!text-[11px] ${dark ? "ba-glass-dark !text-[#cfdcff]" : "ba-glass"}`}>
          <span className="ba-dot" />
          {eyebrow}
        </span>
        <h2
          id={id}
          className={`ba-h2 ba-rv mt-5 text-balance text-[clamp(32px,4.6vw,60px)] ${dark ? "text-white" : "text-[var(--ba-navy)]"}`}
          style={delay(1)}
        >
          {titleLead}{" "}
          <span className={`ba-serif text-[1.08em] ${dark ? "ba-grad-text-dark" : "ba-grad-text"}`}>{titleAccent}</span>
          {trailing}
        </h2>
      </div>
      <p
        className={`ba-lead ba-rv max-w-[480px] lg:mb-2 lg:border-l lg:pl-8 ${
          dark ? "!text-[rgba(232,238,255,0.82)] lg:border-white/15" : "lg:border-[var(--ba-stroke)]"
        }`}
        style={delay(2)}
      >
        {lead}
      </p>
    </div>
  );
}
