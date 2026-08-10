"use client";

/**
 * Texto de mensagem com URLs clicáveis. Só http(s) vira link (um `javascript:`
 * colado numa conversa nunca pode virar href); o resto permanece texto puro
 * (escapado pelo React).
 */

const URL_SPLIT_RE = /(https?:\/\/[^\s<>"')\]]+)/g;

export function TextoLinkado({ texto }: { texto: string }) {
  const partes = texto.split(URL_SPLIT_RE);
  if (partes.length === 1) return <>{texto}</>;
  return (
    <>
      {partes.map((parte, i) =>
        /^https?:\/\//i.test(parte) ? (
          <a
            key={i}
            href={parte}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline underline-offset-2 hover:opacity-80"
          >
            {parte}
          </a>
        ) : (
          <span key={i}>{parte}</span>
        ),
      )}
    </>
  );
}
