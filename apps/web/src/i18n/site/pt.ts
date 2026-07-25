/**
 * Copy oficial do site institucional — documento BAU-01.
 *
 * FONTE DA VERDADE do texto. Alterações aqui são mudanças de posicionamento
 * de marca, não ajustes de UI.
 *
 * ── Regras de tom (inegociáveis, BAU-01) ──────────────────────────────────
 * · A BAU não é agência de intercâmbio. PROIBIDO: "pacote", "vaga",
 *   "programa de intercâmbio", "promoção", "garantia de bolsa",
 *   "últimas vagas", "oportunidade imperdível", "barato", "desconto".
 * · Futebol é a ferramenta. Educação é a fundação. Formação humana é o centro.
 * · Exclusividade por critério e seleção — nunca por escassez artificial.
 * · O CTA primário se chama "Iniciar avaliação estratégica" em todo o site,
 *   sem variação. (O guard `scripts/check-site-copy.mjs` bloqueia o build se
 *   uma palavra proibida ou uma variação do CTA aparecer aqui.)
 *
 * Este módulo é deliberadamente separado de `translations/`: aquele tipo
 * (`DeepStringify`) só aceita strings e é importado nos três idiomas dentro de
 * um Client Component, viajando em toda rota. Aqui há arrays e objetos, e o
 * consumo é via `getTranslations` do next-intl — Server Components, zero JS.
 */
export const sitePt = {
  // ── Global ───────────────────────────────────────────────────────────────
  brand: {
    name: "Bolsa Atleta USA",
    concept: "Educação Esportiva Inteligente®",
    method: "Método S.A.F.E.®",
    tagline: "Do talento ao ser humano excepcional.",
    email: "contato@bolsaatletausa.com",
    instagram: "@bolsaatletausa",
    instagramUrl: "https://instagram.com/bolsaatletausa",
    copyright: "© 2026 Bolsa Atleta USA. Todos os direitos reservados.",
  },

  /** Assinaturas de marca — rotacionar em fechos de página. Sempre em itálico. */
  signatures: {
    path: "Para quem entende o valor do caminho.",
    human: "Do talento ao ser humano excepcional.",
    integrated: "Nada é isolado. Tudo é integrado.",
  },

  cta: {
    /** Texto único do CTA primário em TODO o site. Nunca criar variação. */
    primary: "Iniciar avaliação estratégica",
    watchTestimonial: "Assistir ao depoimento de",
  },

  nav: {
    home: "Início",
    concept: "O Conceito",
    method: "O Método",
    journey: "A Jornada",
    boarding: "Vida na Boarding",
    stories: "Histórias",
    founder: "O Fundador",
    menu: "Menu",
    close: "Fechar",
    openMenu: "Abrir menu de navegação",
  },

  footer: {
    navLabel: "Navegação",
    contactLabel: "Contato",
  },

  // ── Página 1 — Home ──────────────────────────────────────────────────────
  home: {
    hero: {
      eyebrow: "ACOMPANHAMENTO ATIVO EM CADA ETAPA",
      title: "Educação Esportiva Inteligente®",
      /** Quebra editorial do H1 para a revelação mascarada linha a linha. */
      titleLines: ["Educação Esportiva", "Inteligente®"],
      sub: "Projetos de vida guiados da High School à universidade — com critério, estratégia e visão de longo prazo, dentro do sistema educacional esportivo dos Estados Unidos.",
      secondaryCta: "Conhecer o conceito",
      imageAlt: "Campus universitário americano ao amanhecer",
    },
    repositioning: {
      eyebrow: "POR QUE EXISTIMOS",
      title: "Não somos uma agência de intercâmbio.",
      body: "Agências vendem vagas. Nós construímos projetos de vida. Cada família que chega até aqui não está procurando uma escola — está procurando o caminho certo para o futuro do filho. É exatamente isso que estruturamos: com método, presença e responsabilidade.",
      link: "Entenda a diferença",
    },
    institutions: {
      eyebrow: "ECOSSISTEMA INSTITUCIONAL",
      title: "Acesso às instituições mais respeitadas do mundo",
      partnersLabel: "Escolas parceiras",
      universitiesLabel: "Universidades do ecossistema de recrutamento",
      // Rótulo neutro de propósito: entrega densidade de prova sem alegar
      // parceria onde a relação não foi confirmada.
      ecosystemLabel: "Instituições do ecossistema",
    },
    pillars: {
      title: "Um projeto. Três certezas.",
      cards: [
        {
          eyebrow: "O CONCEITO",
          title: "Educação Esportiva Inteligente®",
          description:
            "O modelo exclusivo que integra educação, esporte e formação humana em decisões bem orientadas.",
          href: "/educacao-esportiva-inteligente",
          link: "Conhecer o conceito",
        },
        {
          eyebrow: "O MÉTODO",
          title: "Método S.A.F.E.®",
          description:
            "Estrutura cada decisão a partir de quatro pilares: Singularidade, Acadêmico, Financeiro e Esporte.",
          href: "/metodo-safe",
          link: "Ver como funciona",
        },
        {
          eyebrow: "A JORNADA",
          title: "Da leitura à universidade",
          description:
            "Da leitura estratégica da família à universidade americana: cada etapa acompanhada de perto, sem improviso.",
          href: "/jornada",
          link: "Ver a jornada completa",
        },
      ],
    },
    proof: {
      eyebrow: "DEPOIMENTOS DE ATLETAS",
      title: "Os novos líderes globais estão sendo formados aqui.",
      sub: "Não guiamos apenas atletas. Formamos protagonistas preparados para liderar o próprio destino.",
      link: "Ver todas as histórias",
    },
    safety: {
      eyebrow: "PARA AS FAMÍLIAS",
      title: "“E o meu filho — como vai viver lá?”",
      body: "Rotina, moradia, alimentação, supervisão, saúde e comunicação com a família. Preparamos uma página inteira para responder, com detalhe e verdade, a pergunta que mais importa.",
      link: "Conhecer a vida na boarding school",
    },
    founder: {
      eyebrow: "AUTORIDADE",
      title: "Guiado por quem viveu o sistema por dentro.",
      body: "Leandro Ribeiro foi estudante-atleta bolsista integral nos Estados Unidos antes de conduzir famílias pelo mesmo caminho — agora com método, equipe multidisciplinar e relacionamento institucional direto com escolas e universidades.",
      link: "Conhecer o fundador",
    },
    finalCta: {
      eyebrow: "EDUCAÇÃO ESPORTIVA INTELIGENTE®",
      title: "Para quem entende o valor do caminho.",
      body: "Atuamos com número limitado de famílias por ciclo. A primeira etapa é uma avaliação estratégica — criteriosa, individual e sem compromisso.",
    },
  },

  // ── Página 2 — O Conceito ────────────────────────────────────────────────
  concept: {
    hero: {
      titleLine1: "Existe um caminho entre o talento e o futuro.",
      titleLine2: "Poucos conhecem. Menos ainda sabem percorrer.",
      sub: "A Educação Esportiva Inteligente® é o modelo exclusivo da Bolsa Atleta USA que transforma o futebol em ferramenta de acesso — e a educação em fundação de um projeto de vida.",
    },
    problem: {
      eyebrow: "O PROBLEMA",
      title: "O erro mais caro não é escolher a escola errada. É escolher sem critério.",
      paragraphs: [
        "Todos os anos, famílias brasileiras enviam seus filhos aos Estados Unidos guiadas por promessas: a escola mais famosa, a maior bolsa, o vídeo mais bonito.",
        "E todos os anos, jovens talentosos voltam antes do tempo — não por falta de futebol, mas por falta de projeto. Escola errada para o perfil. Ambiente errado para a idade. Expectativa errada para a realidade.",
        "O sistema americano não perdoa improviso. Ele recompensa estratégia.",
      ],
    },
    definition: {
      eyebrow: "A DEFINIÇÃO",
      title:
        "Educação Esportiva Inteligente® é decidir com critério o que a maioria decide por impulso.",
      paragraphs: [
        "É um modelo de formação humana guiada que organiza escolhas acadêmicas, esportivas, financeiras e institucionais dentro de uma única lógica: o desenvolvimento completo do jovem.",
        "Na prática, significa que nenhuma decisão — escola, cidade, técnico, calendário, universidade — acontece isolada. Tudo é integrado. Tudo serve ao projeto.",
      ],
    },
    foundations: {
      eyebrow: "OS TRÊS FUNDAMENTOS",
      items: [
        {
          title: "Futebol é a ferramenta.",
          description:
            "Abre portas que notas sozinhas não abrem. Mas ferramenta sem direção não constrói nada.",
        },
        {
          title: "Educação é a fundação.",
          description:
            "É o que permanece quando a carreira esportiva encontra seus limites — e ela sempre encontra.",
        },
        {
          title: "Formação humana é o centro.",
          description:
            "Formamos jovens capazes de liderar o próprio destino. Esse é o resultado que nenhum ranking mede.",
        },
      ],
    },
    pause: "Futebol é a ferramenta. Educação é a fundação. Formação humana é o centro.",
    contrast: {
      eyebrow: "O CONTRASTE",
      title: "O que o mercado oferece. O que nós construímos.",
      marketLabel: "O mercado",
      bauLabel: "Educação Esportiva Inteligente®",
      caption:
        "Comparação entre o que o mercado oferece e o que a Bolsa Atleta USA constrói",
      rows: [
        { market: "Vagas e pacotes", bau: "Projetos de vida individuais" },
        { market: "A escola mais famosa", bau: "A escola certa para o perfil" },
        { market: "A maior bolsa", bau: "A melhor decisão de longo prazo" },
        { market: "Promessas esportivas", bau: "Estratégia acadêmico-atlética" },
        { market: "Envio e despedida", bau: "Acompanhamento ativo em cada etapa" },
      ],
    },
    belonging: {
      eyebrow: "FILTRO DE PERTENCIMENTO",
      title: "Não é para todos. E isso é proposital.",
      paragraphs: [
        "A Educação Esportiva Inteligente® é destinada a famílias que valorizam critério, presença e visão de longo prazo — e que entendem que o futuro de um filho não se decide por impulso.",
        "Se a sua família pensa assim, vocês já pertencem a este caminho. O próximo passo é descobrir se ele faz sentido para o momento do seu filho.",
      ],
    },
  },

  // ── Página 3 — O Método ──────────────────────────────────────────────────
  method: {
    hero: {
      eyebrow: "O MÉTODO",
      title: "Critério antes da escolha.",
      sub: "O Método S.A.F.E.® é a estrutura de decisão por trás de cada projeto da Bolsa Atleta USA. Quatro pilares. Uma leitura completa. Nenhum improviso.",
    },
    why: {
      eyebrow: "POR QUE MÉTODO IMPORTA",
      title: "Decisões desse tamanho não podem depender de opinião.",
      body: "Escolher onde um adolescente vai estudar, morar, treinar e crescer do outro lado do mundo é uma das decisões mais importantes que uma família toma. O Método S.A.F.E.® existe para que essa decisão seja tomada com a mesma seriedade com que merece ser vivida.",
    },
    pillars: {
      eyebrow: "OS QUATRO PILARES",
      items: [
        {
          initial: "S",
          title: "Singularidade",
          description:
            "Todo projeto começa pela família, não pela escola. Valores, expectativas, maturidade do jovem, momento de vida, visão de futuro. É a Singularidade que impede o erro mais comum do mercado: colocar o atleta certo no lugar errado.",
        },
        {
          initial: "A",
          title: "Acadêmico",
          description:
            "Nível de inglês, histórico escolar, perfil de aprendizagem e ambição universitária. O pilar acadêmico define quais portas estarão abertas daqui a quatro anos — e o que precisa ser construído desde já para abri-las.",
        },
        {
          initial: "F",
          title: "Financeiro",
          description:
            "Viabilidade, previsibilidade e coerência do investimento. Um projeto de vida não pode ser uma aposta: a família precisa enxergar o caminho financeiro completo, do primeiro ano de High School à graduação.",
        },
        {
          initial: "E",
          title: "Esporte",
          description:
            "Sonho esportivo com leitura realista: nível atual, potencial de desenvolvimento, ambiente adequado e visibilidade legítima dentro do sistema universitário americano. Sem promessas — posicionamento.",
        },
      ],
    },
    flow: {
      eyebrow: "O MÉTODO EM MOVIMENTO",
      title: "Da leitura à decisão.",
      steps: [
        {
          label: "01",
          title: "Leitura estratégica",
          description: "Avaliação completa do jovem e da família nos quatro pilares.",
        },
        {
          label: "02",
          title: "Desenho do projeto",
          description:
            "Cenários reais de escolas e caminhos, com prós, contras e coerência de longo prazo.",
        },
        {
          label: "03",
          title: "Decisão orientada",
          description: "A família decide com clareza; nós conduzimos a execução.",
        },
        {
          label: "04",
          title: "Acompanhamento ativo",
          description:
            "O método não termina na matrícula. Ele acompanha cada etapa até a universidade.",
        },
      ],
    },
    finalCta: {
      title: "Todo grande projeto começa com uma boa leitura.",
    },
  },

  // ── Página 4 — A Jornada ─────────────────────────────────────────────────
  journey: {
    hero: {
      eyebrow: "A JORNADA",
      title: "Um caminho de anos. Nenhuma etapa sozinha.",
      sub: "Da primeira conversa à universidade americana, cada fase do projeto tem estratégia, responsável e acompanhamento ativo. Esta é a jornada completa.",
    },
    timeline: {
      eyebrow: "AS SEIS FASES",
      phases: [
        {
          label: "Fase 1",
          title: "Avaliação Estratégica",
          description:
            "Leitura completa da família e do jovem pelo Método S.A.F.E.®. É aqui que descobrimos se o projeto faz sentido — e qual projeto faz sentido.",
        },
        {
          label: "Fase 2",
          title: "Estratégia & Posicionamento",
          description:
            "Construção do perfil acadêmico-atlético: documentação, materiais de apresentação, posicionamento institucional e definição das escolas-alvo certas para o perfil.",
        },
        {
          label: "Fase 3",
          title: "Colocação Estratégica",
          description:
            "Comunicação direta com admissões e treinadores, entrevistas, propostas e decisão final — sempre com a família no centro e a coerência de longo prazo como critério.",
        },
        {
          label: "Fase 4",
          title: "Preparação & Transição",
          description:
            "Visto, documentação, preparação emocional e alinhamento de expectativas. A família embarca sabendo exatamente o que esperar.",
        },
        {
          label: "Fase 5",
          title: "Vida na High School",
          description:
            "Acompanhamento contínuo: desempenho acadêmico, evolução esportiva, adaptação, comunicação com a escola e com a família. Presença ativa — não relatório trimestral.",
        },
        {
          label: "Fase 6",
          title: "Recrutamento Universitário",
          description:
            "Construção da visibilidade certa no momento certo: histórico acadêmico competitivo, exposição legítima, comunicação com treinadores universitários e estratégia de admissão.",
        },
      ],
    },
    stat: {
      eyebrow: "O DADO QUE MUDA TUDO",
      value: "96%",
      description:
        "das bolsas universitárias nos Estados Unidos são concedidas somente após avaliação presencial do atleta pelo treinador.",
      body: "Por isso a High School não é uma etapa intermediária — é o ambiente onde o futuro universitário é construído. Estar no lugar certo, no calendário certo, diante dos olhos certos: isso não acontece por acaso. Acontece por estratégia.",
    },
    highSchool: {
      eyebrow: "ONDE ACONTECE",
      title: "Onde a Educação Esportiva Inteligente® acontece.",
      items: [
        {
          title: "Formação Acadêmica Sólida",
          description:
            "Histórico acadêmico competitivo (GPA estratégico), preparação estruturada para o SAT e inserção em High Schools reconhecidas pelas universidades de elite.",
        },
        {
          title: "Desenvolvimento Esportivo",
          description:
            "Adaptação ao padrão de jogo americano, programas com estrutura validada pelo meio NCAA e acesso a algumas das estruturas de desenvolvimento mais avançadas do mundo.",
        },
        {
          title: "Adaptação Real",
          description:
            "Imersão completa no sistema educacional americano e histórico validado dentro do ambiente que as universidades reconhecem.",
        },
        {
          title: "Visibilidade Qualificada",
          description:
            "Inserção direta no ambiente onde treinadores universitários tomam decisões e presença em competições observadas pelo meio universitário.",
        },
      ],
    },
    finalCta: {
      title: "A jornada é longa. A primeira etapa leva 30 minutos.",
    },
  },

  // ── Página 5 — Vida na Boarding ──────────────────────────────────────────
  boarding: {
    hero: {
      eyebrow: "PARA QUEM MAIS AMA",
      title: "A pergunta que toda mãe faz antes de qualquer outra: “Como o meu filho vai viver lá?”",
      sub: "Esta página existe para responder — com verdade, detalhe e a segurança que a sua família merece.",
    },
    routine: {
      eyebrow: "A ROTINA REAL",
      title: "Um dia na vida de um estudante-atleta",
      timeLabel: "Horário",
      momentLabel: "Momento",
      caption: "Rotina típica de um dia letivo em uma boarding school americana",
      rows: [
        { time: "7h", moment: "Café da manhã no refeitório do campus" },
        { time: "8h–15h", moment: "Aulas em turmas reduzidas, com acompanhamento acadêmico próximo" },
        { time: "15h30–18h", moment: "Treino com comissão técnica profissional" },
        { time: "19h", moment: "Jantar" },
        { time: "19h30–21h30", moment: "Study hall supervisionado" },
        { time: "22h30", moment: "Recolhimento, com supervisão de dorm parents" },
      ],
      closing: "Estrutura, disciplina e cuidado — todos os dias, sem exceção.",
      note: "Os horários variam por escola. Esta é a rotina típica.",
    },
    safeties: {
      eyebrow: "AS CINCO SEGURANÇAS",
      title: "Cinco perguntas. Cinco respostas diretas.",
      items: [
        {
          title: "Moradia",
          description:
            "Dormitórios dentro do campus, com adultos residentes (dorm parents) responsáveis pelo bem-estar de cada aluno.",
        },
        {
          title: "Alimentação",
          description:
            "Refeitórios com nutrição planejada para atletas em desenvolvimento, incluindo adaptações e restrições alimentares.",
        },
        {
          title: "Saúde",
          description:
            "Enfermaria no campus, protocolos médicos claros, seguro-saúde e comunicação imediata com a família em qualquer ocorrência.",
        },
        {
          title: "Supervisão",
          description:
            "Advisors acadêmicos, técnicos, dorm parents e a equipe da BAU: uma rede de adultos que conhece seu filho pelo nome.",
        },
        {
          title: "Comunicação",
          description:
            "Rotinas de contato com a família, atualizações da BAU e canal direto conosco, em qualquer fuso, para qualquer assunto.",
        },
      ],
    },
    afterBoarding: {
      eyebrow: "DEPOIS DO EMBARQUE",
      title: "Nós não desembarcamos quando o avião decola.",
      paragraphs: [
        "O acompanhamento ativo da Bolsa Atleta USA continua durante toda a High School: contato com a escola, leitura do desempenho acadêmico e esportivo, apoio na adaptação e presença constante junto à família.",
        "Nossa Coordenação de Sucesso e Experiência da Família existe exatamente para isso: garantir que vocês nunca estejam sozinhos nessa jornada. Nem ele. Nem vocês.",
      ],
    },
    mothers: {
      eyebrow: "VOZ DAS MÃES",
      title: "Quem já viveu essa distância — e viu o filho crescer com ela.",
    },
    finalCta: {
      title: "Distância com acompanhamento não é ausência. É crescimento.",
      body: "Converse conosco e entenda como funciona o cuidado em cada etapa.",
    },
  },

  // ── Página 6 — Histórias ─────────────────────────────────────────────────
  stories: {
    hero: {
      eyebrow: "HISTÓRIAS",
      title: "Cada história começou com uma família diante de uma decisão.",
      sub: "Estas são as jornadas de quem escolheu critério — e hoje vive o resultado.",
    },
    actLabels: {
      decision: "A decisão",
      reading: "A leitura",
      today: "Hoje",
      voices: "Nas vozes",
      family: "Na voz da família",
      athlete: "Na voz do atleta",
    },
    items: [
      {
        slug: "isadora-santiago",
        name: "Isadora Santiago",
        age: "16 anos",
        school: "Montverde Academy",
        timestamp: "MONTVERDE · FL · 2026",
        decision:
          "A família Santiago não procurava uma escola famosa. Procurava um ambiente à altura do potencial da Isadora — acadêmico, esportivo e humano.",
        reading:
          "Pelo Método S.A.F.E.®, o perfil da Isadora apontava para um ambiente de altíssima exigência esportiva com estrutura acadêmica robusta. A Montverde Academy, na Flórida — uma das instituições mais respeitadas do esporte estudantil americano — foi a resposta certa para o perfil, não a resposta óbvia do mercado.",
        today:
          "Aos 16 anos, Isadora vive a rotina completa de uma estudante-atleta: aulas, treinos de alto nível, competições observadas pelo meio universitário e um histórico acadêmico sendo construído com estratégia.",
      },
      {
        slug: "benjamin-bertolucci",
        name: "Benjamin Bertolucci",
        age: "15 anos",
        school: "Spire Academy",
        timestamp: "SPIRE · OH · 2026",
        decision:
          "Aos 15 anos, Benjamin tinha o que o mercado chama de talento — e o que nós chamamos de ponto de partida. A família buscava desenvolvimento real, não vitrine.",
        reading:
          "O pilar Esporte do S.A.F.E.® indicou a necessidade de um ambiente de desenvolvimento atlético intensivo, com estrutura de performance de nível profissional. A Spire Academy, em Ohio, reconhecida por sua infraestrutura de treinamento entre as mais avançadas dos Estados Unidos, respondeu exatamente a essa leitura.",
        today:
          "Benjamin se desenvolve dentro de um dos ecossistemas esportivos mais completos do país — com a fundação acadêmica caminhando na mesma velocidade que a evolução em campo.",
      },
      {
        slug: "liz-valverde",
        name: "Liz Valverde",
        age: "15 anos",
        school: "Benfica Residential Academy",
        timestamp: "BENFICA · 2026",
        decision:
          "A família Valverde entendeu cedo o que poucos entendem: o caminho certo nem sempre é o mais falado. Para a Liz, o projeto pedia um ambiente de formação futebolística de padrão europeu dentro do ecossistema americano.",
        reading:
          "A Benfica Residential Academy uniu metodologia de formação de um dos maiores clubes formadores do mundo à imersão no sistema educacional americano — o alinhamento exato entre o pilar Esporte e o pilar Acadêmico do perfil da Liz.",
        today:
          "Aos 15 anos, Liz treina sob metodologia de elite, estuda dentro do sistema que abrirá as portas universitárias e amadurece em um ambiente desenhado para o perfil dela — não para a média.",
      },
    ],
    families: {
      eyebrow: "DEPOIMENTOS DOS PAIS",
      title: "Famílias que escolheram excelência.",
    },
    finalCta: {
      title: "A próxima história pode ser a da sua família.",
    },
  },

  // ── Página 7 — O Fundador ────────────────────────────────────────────────
  founder: {
    hero: {
      eyebrow: "O FUNDADOR",
      title: "Antes de guiar famílias por este caminho, ele o percorreu sozinho.",
      sub: "Leandro Ribeiro — Fundador & Estrategista-Chefe",
      portraitAlt: "Retrato de Leandro Ribeiro, fundador da Bolsa Atleta USA",
    },
    acts: {
      eyebrow: "A HISTÓRIA EM TRÊS ATOS",
      items: [
        {
          title: "O atleta.",
          description:
            "Goleiro, brasileiro, com um sonho maior que as estruturas disponíveis ao redor. Leandro conquistou uma bolsa integral para estudar e jogar nos Estados Unidos — e descobriu, na prática, que o futebol podia abrir portas que ele nem sabia que existiam.",
        },
        {
          title: "O profissional.",
          description:
            "Do gramado para dentro do sistema: Leandro atuou em admissões e recrutamento universitário, entendendo por dentro como escolas e universidades americanas realmente decidem — quem entra, quem recebe bolsa, quem é lembrado.",
        },
        {
          title: "O estrategista.",
          description:
            "A Bolsa Atleta USA nasce dessa dupla vivência: quem já foi o jovem no embarque e quem já esteve do outro lado da mesa. A Educação Esportiva Inteligente® é a tradução disso em método — para que nenhuma família precise decidir no escuro.",
        },
      ],
    },
    presence: {
      eyebrow: "PRESENÇA E RELACIONAMENTO",
      title: "Autoridade não se declara. Se demonstra.",
      body: "Presença recorrente nos Estados Unidos. Relacionamento direto com diretores de admissão e treinadores universitários. Tours institucionais em campi como Harvard University, College of The Holy Cross e The Taft School.",
    },
    team: {
      eyebrow: "A EQUIPE",
      title: "Um fundador não faz um projeto de vida. Uma equipe faz.",
      body: "À frente da Bolsa Atleta USA, Leandro lidera um time multidisciplinar que acompanha cada família de perto — do primeiro contato à universidade. Da estratégia de colocação à Coordenação de Sucesso e Experiência da Família, cada etapa tem um responsável com nome, rosto e presença.",
    },
    finalCta: {
      title: "Converse com quem domina o sistema.",
    },
  },

  // ── Página 8 — Avaliação Estratégica ─────────────────────────────────────
  evaluation: {
    hero: {
      eyebrow: "AVALIAÇÃO ESTRATÉGICA",
      title: "Todo grande projeto começa com uma leitura honesta.",
      sub: "A Avaliação Estratégica é a primeira etapa do Método S.A.F.E.®: uma análise individual do perfil do seu filho e do momento da sua família — conduzida pela nossa equipe, sem compromisso.",
    },
    afterSubmit: {
      eyebrow: "O QUE ACONTECE DEPOIS DO ENVIO",
      steps: [
        "Nossa equipe analisa as informações da família à luz do Método S.A.F.E.®",
        "Se houver alinhamento, agendamos uma conversa estratégica individual",
        "Na conversa, apresentamos uma leitura inicial do caminho possível — com verdade, inclusive quando a resposta for “ainda não é o momento”",
      ],
      highlight:
        "Atuamos com número limitado de famílias por ciclo. A avaliação é criteriosa dos dois lados — como deve ser.",
    },
  },
} as const;

export type SiteCopy = typeof sitePt;

export default sitePt;
