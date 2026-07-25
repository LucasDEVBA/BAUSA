#!/usr/bin/env node
/**
 * Guard da copy do site institucional. Roda no `build` — que é o ÚNICO gate
 * bloqueante do CI para apps/web (lint roda com `|| true` e não há typecheck).
 *
 * Protege contra as duas falhas silenciosas desta base de código:
 *
 *   1. CHAVE INEXISTENTE VIRA TEXTO NA TELA. Tanto o `t()` legado quanto o
 *      next-intl degradam chave ausente para o próprio caminho da chave. Um
 *      typo em `t("home.hero.titel")` publica "home.hero.titel" na home.
 *
 *   2. VIOLAÇÃO DAS REGRAS DE TOM (BAU-01). "vaga", "pacote", "garantia de
 *      bolsa" e afins são proibidos: a BAU não é agência de intercâmbio. E o
 *      CTA primário se chama "Iniciar avaliação estratégica" em todo o site —
 *      o guia diagnosticou cinco nomes diferentes para a mesma ação.
 *
 * Zero dependências (node:test/fs apenas), no mesmo espírito de `tests/*.test.js`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_COPY = join(ROOT, "src/i18n/site/pt.ts");
const SCAN_DIRS = [join(ROOT, "src/components"), join(ROOT, "app")];

const errors = [];

// ── 1. Termos proibidos e CTA canônico ──────────────────────────────────────

/**
 * Palavras proibidas do BAU-01. Usam limite de palavra para não acusar falso
 * positivo em ocorrências legítimas ("divulgar" contém "vulga", "empacotar"
 * contém "pacot"). "vaga" é checado à parte porque aparece legitimamente na
 * negativa "Agências vendem vagas" — ver ALLOWED_CONTEXTS.
 */
const FORBIDDEN = [
  "pacote",
  "pacotes",
  "programa de intercâmbio",
  "promoção",
  "garantia de bolsa",
  "oportunidade imperdível",
  "últimas vagas",
  "barato",
  "desconto",
];

/**
 * Frases em que um termo proibido aparece DE PROPÓSITO, para nomear o que a
 * marca não é. Precisam casar exatamente com a copy aprovada.
 */
const ALLOWED_CONTEXTS = [
  "Agências vendem vagas.",
  "Vagas e pacotes",
  "bolsa é desconto, não destino",
];

const CANONICAL_CTA = "Iniciar avaliação estratégica";
/** Variações que o BAU-02 mandou eliminar. */
const CTA_VARIANTS = [
  "Iniciar Avaliação",
  "Fale Conosco",
  "Agende uma reunião",
  "Iniciar uma conversa",
  "Solicitar avaliação",
];

const copyRaw = readFileSync(SITE_COPY, "utf8");
// Ignora o cabeçalho de comentários, que cita os termos proibidos para documentá-los.
const copyBody = copyRaw.slice(copyRaw.indexOf("export const sitePt"));

let copySansAllowed = copyBody;
for (const allowed of ALLOWED_CONTEXTS) {
  copySansAllowed = copySansAllowed.split(allowed).join("");
}

for (const term of FORBIDDEN) {
  const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  if (re.test(copySansAllowed)) {
    errors.push(
      `Termo proibido pelo BAU-01 na copy: "${term}". A BAU não é agência de intercâmbio.`,
    );
  }
}

if (!copyBody.includes(CANONICAL_CTA)) {
  errors.push(`O CTA canônico "${CANONICAL_CTA}" sumiu de src/i18n/site/pt.ts.`);
}

for (const variant of CTA_VARIANTS) {
  if (copySansAllowed.includes(variant)) {
    errors.push(
      `Variação de CTA proibida: "${variant}". Use apenas "${CANONICAL_CTA}" (BAU-02, Parte 1, item 3).`,
    );
  }
}

// ── 2. Chaves referenciadas x chaves existentes ─────────────────────────────

/**
 * Extrai os caminhos de chave de `sitePt` a partir do próprio módulo, sem
 * executar TypeScript: percorre a indentação do objeto literal. É frágil a
 * reformatação exótica, mas o arquivo é gerado por humanos com Prettier e o
 * custo de um parser real não se paga aqui.
 */
function extractKeyPaths(source) {
  const body = source.slice(source.indexOf("export const sitePt"));
  const paths = new Set();
  const stack = [];

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      continue;
    }

    const depth = (line.match(/^\s*/)?.[0].length ?? 0) / 2;
    const open = trimmed.match(/^([A-Za-z_][\w]*)\s*:\s*[{[]/);
    const leaf = trimmed.match(/^([A-Za-z_][\w]*)\s*:/);

    if (open) {
      stack.length = Math.max(0, depth - 1);
      stack.push(open[1]);
      paths.add(stack.join("."));
    } else if (leaf) {
      const prefix = stack.slice(0, Math.max(0, depth - 1));
      paths.add([...prefix, leaf[1]].join("."));
    }

    if (trimmed.startsWith("}") || trimmed.startsWith("]")) {
      stack.length = Math.max(0, depth - 1);
    }
  }

  return paths;
}

function walkFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkFiles(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

const knownKeys = extractKeyPaths(copyRaw);

// `useTranslations("site")` / `getTranslations("site")` + t("caminho.da.chave")
const NAMESPACE_RE = /(?:useTranslations|getTranslations)\(\s*["'`]site(?:\.([\w.]+))?["'`]\s*\)/;
const CALL_RE = /\bt\(\s*["'`]([\w.]+)["'`]/g;

for (const file of SCAN_DIRS.flatMap((d) => walkFiles(d))) {
  const source = readFileSync(file, "utf8");
  const ns = source.match(NAMESPACE_RE);
  if (!ns) continue;

  const prefix = ns[1] ? `${ns[1]}.` : "";
  for (const match of source.matchAll(CALL_RE)) {
    const key = `${prefix}${match[1]}`;
    if (!knownKeys.has(key)) {
      errors.push(
        `${file.replace(`${ROOT}/`, "")}: chave "${key}" não existe em src/i18n/site/pt.ts ` +
          `— renderizaria o caminho da chave como texto na página.`,
      );
    }
  }
}

// ── Resultado ───────────────────────────────────────────────────────────────

if (errors.length > 0) {
  console.error("\n✗ Guard da copy do site falhou:\n");
  for (const error of errors) console.error(`  · ${error}`);
  console.error("");
  process.exit(1);
}

console.log(`✓ Copy do site validada (${knownKeys.size} chaves).`);
