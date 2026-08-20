// ════════════════════════════════════════════════════════════════════════
// Sanitização do HTML de assinatura de e-mail — ESPELHO EXATO do
// sanitizeSignatureHtml da CF send-messages (functions/send-messages).
// Módulo puro (sem "use server") de propósito: roda no servidor (salvar a
// config) E no client (preview do compositor, render/paste do editor) —
// defesa em profundidade nas três superfícies.
//
// Denylist endurecida (revisão adversarial 2026-08-20):
// - ITERATIVA até estabilizar — remoção de passagem única reconstrói tag
//   aninhada (<scr<script>ipt> → <script>).
// - Handlers on* aceitam `/` como separador de atributo (<img/onerror=…>),
//   por isso a classe [\s/"'] no prefixo.
// - Cobre javascript:/vbscript:/data:text/html em href/src/formaction/
//   action/xlink:href/srcdoc/data, expression() e url(javascript:) de CSS.
// Guard de paridade: tests/email-invariants.test.js.
// ════════════════════════════════════════════════════════════════════════

export function sanitizarHtmlAssinatura(html: string): string {
  if (!html || typeof html !== "string") return "";
  let out = html;
  let prev: string;
  do {
    prev = out;
    out = out
      .replace(
        /<\s*\/?\s*(script|style|iframe|object|embed|form|link|meta|svg|math|base|template)[^>]*>/gi,
        "",
      )
      .replace(/[\s/"']on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(
        /(href|src|formaction|action|xlink:href|srcdoc|data)\s*=\s*("|')?\s*(javascript|vbscript):[^"'\s>]*("|')?/gi,
        "",
      )
      .replace(/(href|src|formaction|action)\s*=\s*("|')?\s*data\s*:\s*text\/html[^"'\s>]*("|')?/gi, "")
      .replace(/expression\s*\(/gi, "")
      .replace(/url\s*\(\s*("|')?\s*(javascript|vbscript):/gi, "url(");
  } while (out !== prev);
  return out;
}
