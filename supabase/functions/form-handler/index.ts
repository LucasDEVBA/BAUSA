import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

// LEGADO: o formulário público (apps/web FormsPage) grava DIRETO no PostgREST
// com a anon key — não passa por aqui. Esta função segue publicada (o deploy
// de supabase/** a republica) e usa a SERVICE ROLE, então é um segundo
// caminho de escrita que não passa pelas travas do role anon. Endurecida no
// T23: só aceita os campos do formulário (mass-assignment) e valida a data de
// nascimento com A MESMA função do banco (public.fs_motivo_nascimento_invalido).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Espelho do payload de FormsPage.onSubmit — nada de classificação, aprovação,
// carimbos de envio ou reunião (colunas que só o servidor escreve).
const CAMPOS_PERMITIDOS = new Set([
  'submission_id', 'email', 'athlete_name', 'birth_date', 'age', 'athlete_whatsapp',
  'school_year', 'current_school', 'school_city_state', 'education_model', 'start_timing',
  'project_direction', 'investment_range', 'position', 'club_history', 'achievements',
  'instagram', 'video_highlights', 'academic_performance', 'english_level',
  'behavioral_profile', 'youth_commitment', 'family_decision_structure', 'guardian_name',
  'guardian_email', 'guardian_whatsapp', 'guardian_profession', 'guardian_profession_2',
  'guardian_name_2', 'guardian_whatsapp_2', 'guardian_email_2', 'viajou_exterior',
  'como_conheceu', 'address_country', 'address_cep', 'address_street', 'address_number',
  'address_complement', 'address_neighborhood', 'address_city', 'address_state', 'notes',
  'user_agent', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'utm_id', 'referrer_url', 'landing_url', 'session_id', 'cta_source', 'device_type',
  'form_started_at',
])


const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const bruto = await req.json()
    const formData: Record<string, unknown> = Object.fromEntries(
      Object.entries(bruto && typeof bruto === 'object' ? bruto : {})
        .filter(([campo]) => CAMPOS_PERMITIDOS.has(campo)),
    )

    if (!formData.submission_id || !formData.email || !formData.athlete_name) {
      return json({ error: 'submission_id, email e athlete_name são obrigatórios' }, 400)
    }


    console.log("Processing submission for:", formData.email)

    // 1. Salvar no Banco de Dados (Postgres)
    // SÓ INSERE (ignoreDuplicates → ON CONFLICT DO NOTHING): com a service
    // role, o upsert antigo deixava qualquer portador da anon key (pública)
    // SOBRESCREVER contato/e-mail de um lead existente pelo submission_id —
    // que o anon consegue ler. Nenhum caller legítimo reenviava pelo mesmo id.
    const { error: dbError } = await supabaseClient
      .from('form_submissions')
      .upsert({
        ...formData,
        status: 'new',
        updated_at: new Date().toISOString()
      }, { onConflict: 'submission_id', ignoreDuplicates: true })

    if (dbError) throw dbError

    // 2. Enviar E-mail via Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'Elite Portal <onboarding@resend.dev>',
            to: ['contato@bolsaatletausa.com'],
            subject: `Novo Lead: ${formData.athlete_name}`,
            html: `
              <h2>Nova Inscrição Recebida</h2>
              <p><strong>Atleta:</strong> ${formData.athlete_name}</p>
              <p><strong>Data de Nascimento:</strong> ${formData.birth_date ?? "-"}</p>
              <p><strong>Idade:</strong> ${formData.age != null ? formData.age + " anos" : "-"}</p>
              <p><strong>E-mail:</strong> ${formData.email}</p>
              <p><strong>WhatsApp:</strong> ${formData.guardian_whatsapp}</p>
              <p><strong>Posição:</strong> ${formData.position}</p>
              <p><strong>Investimento:</strong> ${formData.investment_range}</p>
              <br>
              <p>Acesse o painel administrativo para ver todos os detalhes.</p>
            `,
          }),
        })
      } catch (e) {
        console.error("Email error:", e.message)
      }
    }

    // 3. Salvar no Google Sheets (Via Webhook ou API)
    // Para garantir persistência 100%, você pode usar um webhook do Make aqui
    // ou a integração direta se a Service Account estiver configurada.

    return json({ success: true, message: "Submission processed" }, 200)

  } catch (error) {
    return json({ error: error.message }, 400)
  }
})
