/**
 * Gerador de recibo de pagamento (documento imprimível — não persiste nada).
 * Abre uma janela nova com o recibo formatado e dispara a impressão (o usuário
 * salva como PDF pelo diálogo de impressão). Sem dependências externas.
 */

import type { EmpresaDados } from "@/types/financeiro";

export interface ReciboDados {
  empresa: EmpresaDados;
  recebedorNome: string;
  recebedorDoc?: string | null; // CPF/CNPJ do recebedor
  valor: number;
  referente: string; // ex.: "Folha — competência 07/2026"
  data?: Date;
}

// ─── Valor por extenso (BRL) ─────────────────────────────────────────────
const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ateNoveCentos(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto < 10) partes.push(UNIDADES[resto]);
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(" e ");
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const centenas = n % 1000;
  const partes: string[] = [];
  if (milhoes > 0) partes.push(milhoes === 1 ? "um milhão" : `${ateNoveCentos(milhoes)} milhões`);
  if (milhares > 0) partes.push(milhares === 1 ? "mil" : `${ateNoveCentos(milhares)} mil`);
  if (centenas > 0) partes.push(ateNoveCentos(centenas));
  return partes.join(" e ");
}

export function valorPorExtenso(valor: number): string {
  const inteiro = Math.floor(valor);
  const centavos = Math.round((valor - inteiro) * 100);
  // "milhão/milhões" exigem "de" quando não há classe inferior seguindo:
  // "um milhão de reais", mas "um milhão e quinhentos mil reais".
  const usaDe = inteiro >= 1_000_000 && inteiro % 1_000_000 === 0;
  const reais = `${usaDe ? "de " : ""}${inteiro === 1 ? "real" : "reais"}`;
  let texto = `${inteiroPorExtenso(inteiro)} ${reais}`;
  if (centavos > 0) {
    const centStr = centavos === 1 ? "centavo" : "centavos";
    texto += ` e ${inteiroPorExtenso(centavos)} ${centStr}`;
  }
  return texto;
}

// ─── Render + impressão ──────────────────────────────────────────────────
const escapeHtml = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

export function gerarReciboHTML(d: ReciboDados): string {
  const data = d.data ?? new Date();
  const dataStr = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const local = d.empresa.cidade ? `${escapeHtml(d.empresa.cidade)}, ` : "";
  const pagador = escapeHtml(d.empresa.razao_social || "Bolsa Atleta USA");
  const cnpj = d.empresa.cnpj ? ` — CNPJ ${escapeHtml(d.empresa.cnpj)}` : "";
  const doc = d.recebedorDoc ? `, CPF/CNPJ ${escapeHtml(d.recebedorDoc)},` : "";
  const extenso = valorPorExtenso(d.valor);

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Recibo — ${escapeHtml(d.recebedorNome)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #111; margin: 0; padding: 48px; }
  .doc { max-width: 720px; margin: 0 auto; border: 1px solid #ddd; border-radius: 12px; padding: 40px; }
  .topo { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #193b8b; padding-bottom: 16px; margin-bottom: 28px; }
  .empresa { font-size: 15px; font-weight: 700; color: #193b8b; }
  .empresa small { display: block; font-weight: 400; color: #555; font-size: 12px; margin-top: 2px; }
  h1 { font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: #666; margin: 0; text-align: right; }
  .valor { font-size: 30px; font-weight: 800; color: #193b8b; margin: 8px 0 28px; }
  .corpo { font-size: 15px; line-height: 1.9; }
  .assinatura { margin-top: 72px; text-align: center; }
  .linha { border-top: 1px solid #333; width: 320px; margin: 0 auto 6px; }
  .assinatura small { color: #555; font-size: 13px; }
  .rodape { margin-top: 40px; text-align: right; color: #333; font-size: 14px; }
  @media print { body { padding: 0; } .doc { border: none; } }
</style></head><body onload="window.print()">
  <div class="doc">
    <div class="topo">
      <div class="empresa">${pagador}<small>${escapeHtml(d.empresa.cnpj ? `CNPJ ${d.empresa.cnpj}` : "")}</small></div>
      <h1>Recibo de Pagamento</h1>
    </div>
    <div class="valor">${formatBRL(d.valor)}</div>
    <div class="corpo">
      Recebi de <strong>${pagador}</strong>${cnpj} a importância de <strong>${escapeHtml(extenso)}</strong> (${formatBRL(d.valor)}),
      referente a <strong>${escapeHtml(d.referente)}</strong>, dando plena e total quitação pelo valor recebido.
    </div>
    <div class="rodape">${local}${dataStr}.</div>
    <div class="assinatura">
      <div class="linha"></div>
      <small><strong>${escapeHtml(d.recebedorNome)}</strong>${doc}</small>
    </div>
  </div>
</body></html>`;
}

/** Abre o recibo numa janela nova e dispara a impressão. */
export function abrirRecibo(d: ReciboDados): boolean {
  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return false; // pop-up bloqueado
  win.document.write(gerarReciboHTML(d));
  win.document.close();
  return true;
}
