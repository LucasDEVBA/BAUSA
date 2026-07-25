import { Reveal } from "./Reveal";

/**
 * Tabela de contraste mercado × Educação Esportiva Inteligente® (BAU-02 §2.5).
 *
 * A hierarquia visual conta a história sozinha: a coluna do mercado em stone
 * apagado, a da BAU em ivory pleno com hairline gold no topo. Nenhuma seta,
 * nenhum ícone de "certo/errado" — o peso tipográfico basta.
 *
 * Semanticamente é uma `<table>`: são dados comparativos em duas colunas, e
 * leitores de tela precisam do par cabeçalho↔célula.
 */
export interface ContrastRow {
  market: string;
  bau: string;
}

export function ContrastTable({
  marketLabel,
  bauLabel,
  rows,
  caption,
}: {
  marketLabel: string;
  bauLabel: string;
  rows: readonly ContrastRow[];
  /** Descrição para leitores de tela. */
  caption?: string;
}) {
  return (
    <Reveal>
      <table className="w-full border-collapse text-left">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            <th scope="col" className="bau-mono w-1/2 pb-5 pr-6 text-[11px] font-medium text-bau-stone">
              {marketLabel}
            </th>
            <th
              scope="col"
              className="bau-mono w-1/2 border-t border-bau-gold pb-5 pl-6 pt-5 text-[11px] font-medium text-bau-ivory"
            >
              {bauLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.bau} className="border-t border-[var(--bau-hairline)] align-top">
              <td className="py-6 pr-6 text-[16px] leading-relaxed text-bau-stone/70">{row.market}</td>
              <td className="py-6 pl-6 text-[16px] leading-relaxed text-bau-ivory">{row.bau}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Reveal>
  );
}
