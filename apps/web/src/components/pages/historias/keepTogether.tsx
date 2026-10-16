import { Fragment, type ReactNode } from "react";

const HYPHENATED = /(\S*\w-\w\S*)/g;
// Sigla de clube colada ao nome: "FC / Wichita" e "EC / Vitória" partidos em duas linhas liam como dois nomes
const CLUB_PREFIX = /\b(FC|EC|SC) (?=\S)/g;

/**
 * Termos que não podem quebrar no meio: palavras com hífen ("Sub-17", "All-America"), que em
 * coluna estreita viravam "Sub-" / "17", e siglas de clube com o nome. O resto quebra normal.
 */
export function keepTogether(text: string): ReactNode {
  const glued = text.replace(CLUB_PREFIX, "$1 ");
  const parts = glued.split(HYPHENATED);
  if (parts.length === 1) return glued;
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}
