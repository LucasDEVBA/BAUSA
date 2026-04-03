-- ============================================================
-- CRM Bolsa Atleta USA — Migration 1: Tipos Enum
-- Cria todos os tipos enumerados necessários para o CRM.
-- ============================================================

-- Papéis de usuário
DO $$ BEGIN
  CREATE TYPE papel_usuario AS ENUM ('ceo', 'head_sucesso', 'comercial');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Etapas do pipeline comercial
DO $$ BEGIN
  CREATE TYPE status_deal AS ENUM (
    'lead', 'reuniao_marcada', 'reuniao_realizada',
    'diagnostico_fit', 'alinhamento_estrategico', 'proposta_enviada',
    'followup_proposta', 'negociacao', 'contrato_enviado',
    'contrato_assinado', 'sinal_pago', 'admission_process',
    'concluido', 'perdido', 'cancelamento_solicitado', 'projeto_futuro'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Classificação do lead score
DO $$ BEGIN
  CREATE TYPE classificacao_lead AS ENUM ('hot', 'warm', 'cold');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Status de parcelas financeiras
DO $$ BEGIN
  CREATE TYPE status_parcela AS ENUM ('previsto', 'recebido', 'atrasado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Temperatura da família no CRM Experiência
DO $$ BEGIN
  CREATE TYPE temperatura_familia AS ENUM ('verde', 'amarelo', 'vermelho');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Fases da jornada pós-venda
DO $$ BEGIN
  CREATE TYPE fase_experiencia AS ENUM (
    'admissao', 'aprovado', 'pre_embarque',
    'embarcado_inicial', 'acompanhamento', 'encerrado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Prioridade de tarefas
DO $$ BEGIN
  CREATE TYPE prioridade_tarefa AS ENUM ('critica', 'alta', 'media', 'baixa');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Status de tarefas
DO $$ BEGIN
  CREATE TYPE status_tarefa AS ENUM ('pendente', 'em_andamento', 'concluida', 'atrasada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Status de documentos
DO $$ BEGIN
  CREATE TYPE status_documento AS ENUM ('pendente', 'enviado_atleta', 'revisado', 'enviado_escola', 'aprovado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Canais de comunicação
DO $$ BEGIN
  CREATE TYPE canal_comunicacao AS ENUM ('whatsapp', 'email', 'ligacao', 'presencial');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Status do contrato de assinatura digital
DO $$ BEGIN
  CREATE TYPE status_contrato_assinatura AS ENUM ('nao_enviado', 'enviado', 'assinado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipo de plano
DO $$ BEGIN
  CREATE TYPE plano_tipo AS ENUM ('journey', 'legacy', 'start');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Nível de inglês
DO $$ BEGIN
  CREATE TYPE nivel_ingles AS ENUM ('nenhum', 'basico', 'intermediario', 'avancado', 'fluente');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Nível competitivo esportivo
DO $$ BEGIN
  CREATE TYPE nivel_competitivo AS ENUM (
    'escolar', 'escolinha', 'clube_social',
    'base_baixo', 'base_medio', 'base_alto',
    'selecao', 'apenas_academico'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Decisão familiar
DO $$ BEGIN
  CREATE TYPE decisao_familiar AS ENUM ('decidida', 'em_discussao', 'resistente');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Comprometimento do atleta
DO $$ BEGIN
  CREATE TYPE comprometimento_atleta AS ENUM ('alto', 'medio', 'baixo', 'indefinido');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Desempenho acadêmico
DO $$ BEGIN
  CREATE TYPE desempenho_academico AS ENUM ('excelente', 'bom', 'regular', 'fraco');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Origem do lead
DO $$ BEGIN
  CREATE TYPE origem_lead AS ENUM ('formulario_web', 'indicacao', 'instagram', 'meta_ads', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipo de crise
DO $$ BEGIN
  CREATE TYPE tipo_crise AS ENUM ('emocional', 'academica', 'financeira', 'familiar', 'bullying', 'saude');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Nível de crise
DO $$ BEGIN
  CREATE TYPE nivel_crise AS ENUM ('baixo', 'medio', 'alto', 'critico');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Motivo de perda do deal
DO $$ BEGIN
  CREATE TYPE motivo_perda AS ENUM (
    'financeiro', 'timing', 'desistencia_familia',
    'atleta_nao_qualificado', 'concorrencia', 'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Influência do esporte na admissão
DO $$ BEGIN
  CREATE TYPE influencia_esporte AS ENUM ('decisiva', 'forte', 'moderada', 'baixa');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Agressividade de bolsa da escola
DO $$ BEGIN
  CREATE TYPE agressividade_bolsa AS ENUM ('alta', 'media', 'baixa', 'rara');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Função genérica de updated_at para todas as tabelas do CRM
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
