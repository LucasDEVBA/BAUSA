-- ════════════════════════════════════════════════════════════════════════════
-- Migration: scheduler_mensagens — textos das mensagens automáticas de WhatsApp
--            editáveis pelo CEO em /automacoes          | public, uat, dev
-- Contexto (Fase E das automações): a CF send-whatsapp passa a ler esta chave
--   e usar os textos custom por template (initial, followup_1, followup_2,
--   early_potential, late_timing, scheduled_return), cada um com versão
--   atleta/responsável. FALLBACK PERMANENTE nos builders hardcoded da CF —
--   sem seed, sem env vars Supabase na CF, erro de rede ou texto vazio →
--   comportamento atual inalterado (guard: tests/send-whatsapp-mensagens.test.js).
--   Seed = cópia byte a byte dos builders atuais, com placeholders no lugar
--   das interpolações: {atleta_nome}, {responsavel_nome}, {agenda_url},
--   {proximo_ano} (early_potential).
-- Nota: valor único definido em variável jsonb + EXECUTE ... USING nos schemas
--   uat/dev — garante seed idêntico nos 3 schemas sem escaping manual.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_valor jsonb := $seed_json${
  "initial": {
    "atleta": "*{atleta_nome}*,\n\nConcluímos a análise do seu perfil.\n\nIdentificamos *potencial real* em você para ingresso em instituições de excelência nos Estados Unidos.\n\nJá mapeamos algumas instituições parceiras que combinam com seu perfil e potencial de crescimento.\n\n✅ *Você foi selecionado para avançar à próxima etapa.*\nParabéns por essa conquista.\n\nO próximo passo é uma *Reunião Estratégica Individual* com o fundador da Bolsa Atleta USA.\n\nNessa etapa, iniciaremos a estruturação do seu projeto e a transformação desse potencial em um plano concreto rumo aos Estados Unidos.\n\nO link para agendamento já foi enviado ao seu responsável indicado no formulário.\n\n⏳ _A confirmação deve ocorrer dentro do ciclo vigente._",
    "responsavel": "Olá, *{responsavel_nome}*.\n\nAqui é da *Bolsa Atleta USA*.\n\nConcluímos a análise estratégica do perfil de *{atleta_nome}*.\n\nIdentificamos potencial de viabilidade para posicionamento em instituições parceiras de excelência nos Estados Unidos, dentro do modelo estruturado pela *Educação Esportiva Inteligente®*.\n\nJá mapeamos instituições parceiras que apresentam alinhamento consistente com o perfil apresentado e o momento do atleta.\n\nAtuamos com número intencionalmente limitado de famílias por ciclo, com acompanhamento ativo do fundador, com suporte de equipe multidisciplinar especializada, assegurando segurança e direção estratégica ao longo de toda a jornada do atleta.\n\n✅ *O perfil foi selecionado para avançar à próxima etapa.*\n\nO próximo passo é uma *Reunião Estratégica Individual* com *Leandro Ribeiro*.\nEssa etapa marca o início formal da estruturação do projeto.\n\n📅 *Agende a Reunião Estratégica:*\n{agenda_url}\n\n⏳ _A reserva desta etapa é mantida por período limitado, conforme o ciclo em andamento._"
  },
  "followup_1": {
    "atleta": "*{atleta_nome}*,\n\nVocê ainda tem uma oportunidade em aberto no processo de seleção da Bolsa Atleta USA.\n\nO link para agendamento da Reunião Estratégica Individual já foi enviado ao seu responsável.\n\n⚠️ As vagas do ciclo atual estão sendo preenchidas. Oriente o seu responsável a confirmar o horário.\n\n_Não perca essa janela de oportunidade._",
    "responsavel": "Olá, *{responsavel_nome}*.\n\nO agendamento da Reunião Estratégica Individual de *{atleta_nome}* ainda não foi confirmado.\n\nAs vagas do ciclo atual estão sendo preenchidas. O perfil continua selecionado, mas a reserva é por tempo limitado.\n\n📅 *Garanta o agendamento agora:*\n{agenda_url}\n\n⏳ _Essa etapa é fundamental para iniciar a estruturação do projeto._"
  },
  "followup_2": {
    "atleta": "*{atleta_nome}*,\n\nÚltima etapa antes do encerramento do ciclo de seleção.\n\nA Reunião Estratégica ainda não foi confirmada pelo seu responsável.\n\n_Oriente seu responsável a realizar o agendamento o quanto antes._",
    "responsavel": "Olá, *{responsavel_nome}*.\n\nEsse é nosso último contato sobre o ciclo atual de seleção.\n\nO perfil de *{atleta_nome}* foi selecionado, mas a Reunião Estratégica Individual ainda está pendente.\n\nNão conseguindo encaixar o horário, é só nos informar — estamos aqui para facilitar.\n\n📅 *Agende agora:*\n{agenda_url}\n\n_Após o encerramento do ciclo, novos processos têm datas e critérios próprios._"
  },
  "early_potential": {
    "atleta": "*{atleta_nome}*,\n\nRecebemos sua candidatura à Bolsa Atleta USA e identificamos *potencial real* no seu perfil.\n\nAntes de seguirmos, queremos ser transparentes sobre o momento ideal: o trabalho estratégico que conduzimos junto aos atletas começa a fazer sentido a partir do 8º ano — quando inicia a construção do histórico esportivo e acadêmico que será avaliado pelas instituições americanas.\n\n📅 *Vamos retomar este contato em novembro de {proximo_ano}* para uma análise estratégica completa do seu perfil.\n\nEnquanto isso, _mantenha o sonho vivo, treine com consistência e prepare-se com seriedade._\n\nA jornada começou hoje.\n\n— Equipe *Bolsa Atleta USA*",
    "responsavel": "Olá, *{responsavel_nome}*.\n\nAqui é da *Bolsa Atleta USA*.\n\nConcluímos a análise inicial do perfil de *{atleta_nome}* e identificamos *potencial real*. Por isso queremos cuidar desse projeto com a atenção que merece — e isso passa por respeitar o timing certo.\n\nAtuamos com famílias intencionalmente selecionadas, dentro da metodologia *Educação Esportiva Inteligente®*, e o trabalho estratégico que conduzimos faz mais sentido a partir do 8º ano: é quando começa a construção concreta da trajetória esportiva, acadêmica e linguística que será avaliada pelas universidades americanas.\n\n📅 *Vamos retomar este contato em novembro de {proximo_ano}* para uma análise estratégica completa de:\n• Trajetória esportiva construída até lá\n• Performance acadêmica\n• Evolução no inglês\n• Direção do projeto familiar\n\nReservamos esse compromisso. Em novembro, voltamos a falar — _com mais informações, mais maturidade do(a) atleta, e o quadro ideal para iniciar formalmente a estruturação._\n\nEnquanto isso, _o trabalho de base começa agora. Mantenham o sonho vivo._\n\n— Equipe *Bolsa Atleta USA*"
  },
  "late_timing": {
    "atleta": "*{atleta_nome}*,\n\nRecebemos sua candidatura à Bolsa Atleta USA e queremos ser totalmente transparentes com você.\n\nA janela competitiva de aplicação para o sistema *NCAA/NAIA* ocorre durante o high school ou imediatamente após a conclusão (em geral, até 12 meses). Pelas informações enviadas, esse momento já passou.\n\nIsso *não significa que o sonho acabou* — significa que o caminho precisa ser diferente. Para casos como o seu, geralmente o melhor caminho é:\n\n• *Junior College (NJCAA)* — porta de entrada por 2 anos antes de transferir para uma universidade NCAA\n• *Aplicação direta* em universidades fora do circuito esportivo competitivo\n• *Transfer student* — reaplicação a partir de um histórico universitário inicial\n\nNosso método é especializado em atletas dentro da janela competitiva, onde temos maior eficácia. Mas se quiser conversar sobre esses caminhos alternativos, _estaremos à disposição._\n\n— Equipe *Bolsa Atleta USA*",
    "responsavel": "Olá, *{responsavel_nome}*.\n\nAqui é da *Bolsa Atleta USA*.\n\nRecebemos a candidatura de *{atleta_nome}* e queremos compartilhar uma análise sincera sobre o timing.\n\nA janela ideal de aplicação para o sistema *NCAA/NAIA* ocorre durante o high school ou imediatamente após a conclusão (geralmente até 12 meses). Pelas informações que recebemos, esse momento já passou — o que muda significativamente o cenário competitivo.\n\nIsso *não encerra o sonho americano* — apenas redireciona o caminho. Para casos assim, normalmente avaliamos:\n\n• *Junior College (NJCAA)* — caminho de 2 anos como porta de entrada para NCAA via transferência\n• *Aplicação direta* em universidades fora do sistema esportivo competitivo\n• *Transfer student* — reaplicação após histórico universitário inicial\n\nNosso método é focado em atletas dentro da janela competitiva ideal, onde temos a maior eficácia comprovada. Mas valorizamos a transparência: _se desejarem conversar sobre esses caminhos alternativos, estaremos à disposição para uma orientação._\n\nAgradecemos a confiança em compartilhar esse momento conosco.\n\n— Equipe *Bolsa Atleta USA*"
  },
  "scheduled_return": {
    "atleta": "*{atleta_nome}*,\n\nComo combinamos no ano passado, voltamos para retomar a sua jornada rumo aos Estados Unidos.\n\nIdentificamos potencial naquele primeiro contato — e *agora é o momento estratégico* para entendermos a evolução:\n\n• Como está sua trajetória esportiva?\n• Como está o desempenho acadêmico?\n• E o inglês — evoluiu?\n\n📅 _Seu responsável receberá em seguida o link para uma Reunião Estratégica Individual com o fundador da Bolsa Atleta USA._\n\n— Equipe *Bolsa Atleta USA*",
    "responsavel": "Olá, *{responsavel_nome}*.\n\nAqui é da *Bolsa Atleta USA*.\n\nComo combinamos no ano passado, voltamos para retomar a conversa sobre o futuro internacional de *{atleta_nome}*.\n\nIdentificamos potencial naquele primeiro contato e, neste momento estratégico, queremos entender a evolução nos últimos 12 meses:\n\n• Como está a trajetória esportiva?\n• E o desempenho acadêmico?\n• Como foi a evolução no inglês?\n• Vocês mantêm o sonho americano?\n\nReservamos esse retorno para vocês. Se ainda fizer sentido, gostaríamos de agendar uma *Reunião Estratégica Individual* com *Leandro Ribeiro* — para analisar as possibilidades específicas de *{atleta_nome}*.\n\n📅 *Agendar a Reunião Estratégica:*\n{agenda_url}\n\n— Equipe *Bolsa Atleta USA* — assessoria exclusiva para bolsas esportivas em instituições americanas."
  }
}$seed_json$::jsonb;
  v_descricao text := 'Textos das mensagens automáticas de WhatsApp por template (atleta/responsável). Placeholders: {atleta_nome}, {responsavel_nome}, {agenda_url}, {proximo_ano}. Fallback nos textos hardcoded da CF send-whatsapp.';
BEGIN
  -- ─── PUBLIC (PRD) ───
  INSERT INTO public.configuracoes_sistema (chave, valor, descricao)
  VALUES ('scheduler_mensagens', v_valor, v_descricao)
  ON CONFLICT (chave) DO NOTHING;

  -- ─── UAT ───
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat')
     AND to_regclass('uat.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE 'INSERT INTO uat.configuracoes_sistema (chave, valor, descricao) '
         || 'VALUES ($1, $2, $3) ON CONFLICT (chave) DO NOTHING'
      USING 'scheduler_mensagens', v_valor, v_descricao;
  END IF;

  -- ─── DEV ───
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev')
     AND to_regclass('dev.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE 'INSERT INTO dev.configuracoes_sistema (chave, valor, descricao) '
         || 'VALUES ($1, $2, $3) ON CONFLICT (chave) DO NOTHING'
      USING 'scheduler_mensagens', v_valor, v_descricao;
  END IF;
END $$;
