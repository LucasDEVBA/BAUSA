/**
 * Default das instruções do RESUMO DE TRANSCRIÇÃO (Google Meet) — editável
 * pelo CEO em /automacoes (configuracoes_sistema.transcricao_resumo_prompt.
 * instrucoes; vazio/ausente = este default).
 *
 * Quem executa é a CF functions/meeting-transcripts (a cada 2h): ela lê a
 * config de PUBLIC com fail-open para o MESMO texto abaixo (duplicado lá por
 * ser deploy separado — manter os dois em sincronia ao editar o default).
 * Só as INSTRUÇÕES são editáveis: a transcrição e o contrato de saída JSON
 * são montados/fixados pela CF.
 */

export const TRANSCRICAO_RESUMO_INSTRUCOES_DEFAULT = `Você é assistente comercial da Bolsa Atleta USA (assessoria de bolsas esportivas em instituições americanas).

Abaixo está a transcrição de uma reunião comercial entre o consultor e a família de um atleta (lead). Resuma em 5 a 8 linhas, em português, cobrindo: contexto da família, principais dúvidas/objeções, sinais de interesse ou risco, e próximos passos combinados. Seja objetivo e factual — não invente nada que não esteja na transcrição.`;
