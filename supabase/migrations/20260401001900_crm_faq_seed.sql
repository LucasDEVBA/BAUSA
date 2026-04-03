-- ============================================================
-- CRM Bolsa Atleta USA — Seed: FAQ artigos iniciais
-- 10 artigos informativos para a base de conhecimento.
-- ============================================================

INSERT INTO public.faq_artigos (titulo, categoria, conteudo, fases_aplicaveis) VALUES

('Como funciona o visto F-1 para estudantes?', 'visto',
'O visto F-1 é o visto de estudante mais comum para quem vai estudar nos Estados Unidos. Ele permite que o aluno estude em tempo integral em uma instituição acadêmica credenciada.

Para obtê-lo, o atleta precisa primeiro ser aceito por uma escola americana que emitirá o formulário I-20, documento essencial para a solicitação do visto. Com o I-20 em mãos, o próximo passo é pagar a taxa SEVIS e agendar a entrevista no consulado americano.

A entrevista costuma durar de 3 a 5 minutos. O oficial consular verificará a intenção genuína de estudo, capacidade financeira da família e vínculos com o Brasil. É importante levar toda a documentação organizada.

O visto F-1 permite que o estudante permaneça nos EUA durante todo o período do programa acadêmico, com possibilidade de renovação se continuar estudando.',
ARRAY['admissao', 'pre_embarque']),

('Quais documentos são necessários para o consulado?', 'visto',
'Para a entrevista no consulado americano, você precisará dos seguintes documentos:

**Obrigatórios:**
- Passaporte válido (validade mínima de 6 meses além da data de viagem)
- Formulário I-20 emitido pela escola
- Comprovante de pagamento da taxa SEVIS (I-901)
- Formulário DS-160 confirmado
- Foto recente no padrão americano

**Complementares (recomendados):**
- Comprovante de renda dos responsáveis
- Declaração de imposto de renda
- Extratos bancários dos últimos 3 meses
- Carta da escola confirmando a matrícula e bolsa (se aplicável)
- Histórico escolar traduzido
- Carta de motivação do aluno',
ARRAY['admissao', 'pre_embarque']),

('Checklist de documentos para aplicação na escola', 'documentacao',
'Cada escola pode ter requisitos específicos, mas a maioria das boarding schools americanas solicita:

1. **Histórico escolar traduzido** — Tradução juramentada do boletim dos últimos 2-3 anos
2. **Passaporte válido** — Cópia da página principal
3. **Vídeo highlights** — Para atletas, vídeo de 3-5 minutos com melhores momentos
4. **Cartas de recomendação** — Geralmente 1-3 cartas (professor, treinador, diretor)
5. **Resultados de testes** — Duolingo, TOEFL, SSAT ou PSAT conforme exigência da escola
6. **Formulário de aplicação** — Preenchido online no site da escola
7. **Essay/Redação** — Tema definido pela escola
8. **Certidão de vacinação** — Com tradução

Comece a preparar esses documentos assim que definir as escolas-alvo. Alguns itens como tradução juramentada podem levar 2-3 semanas.',
ARRAY['admissao']),

('O que levar na mala? Lista completa', 'embarque',
'A mala para boarding school deve ser prática. A maioria das escolas tem lavanderia disponível.

**Essencial:**
- Documentos (passaporte, I-20, cópias, cartão de vacina)
- Remédios de uso contínuo com receita em inglês
- Adaptador de tomada (EUA usa tipo A/B)
- Roupas para 7-10 dias (lavar semanalmente)
- Uniforme escolar (se exigido — a escola informará)
- Material escolar básico (notebook/laptop é essencial)
- Itens de higiene pessoal

**Para o esporte:**
- Equipamento específico do esporte (consultar o coach)
- Tênis adequado para a modalidade
- Protetor bucal (obrigatório em alguns esportes)

**Dicas:**
- Não leve excesso de roupas — nos EUA é fácil e barato comprar
- Leve um cobertor ou travesseiro de casa (ajuda na adaptação)
- Fotos da família e objetos pessoais significativos',
ARRAY['pre_embarque']),

('Como funciona o seguro saúde nos EUA?', 'embarque',
'O seguro saúde é obrigatório para estudantes internacionais nos EUA. A maioria das boarding schools oferece um plano de seguro escolar incluído ou como taxa adicional.

**O que geralmente cobre:**
- Consultas médicas
- Emergências
- Hospitalização
- Medicamentos prescritos
- Exames e laboratório

**O que geralmente NÃO cobre:**
- Tratamento dentário (exceto emergência)
- Óculos/lentes
- Condições pré-existentes (varia por plano)

É importante verificar com a escola qual plano será utilizado e se é possível usar o seguro da família como complemento. Em caso de emergência, os hospitais americanos atendem primeiro e cobram depois — o seguro cobre a maior parte dos custos.

Recomendamos que a família mantenha uma reserva de emergência de USD 1.000-2.000 para despesas médicas não cobertas.',
ARRAY['pre_embarque']),

('Primeiras semanas: o que esperar?', 'adaptacao',
'As primeiras 2-4 semanas são o período mais desafiador da experiência. É completamente normal sentir:

**Semana 1:** Empolgação e curiosidade. Tudo é novo e interessante. O atleta está motivado.

**Semanas 2-3:** A saudade começa a aparecer. A rotina escolar exige mais do que esperava. O idioma cansa. É aqui que muitos atletas passam por um momento difícil.

**Semana 4:** A adaptação começa a acontecer. O atleta faz amizades, entende a rotina e se sente mais confortável.

**O que ajuda:**
- Manter contato regular com a família (mas não excessivo — 1 ligação por dia no máximo)
- Participar de atividades sociais da escola
- Fazer amizade com colegas de quarto e do time
- Manter a rotina de treinos

**Alerta para os pais:** A tentação de ligar toda hora é grande, mas pode atrapalhar a adaptação. Confie no processo e no suporte da escola.',
ARRAY['embarcado_inicial']),

('Saudade de casa: como os pais podem ajudar?', 'adaptacao',
'A saudade de casa (homesickness) é uma das maiores preocupações das famílias. Aqui estão estratégias comprovadas:

**Para os pais:**
- Mantenha um horário fixo para ligações (ex: domingo à noite)
- Evite ligar nos momentos de atividade do atleta
- Seja positivo e encorajador — se você demonstrar ansiedade, o filho sentirá
- Envie pacotes ocasionais com itens de casa (comida, fotos)
- Confie na equipe da escola

**Para o atleta:**
- Decore o quarto com fotos e objetos de casa
- Mantenha uma rotina diária consistente
- Envolva-se em atividades extracurriculares
- Faça amigos — a socialização é o melhor remédio
- Escreva um diário (ajuda a processar emoções)

**Quando se preocupar:**
- Isolamento social prolongado (mais de 2 semanas)
- Queda drástica no rendimento acadêmico ou esportivo
- Recusa em participar de atividades
- Choro frequente após o primeiro mês

Nesses casos, a escola geralmente tem counselors especializados e nós acionamos a psicóloga intercultural.',
ARRAY['embarcado_inicial', 'acompanhamento']),

('Como funcionam os custos adicionais na escola?', 'financeiro',
'Além do valor da tuition (mensalidade), existem custos adicionais que a família deve considerar:

**Inclusos na maioria dos planos:**
- Hospedagem (dormitório)
- Alimentação (3 refeições)
- Material escolar básico
- Uso das instalações esportivas
- Lavanderia

**Custos adicionais comuns:**
- Livros didáticos: USD 200-500/ano
- Uniforme escolar: USD 200-400
- Gastos pessoais do aluno: USD 100-200/mês
- Viagens de férias (passagem aérea): 2-3x/ano
- Eventos sociais e passeios da escola: USD 50-200/evento
- Equipamento esportivo especializado: variável

**Dica:** A maioria das escolas oferece um cartão de gastos onde a família deposita um valor mensal para despesas pessoais do aluno. Recomendamos USD 150-250/mês como valor confortável.',
ARRAY['admissao', 'pre_embarque']),

('Como funciona o sistema de notas americano (GPA)?', 'escola',
'O sistema de notas americano é diferente do brasileiro. Entender o GPA é essencial:

**Escala de notas:**
- A = 4.0 (Excelente) — equivale a 9-10 no Brasil
- B = 3.0 (Bom) — equivale a 7-8.9
- C = 2.0 (Regular) — equivale a 5-6.9
- D = 1.0 (Abaixo do esperado) — equivale a 3-4.9
- F = 0.0 (Reprovado) — abaixo de 3

**GPA (Grade Point Average):**
É a média ponderada de todas as notas. Um GPA de 3.0 é considerado bom, 3.5+ é excelente.

Para bolsas esportivas universitárias (NCAA), o GPA mínimo é geralmente 2.3-2.5, mas escolas competitivas exigem 3.0+.

**Dica importante:** O atleta deve manter o GPA alto desde o início. Recuperar notas baixas é muito mais difícil no sistema americano do que no brasileiro, pois o GPA é acumulativo ao longo de todos os anos.',
ARRAY['admissao', 'embarcado_inicial']),

('Vacinas obrigatórias para boarding schools', 'saude',
'Os EUA exigem vacinação completa para todos os estudantes. As vacinas obrigatórias variam por estado, mas as mais comuns são:

**Geralmente obrigatórias:**
- MMR (Sarampo, Caxumba, Rubéola) — 2 doses
- Poliomielite (IPV) — série completa
- DTP/DTaP (Difteria, Tétano, Coqueluche) — com reforço Tdap
- Hepatite B — série completa (3 doses)
- Varicela (Catapora) — 2 doses ou histórico documentado
- Meningite (MCV4) — geralmente 1-2 doses

**Frequentemente exigidas:**
- Hepatite A — 2 doses
- HPV — recomendada (não obrigatória em todos os estados)
- Gripe (influenza) — anual, muitas escolas exigem

**Importante:**
- Leve a caderneta de vacinação TRADUZIDA para inglês
- Vacinas tomadas no Brasil são aceitas, desde que documentadas
- A escola pode exigir teste de tuberculose (PPD ou IGRA)
- Verifique os requisitos específicos do estado da escola

Recomendamos verificar a vacinação com pelo menos 3 meses de antecedência, pois algumas vacinas requerem múltiplas doses com intervalo.',
ARRAY['pre_embarque'])

ON CONFLICT DO NOTHING;
