// ════════════════════════════════════════════════════════════════════════
// Templates de e-mail do monitor e das notificações do CEO.
//
// Antes o corpo era `<h2>` + `<ul>` cru: chegava sem identidade e sem
// hierarquia, e o CEO passava o olho sem ler. Aqui há um layout só,
// parametrizado por tom (crítico/atenção/ação), com tabela — o único
// layout que sobrevive ao Gmail, Outlook e ao app do iPhone sem quebrar.
//
// Regras que valem para e-mail (não são preferência, são compatibilidade):
// • CSS inline — clientes de e-mail descartam <style> e classes
// • <table> para estrutura — flex/grid não são suportados no Outlook
// • largura máxima 600px e imagens só por URL absoluta
// ════════════════════════════════════════════════════════════════════════

const MARCA = {
  azul: '#193b8b',
  vinho: '#8e1824',
  verde: '#1f7a4d',
  laranja: '#a8620a',
  texto: '#0c1527',
  suave: '#5b6b8a',
  borda: '#e3e8f2',
  fundo: '#f3f5fa',
};

const TONS = {
  critico: { cor: MARCA.vinho, faixa: '#fdf1f2', rotulo: 'CRÍTICO' },
  atencao: { cor: MARCA.laranja, faixa: '#fdf6ec', rotulo: 'ATENÇÃO' },
  acao: { cor: MARCA.azul, faixa: '#eef2fb', rotulo: 'AÇÃO NECESSÁRIA' },
  ok: { cor: MARCA.verde, faixa: '#eef7f2', rotulo: 'TUDO CERTO' },
};

const escapar = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Layout base.
 * @param {object} p
 * @param {'critico'|'atencao'|'acao'|'ok'} p.tom
 * @param {string} p.titulo      Assunto visual (1 linha)
 * @param {string} [p.resumo]    Frase de contexto abaixo do título
 * @param {string[]} [p.itens]   Lista de ocorrências
 * @param {{label:string,url:string}} [p.cta]
 * @param {string} [p.rodape]
 */
function layout({ tom = 'atencao', titulo, resumo, itens = [], cta, rodape }) {
  const t = TONS[tom] || TONS.atencao;

  const listaHtml = itens.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
         ${itens
           .map(
             (i) => `<tr>
               <td style="padding:9px 0;border-bottom:1px solid ${MARCA.borda};font:14px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${MARCA.texto};">
                 <span style="display:inline-block;width:6px;height:6px;border-radius:3px;background:${t.cor};vertical-align:middle;margin-right:9px;"></span>${escapar(i)}
               </td>
             </tr>`,
           )
           .join('')}
       </table>`
    : '';

  const ctaHtml = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 0;">
         <tr><td style="border-radius:8px;background:${MARCA.azul};">
           <a href="${escapar(cta.url)}" style="display:inline-block;padding:11px 20px;font:600 14px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ffffff;text-decoration:none;">${escapar(cta.label)}</a>
         </td></tr>
       </table>`
    : '';

  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px 12px;background:${MARCA.fundo};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${MARCA.borda};border-radius:14px;overflow:hidden;">
        <tr><td style="height:4px;background:${t.cor};"></td></tr>
        <tr><td style="padding:22px 26px 0;">
          <span style="display:inline-block;padding:3px 9px;border-radius:20px;background:${t.faixa};color:${t.cor};font:700 10px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;letter-spacing:.08em;">${t.rotulo}</span>
          <h1 style="margin:12px 0 0;font:600 19px/1.35 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${MARCA.texto};">${escapar(titulo)}</h1>
          ${resumo ? `<p style="margin:7px 0 0;font:14px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${MARCA.suave};">${escapar(resumo)}</p>` : ''}
        </td></tr>
        <tr><td style="padding:14px 26px 26px;">
          ${listaHtml}
          ${ctaHtml}
        </td></tr>
        <tr><td style="padding:14px 26px;background:${MARCA.fundo};border-top:1px solid ${MARCA.borda};">
          <p style="margin:0;font:12px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${MARCA.suave};">
            ${escapar(rodape || 'BAU Engine · mensagem automática do sistema')}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Alerta do monitor (crítico ou atenção). */
function emailMonitor({ critico, itens, urlObservabilidade }) {
  return layout({
    tom: critico ? 'critico' : 'atencao',
    titulo: critico
      ? 'Alguma coisa parou de funcionar'
      : 'Pontos de atenção no funil',
    resumo: critico
      ? 'Estes itens afetam o funil agora e não se resolvem sozinhos.'
      : 'Nada parado, mas vale olhar quando puder.',
    itens,
    cta: urlObservabilidade
      ? { label: 'Abrir observabilidade', url: urlObservabilidade }
      : undefined,
    rodape: 'Você recebe este e-mail porque é destinatário de alertas em Configurações → Notificações.',
  });
}

/**
 * Briefing diário das 9h: resumo do dia anterior + fila de aprovação.
 * Substitui o antigo emailAprovacaoPendente (que saía a cada tick do
 * monitor) — ordem do CEO, 2026-08-27: uma vez por dia, com o relatório.
 */
function emailResumoDiario({ resumo, leads, urlAprovacoes }) {
  const n = leads.length;
  const itens = [
    `Leads novos: ${resumo.chegaram}` +
      (resumo.chegaram > 0
        ? ` (${resumo.quentes} QUENTE · ${resumo.mornos} MORNO · ${resumo.frios} FRIO)`
        : ''),
    `Decisões de aprovação: ${resumo.aprovados} aprovado(s) · ${resumo.reprovados} reprovado(s)`,
    `Mensagens enviadas: ${resumo.iniciais} primeira(s) · ${resumo.followups} follow-up(s)`,
    `Reuniões marcadas: ${resumo.reunioes}`,
    ...leads.slice(0, 10).map((l) =>
      `Aguardando aprovação: ${l.nome}` +
        `${l.classificacao ? ` · ${l.classificacao}` : ''}` +
        `${l.esperandoHoras != null ? ` · há ${l.esperandoHoras}h` : ''}`,
    ),
    ...(n > 10 ? [`...e mais ${n - 10} lead(s) na fila de aprovação`] : []),
  ];
  return layout({
    tom: n > 0 ? 'acao' : 'ok',
    titulo: `Resumo diário · ${resumo.dia}`,
    resumo: n === 0
      ? 'Nenhum lead aguardando sua aprovação. Os números de ontem estão abaixo.'
      : `${n === 1 ? '1 lead espera' : `${n} leads esperam`} sua decisão para entrar no pipeline. Os números de ontem estão abaixo.`,
    itens,
    cta: n > 0 && urlAprovacoes ? { label: 'Aprovar agora', url: urlAprovacoes } : undefined,
    rodape: 'Briefing diário das 9h. Aprovar libera o outreach automático; reprovar encerra o lead sem mensagem.',
  });
}

module.exports = { layout, emailMonitor, emailResumoDiario, MARCA };
