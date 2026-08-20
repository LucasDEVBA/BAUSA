-- ════════════════════════════════════════════════════════════════════════
-- Migration: fluxos da Head de Sucesso — import do Trello "Bolsa Atleta USA"
-- Aplica em: public (escolas/onboarding_*/faq_artigos só existem em public;
--            o Engine lê public em todos os ambientes — mesmo padrão da
--            20260711071912_onboarding_checklist_admin.sql)
--
-- Fonte: export JSON do board Trello hzcXUHop (2026-08-20), operado pela
-- Head de Sucesso. Três frentes:
--   1. Seed do Banco de Escolas: 17 escolas (16 cards "High Schools" +
--      Life Prep Academy, presente só como etiqueta) com links de
--      inscrição, plano de saúde, portais e contatos.
--      ⚠️ Credenciais de famílias que existiam nos cards foram
--      deliberadamente EXCLUÍDAS — nunca entram no banco.
--   2. Template default de onboarding ganha as etapas do "Application
--      process checklist" do Trello (inscrição → docs → matrícula → I-20
--      → visto → plano de saúde → embarque), com sub-itens; backfill nas
--      instâncias em andamento (restrito às etapas novas).
--   3. FAQ: 5 artigos internos (Clarity, Scholaro, processo PSA,
--      universidades NCAA, planos BAUSA).
--
-- Idempotente: escolas casadas por nome, etapas por título, FAQ por título.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. Seed do Banco de Escolas ─────────────────────────────────────────
-- esportes_oferecidos fica VAZIO de propósito: array vazio = sem filtro no
-- calcular_match_score; preencher errado zeraria matches (achado da análise).
INSERT INTO public.escolas
  (nome, estado_us, cidade, tipo, status, website, notas_internas,
   testes_exigidos, nota_minima_duolingo,
   admissions_officer_nome, admissions_officer_email)
SELECT v.nome, v.estado_us, v.cidade, v.tipo, v.status, v.website,
       v.notas_internas, v.testes_exigidos, v.nota_minima_duolingo,
       v.ao_nome, v.ao_email
FROM (VALUES
  ('IMG Academy', 'FL', 'Bradenton', 'boarding', 'ativa',
   'https://www.imgacademy.com',
   'Inscrição (application): https://imgacademy.myschoolapp.com/app?svcid=edu#login/apply' || E'\n' ||
   'Financial aid via Clarity (ver FAQ "Clarity").' || E'\n' ||
   'Origem: Trello Head de Sucesso (2026-08).',
   '{}'::text[], NULL::int, NULL, NULL),

  ('DME Academy', 'FL', 'Daytona Beach', 'boarding', 'ativa',
   'https://www.dmeacademy.com',
   'Inscrição (FACTS/Renweb) — districtCode XDA-FL: https://admissions-parent.renweb.com/en-us/home?districtCode=XDA-FL' || E'\n' ||
   '(o link do Trello carrega sessão; se expirar, entrar pelo portal FACTS com o districtCode acima)' || E'\n' ||
   'Fluxo do Trello: Inscrição → Clarity → I-20 → Plano de saúde.' || E'\n' ||
   'Origem: Trello Head de Sucesso (2026-08).',
   '{}'::text[], NULL, NULL, NULL),

  ('Montverde Academy', 'FL', 'Montverde', 'mista', 'ativa',
   'https://www.montverde.org',
   'Inscrição: https://www.montverde.org/admission/application-process' || E'\n' ||
   'Portal do aluno (Veracross): https://accounts.veracross.com/mva/portals/login' || E'\n' ||
   'Duolingo mínimo: 105. Financial aid via Clarity.' || E'\n' ||
   'Origem: Trello Head de Sucesso (2026-08).',
   ARRAY['Duolingo'], 105, NULL, NULL),

  ('SPIRE Academy', 'OH', 'Geneva', 'boarding', 'ativa',
   'https://www.spireacademy.com',
   'Application (Veracross): https://portals.veracross.com/spire/form/spire-inquiry-form/2025-26%20Student%20Inquiry/account-lookup' || E'\n' ||
   'Guia do portal de admissões (vídeo): https://www.youtube.com/watch?v=103T1y5xAPo' || E'\n' ||
   'Need Based Grant (redução de tuition) via Clarity: https://app.clarityapp.com/sign-in — school code da SPIRE: 7893.' || E'\n' ||
   'Origem: Trello Head de Sucesso (2026-08).',
   '{}'::text[], NULL, NULL, NULL),

  ('Putnam Science Academy', 'CT', 'Putnam', 'boarding', 'ativa',
   'https://www.putnamscience.org',
   'Inscrição: https://putnamscienceacademy.fsenrollment.com/users/sign_up' || E'\n' ||
   'Etapa 1 exige também: Mini-MED Form + International SSS (financial) Form — passo a passo completo no FAQ "Putnam Science Academy".' || E'\n' ||
   'Envio Mini-MED/SSS: tloynd@putnamscience.org (cc fernanda.luiz@bolsaatletausa.com)' || E'\n' ||
   'Financeiro: David Fan — Dfan@putnamscience.org' || E'\n' ||
   'Pick-up no aeroporto: travel@putnamscience.org' || E'\n' ||
   'Plano de saúde (CIGNA/OGSE): https://cghb-ogse.com/index.php — o Student ID chega no e-mail @putnamscience.org do aluno.' || E'\n' ||
   'Origem: Trello Head de Sucesso (2026-08).',
   '{}'::text[], NULL, 'Admissions Office', 'admissions@putnamscience.org'),

  ('Hoosac School', 'NY', 'Hoosick', 'boarding', 'ativa',
   'https://www.hoosac.org',
   'Inscrição (OpenApply): https://hoosac.openapply.com' || E'\n' ||
   'Origem: Trello Head de Sucesso (2026-08).',
   '{}'::text[], NULL, NULL, NULL),

  ('St. Thomas More School', 'CT', 'Oakdale', 'boarding', 'ativa',
   'https://www.stmct.org',
   'Pagamentos (Diamond Mind): https://stmct.diamondmindinc.com/payment/home' || E'\n' ||
   'Origem: Trello Head de Sucesso (2026-08).',
   '{}'::text[], NULL, NULL, NULL),

  ('Baylor School', 'TN', 'Chattanooga', 'mista', 'ativa',
   'https://www.baylorschool.org',
   'Inscrição: https://baylorschool.fsenrollment.com/users/sign_in' || E'\n' ||
   'Financial aid via Clarity.' || E'\n' ||
   'Origem: Trello Head de Sucesso (2026-08).',
   '{}'::text[], NULL, NULL, NULL),

  ('Westtown School', 'PA', 'West Chester', 'mista', 'ativa',
   'https://www.westtown.edu',
   'Application via SAO (Standard Application Online): https://www.admission.org/services/standard-application-online-sao' || E'\n' ||
   'Portal (Blackbaud): https://westtown.myschoolapp.com' || E'\n' ||
   'Entrevista de admissão pode ser remota. Família usa App EMA + Clarity.' || E'\n' ||
   'Origem: Trello Head de Sucesso (2026-08).',
   '{}'::text[], NULL, NULL, NULL),

  ('Winston Salem Christian School', 'NC', 'Winston-Salem', 'mista', 'ativa',
   'https://www.wschristian.com',
   'Inscrição (FACTS/Renweb) — districtCode WS-NC: https://admissions-parent.renweb.com/en-us/home?districtCode=WS-NC' || E'\n' ||
   'FamilyPortal: wschristian.com → FamilyPortal → District Code WS-NC → Family Information → Enrollment/Reenrollment.' || E'\n' ||
   'Plano de saúde (Envisage): https://www.envisageglobalinsurance.com/self-enrollment/register/1205/' || E'\n' ||
   'Origem: Trello Head de Sucesso (2026-08).',
   '{}'::text[], NULL, NULL, NULL),

  ('Darrow School', 'NY', 'New Lebanon', 'boarding', 'ativa',
   'https://www.darrowschool.org',
   'Financial aid via Clarity.' || E'\n' ||
   'Origem: Trello Head de Sucesso (2026-08).',
   '{}'::text[], NULL, NULL, NULL),

  ('High Mowing School', 'NH', 'Wilton', 'boarding', 'ativa',
   'https://www.highmowing.org',
   'Origem: Trello Head de Sucesso (2026-08).',
   '{}'::text[], NULL, NULL, NULL),

  ('Benfica Academy', 'VA', 'Virginia Beach', 'boarding', 'ativa',
   'https://www.benficaresidentialacademy.com',
   'Inscrição (Bishop application): https://www.benficaresidentialacademy.com/bishop-application' || E'\n' ||
   'Financial aid via Clarity.' || E'\n' ||
   'Localização a confirmar (parceria com a Bishop Sullivan Catholic HS, Virginia Beach/VA).' || E'\n' ||
   'Origem: Trello Head de Sucesso (2026-08).',
   '{}'::text[], NULL, NULL, NULL),

  ('Combine Academy', 'NC', 'Lincolnton', 'boarding', 'ativa',
   'https://www.combineacademy.com',
   'Inscrição (formulário JotForm): https://www.jotform.com/form/83105120500941' || E'\n' ||
   'Origem: Trello Head de Sucesso (2026-08).',
   '{}'::text[], NULL, NULL, NULL),

  ('Gateway Academy', '--', 'A confirmar', 'boarding', 'ativa',
   NULL,
   'CONFIRMAR cidade/estado/site oficial com a Head.' || E'\n' ||
   'Inscrição (formulário Google): https://docs.google.com/forms/d/e/1FAIpQLSf_qpDZD32Ukeaov0RwiUTErj15UBjTGt27Mm6ivF5P_sC-Iw/viewform' || E'\n' ||
   'Plano de saúde: ISO — https://www.isoa.org' || E'\n' ||
   'Origem: Trello Head de Sucesso (2026-08).',
   '{}'::text[], NULL, NULL, NULL),

  ('RPS Academies', '--', 'A confirmar', 'boarding', 'ativa',
   NULL,
   'ATENÇÃO: a application NÃO salva progresso — preencher tudo de uma vez.' || E'\n' ||
   'Pagamento feito via Rush Soccer (contato: Thiago).' || E'\n' ||
   'Inscrição (PowerSchool): https://enrollment.powerschool.com/family/ActionForms/Index/1' || E'\n' ||
   'Docs para a application: passaporte, carteirinha de vacinação, certidão de nascimento ou RG, última página do handbook assinada, Medical Consent assinado.' || E'\n' ||
   'Exige Scholaro (avaliação do histórico escolar) + prova Duolingo.' || E'\n' ||
   'CONFIRMAR cidade/estado (campus) com a Head.' || E'\n' ||
   'Origem: Trello Head de Sucesso (2026-08).',
   ARRAY['Duolingo'], NULL, NULL, NULL),

  ('Life Prep Academy', 'KS', 'Wichita', 'boarding', 'ativa',
   NULL,
   'Cadastro criado a partir da etiqueta do Trello (atleta ativa na escola). Confirmar dados com a Head.' || E'\n' ||
   'Portal (FACTS): https://factsmgt.com' || E'\n' ||
   'Origem: Trello Head de Sucesso (2026-08).',
   '{}'::text[], NULL, NULL, NULL)
) AS v(nome, estado_us, cidade, tipo, status, website, notas_internas,
       testes_exigidos, nota_minima_duolingo, ao_nome, ao_email)
WHERE NOT EXISTS (
  SELECT 1 FROM public.escolas e
  WHERE lower(e.nome) = lower(v.nome) AND e.deleted_at IS NULL
);

-- ─── 2. Etapas de application no template default de onboarding ──────────
-- Espelha o "Application process checklist" do Trello (união das 2 variantes
-- de checklist + itens específicos de escola generalizados). Ordem continua
-- a partir do MAX atual (CEO pode ter editado o template pela UI).
DO $$
DECLARE
  v_template_id UUID;
  v_ordem INT;
  v_etapa JSONB;
BEGIN
  SELECT id INTO v_template_id
  FROM public.onboarding_templates
  WHERE is_default = TRUE AND deleted_at IS NULL
  LIMIT 1;

  IF v_template_id IS NULL THEN
    RAISE WARNING 'trello_head_sucesso: nenhum template de onboarding default — etapas de application não semeadas.';
    RETURN;
  END IF;

  SELECT COALESCE(MAX(ordem), 0) INTO v_ordem
  FROM public.onboarding_template_etapas
  WHERE template_id = v_template_id;

  FOR v_etapa IN SELECT * FROM jsonb_array_elements('[
    {
      "titulo": "Application — inscrição na escola",
      "descricao": "Criar a conta no portal de admissão da escola escolhida e enviar a application. Links e particularidades de cada escola estão no Banco de Escolas (/escolas).",
      "prazo_dias": 10,
      "requer_documentos": false,
      "checklist": [
        "Criar conta/login no portal de admissão da escola (link no Banco de Escolas)",
        "Garantir acesso da Head ao portal para acompanhar o processo",
        "Preencher e enviar a application",
        "Formulários extras da escola (ex.: Mini-MED e International SSS na PSA; Clarity onde exigido)"
      ]
    },
    {
      "titulo": "Application — documentos e testes",
      "descricao": "Reunir e enviar os documentos exigidos pela escola. Subir tudo na aba Documentos do atleta.",
      "prazo_dias": 21,
      "requer_documentos": true,
      "checklist": [
        "Histórico escolar (desde o 9º ano, quando exigido)",
        "Histórico escolar traduzido",
        "Histórico enviado à escola / avaliação Scholaro (quando exigida)",
        "Passaporte válido",
        "Certidão de nascimento ou RG",
        "Carteirinha de vacinação (traduzida)",
        "Formulários assinados (Medical Consent / Handbook, quando houver)",
        "Prova de inglês (Duolingo) feita — conferir a nota mínima da escola"
      ]
    },
    {
      "titulo": "Matrícula (pagamento)",
      "descricao": "Efetivar a matrícula na escola. O pagamento costuma ser pré-requisito para a emissão do I-20.",
      "prazo_dias": 30,
      "requer_documentos": false,
      "checklist": [
        "Alinhar valores e forma de pagamento com a família",
        "Pagamento da matrícula realizado",
        "Comprovante enviado à escola"
      ]
    },
    {
      "titulo": "I-20 — emissão e conferência",
      "descricao": "Acompanhar a emissão do I-20 pela escola e repassar à família.",
      "prazo_dias": 45,
      "requer_documentos": false,
      "checklist": [
        "Solicitar a emissão do I-20 à escola",
        "I-20 recebido e conferido (nome, SEVIS ID, escola)",
        "I-20 enviado à família"
      ]
    },
    {
      "titulo": "Visto F-1 — agendamento e entrevista",
      "descricao": "Conduzir a família no processo do visto de estudante.",
      "prazo_dias": 60,
      "requer_documentos": false,
      "checklist": [
        "Taxa SEVIS (I-901) paga",
        "DS-160 preenchido",
        "Entrevista do visto agendada",
        "Família preparada para a entrevista",
        "Entrevista realizada",
        "Visto aprovado"
      ]
    },
    {
      "titulo": "Plano de saúde",
      "descricao": "Contratar o plano de saúde exigido/aceito pela escola. Links por escola no Banco de Escolas.",
      "prazo_dias": 70,
      "requer_documentos": false,
      "checklist": [
        "Contratar o plano exigido/aceito pela escola (link no Banco de Escolas)",
        "Comprovante/carteirinha enviados à escola"
      ]
    },
    {
      "titulo": "Embarque — logística final",
      "descricao": "Fechar a logística de viagem e chegada do atleta.",
      "prazo_dias": 80,
      "requer_documentos": false,
      "checklist": [
        "Passagem aérea comprada",
        "Room & board configurado (quando aplicável)",
        "Pick-up no aeroporto combinado com a escola",
        "Itinerário enviado à escola e à família"
      ]
    }
  ]'::jsonb)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.onboarding_template_etapas
      WHERE template_id = v_template_id
        AND titulo = v_etapa->>'titulo'
    ) THEN
      v_ordem := v_ordem + 1;
      INSERT INTO public.onboarding_template_etapas
        (template_id, ordem, titulo, descricao, prazo_dias,
         requer_reuniao, requer_assuntos, requer_documentos, checklist)
      VALUES
        (v_template_id, v_ordem, v_etapa->>'titulo', v_etapa->>'descricao',
         (v_etapa->>'prazo_dias')::INT,
         FALSE, FALSE, COALESCE((v_etapa->>'requer_documentos')::BOOLEAN, FALSE),
         COALESCE(v_etapa->'checklist', '[]'::jsonb));
    END IF;
  END LOOP;
END $$;

-- ─── 2b. Backfill: instâncias em andamento ganham SÓ as etapas novas ─────
-- Restrito por título para não retroagir etapas que o CEO tenha criado na UI
-- depois do início de alguma família (snapshot por design não retroage).
INSERT INTO public.onboarding_etapa_estado
  (instancia_id, template_etapa_id, ordem, titulo, descricao, prazo,
   requer_reuniao, requer_assuntos, requer_documentos, checklist_estado)
SELECT i.id, te.id, te.ordem, te.titulo, te.descricao,
       NOW() + (te.prazo_dias || ' days')::INTERVAL,
       te.requer_reuniao, te.requer_assuntos, te.requer_documentos,
       (
         SELECT COALESCE(
           jsonb_agg(jsonb_build_object('item', x.value, 'concluido', FALSE, 'concluido_at', NULL)),
           '[]'::jsonb
         )
         FROM jsonb_array_elements_text(COALESCE(te.checklist, '[]'::jsonb)) AS x(value)
       )
FROM public.onboarding_instancias i
JOIN public.onboarding_template_etapas te
  ON te.template_id = i.template_id
WHERE i.status = 'em_andamento'
  AND i.deleted_at IS NULL
  AND te.titulo IN (
    'Application — inscrição na escola',
    'Application — documentos e testes',
    'Matrícula (pagamento)',
    'I-20 — emissão e conferência',
    'Visto F-1 — agendamento e entrevista',
    'Plano de saúde',
    'Embarque — logística final'
  )
ON CONFLICT (instancia_id, template_etapa_id) DO NOTHING;

-- ─── 3. FAQ: artigos internos vindos do Trello ───────────────────────────
INSERT INTO public.faq_artigos (titulo, categoria, conteudo, fases_aplicaveis)
SELECT v.titulo, v.categoria, v.conteudo, v.fases
FROM (VALUES
  ('Clarity — guia de preenchimento (financial aid)', 'financeiro',
   'O que é: plataforma de financial aid usada por várias escolas parceiras (IMG, Montverde, DME, Baylor, Darrow, Westtown, Benfica; na SPIRE é o Need Based Grant — school code 7893). Taxa: USD 65 por aplicação.' || E'\n' ||
   'Acesso: https://app.clarityapp.com/sign-in' || E'\n\n' ||
   'GUIA DE PREENCHIMENTO (EN → PT)' || E'\n\n' ||
   'RENDA' || E'\n' ||
   '• Total Taxable Salaries and Wages — total de salários e ordenados tributáveis' || E'\n' ||
   '• Dividend and Interest Income — rendimentos de dividendos e juros' || E'\n' ||
   '• Self Employment Income — rendimentos de trabalho autônomo' || E'\n' ||
   '• Capital Gains — ganhos de capital' || E'\n\n' ||
   'GASTOS MENSAIS APROXIMADOS' || E'\n' ||
   '• Utilities (primary residence) — contas de consumo da residência principal (água, luz, gás, internet)' || E'\n' ||
   '• Food and Clothing — alimentação e vestuário (supermercado, restaurantes, roupas da família)' || E'\n' ||
   '• Transportation — transporte (parcelas de veículos, combustível, transporte público, apps, seguro)' || E'\n' ||
   '• Health Insurance — plano de saúde (contribuições antes dos impostos; NÃO incluir coparticipação)' || E'\n' ||
   '• Out of Pocket Medical Expenses — despesas médicas diretas (franquias, coparticipações, medicamentos com receita)' || E'\n' ||
   '• Student Loan Payments — empréstimo estudantil' || E'\n' ||
   '• Post-tax Retirement Contributions — aposentadoria pós-imposto' || E'\n' ||
   '• Childcare / Daycare — creche (NÃO incluir mensalidade escolar)' || E'\n' ||
   '• Eldercare — cuidados com idosos' || E'\n' ||
   '• Charitable Contributions — doações' || E'\n' ||
   '• Union Dues — contribuições sindicais' || E'\n' ||
   '• Child Support — pensão alimentícia (filhos)' || E'\n' ||
   '• Spousal Support / Alimony — pensão alimentícia (cônjuge)' || E'\n\n' ||
   'MORADIA' || E'\n' ||
   '• What is the address of your primary residence? — endereço da residência principal' || E'\n' ||
   '• What year did you purchase this property? — ano de compra do imóvel' || E'\n' ||
   '• Current market value — valor de mercado atual (USD)' || E'\n' ||
   '• Balance of all mortgages — saldo devedor de hipotecas/financiamentos, incluindo home equity (USD)' || E'\n' ||
   '• Annual property taxes — impostos anuais do imóvel (ex.: IPTU)' || E'\n' ||
   '• Homeowner''s insurance premium — prêmio anual do seguro residencial' || E'\n\n' ||
   'AUTOMÓVEIS (Vehicle 1, 2…)' || E'\n' ||
   '• Own or lease — próprio ou leasing' || E'\n' ||
   '• Make / Model / Year — marca / modelo / ano' || E'\n' ||
   '• Monthly Leasing Expense — despesa mensal de leasing (USD)' || E'\n\n' ||
   'BENS E ATIVOS' || E'\n' ||
   '• Bank Accounts — contas bancárias (USD)' || E'\n' ||
   '• Retirement Accounts — contas de aposentadoria (USD)' || E'\n' ||
   '• Investment Accounts — investimentos (ações, títulos, cripto; NÃO incluir planos 529)' || E'\n' ||
   '• Other Assets — outros bens' || E'\n\n' ||
   'PASSIVOS E DÍVIDAS' || E'\n' ||
   '• Credit Cards — cartões de crédito (USD)' || E'\n' ||
   '• Student Loans — financiamento estudantil (USD)' || E'\n' ||
   '• Unpaid Medical Debt — dívidas médicas não pagas (USD)' || E'\n' ||
   '• Other Debts — outras dívidas' || E'\n\n' ||
   'EMPRESA (Business 1)' || E'\n' ||
   '• Business Name — razão social' || E'\n' ||
   '• What year was it started? — ano de início' || E'\n' ||
   '• Filing type — tipo societário: Partnership (sociedade), C Corporation (S.A.), S Corporation (pequeno porte), LLC - Schedule C, Sole Proprietorship (empresa individual)' || E'\n' ||
   '• What % do you own? — participação societária' || E'\n' ||
   '• 2025 Gross Profit / Net Income — lucro bruto / líquido (USD)' || E'\n' ||
   '• Value of Business Assets / Total Liabilities — ativos / passivos da empresa (USD)' || E'\n' ||
   '• Is this business still operating? — empresa em operação? (Yes/No)' || E'\n' ||
   '• Description — descrição' || E'\n\n' ||
   'Todos os valores em dólares americanos (USD). Fonte: Trello Head de Sucesso.',
   ARRAY['admissao']),

  ('Scholaro — avaliação do histórico escolar', 'documentacao',
   'Scholaro é a plataforma de avaliação/tradução de histórico escolar usada em applications — ex.: RPS Academies exige a avaliação do histórico via Scholaro antes de concluir a inscrição.' || E'\n\n' ||
   'Site: https://www.scholaro.com' || E'\n\n' ||
   'Fluxo típico:' || E'\n' ||
   '1. Coletar o histórico escolar completo (desde o 9º ano, quando exigido)' || E'\n' ||
   '2. Submeter na Scholaro para avaliação/tradução' || E'\n' ||
   '3. Enviar a avaliação à escola junto com a application' || E'\n\n' ||
   'Fonte: Trello Head de Sucesso.',
   ARRAY['admissao']),

  ('Putnam Science Academy — passo a passo do novo aluno', 'escola',
   'CONTATOS' || E'\n' ||
   '• Admissions: admissions@putnamscience.org' || E'\n' ||
   '• Financial Director (David Fan): Dfan@putnamscience.org' || E'\n' ||
   '• Pick-up no aeroporto: travel@putnamscience.org' || E'\n' ||
   '• Envio de Mini-MED e International SSS: tloynd@putnamscience.org (cc fernanda.luiz@bolsaatletausa.com)' || E'\n\n' ||
   '1º PASSO — INSCRIÇÃO' || E'\n' ||
   '1. Inscrever em https://putnamscienceacademy.fsenrollment.com/users/sign_up' || E'\n' ||
   '2. Após o e-mail de confirmação da PSA, seguir o passo a passo de criação do Portal do Aluno.' || E'\n' ||
   '3. Combinar com a família o acesso da Head ao portal para acompanhar o processo.' || E'\n\n' ||
   '2º PASSO — MINI-MED E INTERNATIONAL SSS' || E'\n\n' ||
   'MINI-MED (formulário médico básico):' || E'\n' ||
   '• Health Assessment Record: exame físico detalhado assinado pelo médico (altura, peso, visão, audição, saúde geral, avaliação odontológica e imunizações completas)' || E'\n' ||
   '• Carteira de vacinação completa e atualizada, traduzida para inglês, com assinatura do médico' || E'\n' ||
   '• Questionário de risco de tuberculose + teste obrigatório (PPD ou IGRA). Caso positivo: anexar raio-X do tórax e relatório médico traduzido confirmando ausência de doença ativa' || E'\n' ||
   '• Histórico médico relevante traduzido (doenças pré-existentes, tratamentos em andamento, alergias)' || E'\n\n' ||
   'INTERNATIONAL SSS (análise financeira para bolsa):' || E'\n' ||
   '• Declaração de Imposto de Renda completa e traduzida oficialmente' || E'\n' ||
   '• Comprovantes de renda dos últimos 3 meses traduzidos (extratos ou holerites)' || E'\n' ||
   '• Extratos bancários atuais traduzidos' || E'\n' ||
   '• Documentação de imóveis, bens ou investimentos traduzida (se aplicável)' || E'\n' ||
   '• Despesas familiares anuais detalhadas (moradia, educação, saúde etc.)' || E'\n' ||
   'Seções essenciais: A (dados do estudante), B (responsáveis financeiros), C (renda e despesas), Family Assets, Educational Expenses.' || E'\n' ||
   'Assinatura dos responsáveis financeiros obrigatória na última página (Statement of Truth).' || E'\n\n' ||
   'PLANO DE SAÚDE (CIGNA)' || E'\n' ||
   '• Inscrição: https://cghb-ogse.com/index.php' || E'\n' ||
   '• O Student ID e o link de inscrição chegam no e-mail do aluno @putnamscience.org (adicionar essa conta no Gmail).' || E'\n' ||
   '• Suporte: OGSEQuestions@cignahealthcare.com' || E'\n\n' ||
   'Modelo de e-mail (Student ID não chegou):' || E'\n' ||
   '"Hello! My name is XXX and I am having problems enrolling in the health plan because I do not receive my Student ID to finish enrollment. I have followed all the steps in the email below already, have checked spam files etc., and nothing. Am I missing something? Thank you for your support! XXX — Putnam Science Academy student."' || E'\n\n' ||
   'Fonte: Trello Head de Sucesso.',
   ARRAY['admissao','aprovado']),

  ('Universidades alvo — NCAA D1/D2/D3', 'escola',
   'Lista de universidades mapeadas pela Head de Sucesso (Trello, card "NCAA D2 e D3 nível bom").' || E'\n\n' ||
   'NCAA D1' || E'\n' ||
   '• Xavier University' || E'\n' ||
   '• University of Illinois Chicago' || E'\n' ||
   '• Southern Methodist University' || E'\n' ||
   '• Florida Gulf Coast University' || E'\n\n' ||
   'NCAA D2' || E'\n' ||
   '• West Chester University of Pennsylvania' || E'\n' ||
   '• Grand Valley State University' || E'\n' ||
   '• Truman State University' || E'\n' ||
   '• Harding University' || E'\n' ||
   '• Maryville University' || E'\n' ||
   '• University of Minnesota – Duluth' || E'\n' ||
   '• Western Washington University' || E'\n' ||
   '• Slippery Rock University' || E'\n' ||
   '• University of Alabama – Huntsville' || E'\n' ||
   '• Ashland University' || E'\n' ||
   '• North Greenville University' || E'\n' ||
   '• Winona State University' || E'\n' ||
   '• Louisiana State University at Alexandria' || E'\n' ||
   '• Louisiana Christian University' || E'\n' ||
   '• Colorado Mesa University' || E'\n\n' ||
   'NCAA D3 (top ranked em futebol feminino)' || E'\n' ||
   '• Illinois Institute of Technology (excelente para STEM majors)' || E'\n' ||
   '• Christopher Newport University' || E'\n' ||
   '• Rowan University (boa para STEM majors)' || E'\n' ||
   '• Tufts University (top US University, muito competitiva academicamente — SAT 1400+ e GPA 3.8+; excelente para STEM majors)' || E'\n' ||
   '• University of Wisconsin – La Crosse',
   '{}'::text[]),

  ('Planos BAUSA — Start, Journey e Legacy', 'outros',
   'Resumo dos planos (fonte: Trello Head de Sucesso):' || E'\n\n' ||
   '• Start: embarque' || E'\n' ||
   '• Journey: acompanhamento' || E'\n' ||
   '• Legacy: acompanhamento + college placement',
   '{}'::text[])
) AS v(titulo, categoria, conteudo, fases)
WHERE NOT EXISTS (
  SELECT 1 FROM public.faq_artigos f WHERE f.titulo = v.titulo
);
