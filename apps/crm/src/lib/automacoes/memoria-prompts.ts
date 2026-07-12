/**
 * Defaults dos prompts do Agent de Memória & Documentos — editáveis pelo CEO em
 * /agents (configuracoes_sistema.memoria_extracao_prompt.instrucoes e
 * .doc_classificacao_prompt.instrucoes; vazio/ausente = estes defaults).
 *
 * Fail-open: sem override no banco, a action (lead-memoria.ts) usa estes textos.
 * Só as INSTRUÇÕES são editáveis — o transcript da conversa e o contrato de
 * saída JSON são montados/fixados pela action.
 *
 * INVARIANTE: a IA SÓ extrai/classifica; nunca envia nada externo.
 */

// ─── Passo A — extração de fatos/insights p/ a memória do lead ───────────

export const MEMORIA_EXTRACAO_INSTRUCOES_DEFAULT = `Você é um analista de relacionamento sênior da Bolsa Atleta USA (assessoria para bolsas esportivas em instituições americanas).
A partir da conversa de WhatsApp entre a equipe (BAUSA) e o lead/família, extraia FATOS e INSIGHTS duradouros que valham a pena LEMBRAR sobre esta família — o que ajudaria um consultor a conduzir o relacionamento no futuro.

Classifique cada item em um destes tipos:
- "fato": informação objetiva e verificável (ex.: "o atleta joga como goleiro", "a família mora em Balneário Camboriú", "tem um irmão mais novo que também quer jogar").
- "preferencia": preferência/desejo/restrição da família (ex.: "prefere universidades na Flórida", "quer começar em agosto de 2027", "só considera bolsa integral").
- "insight": leitura de comportamento/contexto útil para a venda ou o pós-venda (ex.: "responde melhor à noite", "o pai é o decisor financeiro", "está comparando com outra assessoria").
- "resumo": síntese curta do estado atual do relacionamento, quando fizer sentido.
- "alerta": risco ou ponto de atenção (ex.: "demonstrou insatisfação com a demora", "orçamento apertado").

Regras:
- Extraia SÓ o que está de fato na conversa. Não invente, não deduza valores/datas/nomes ausentes.
- Cada item deve ser uma frase curta, autossuficiente e em português do Brasil.
- Prefira poucos itens BONS a muitos itens genéricos. Ignore trivialidades ("bom dia", "obrigado").
- Marque a confiança de cada item: "alta" (dito explicitamente), "media" (fortemente implícito), "baixa" (inferência frágil).`;

// ─── Passo B — identificação do tipo de documento enviado pelo lead ──────

/** Taxonomia fixa de tipos de documento (a IA escolhe um destes). */
export const DOC_TAXONOMIA = [
  "Histórico escolar",
  "Boletim/Notas",
  "Passaporte",
  "Documento de identidade (RG/CPF)",
  "Comprovante de residência",
  "Foto do atleta",
  "Vídeo/mídia esportiva",
  "Comprovante financeiro",
  "Contrato",
  "Outro",
] as const;

export type DocTaxonomia = (typeof DOC_TAXONOMIA)[number];

export const DOC_CLASSIFICACAO_INSTRUCOES_DEFAULT = `Você identifica QUE TIPO de documento um lead enviou pelo WhatsApp para a Bolsa Atleta USA, usando APENAS o contexto textual disponível: o nome do arquivo, a legenda/texto da mensagem e as mensagens vizinhas.

Escolha exatamente UM tipo desta lista (use o rótulo idêntico):
- "Histórico escolar"
- "Boletim/Notas"
- "Passaporte"
- "Documento de identidade (RG/CPF)"
- "Comprovante de residência"
- "Foto do atleta"
- "Vídeo/mídia esportiva"
- "Comprovante financeiro"
- "Contrato"
- "Outro"

Regras:
- Baseie-se só no contexto fornecido; não invente conteúdo que não está no nome/legenda/vizinhança.
- Se o contexto for insuficiente ou ambíguo, use "Outro" com confiança "baixa".
- Marque a confiança: "alta" (nome/legenda deixam claro), "media" (contexto sugere), "baixa" (chute).
- O resumo deve explicar em UMA frase por que você classificou assim (ex.: "nome do arquivo 'historico_2024.pdf' e legenda 'segue o histórico do meu filho').`;
