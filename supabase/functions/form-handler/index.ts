import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const formData = await req.json()
    console.log("Processing submission for:", formData.email)

    // 1. Salvar no Banco de Dados (Postgres)
    const { error: dbError } = await supabaseClient
      .from('form_submissions')
      .upsert({
        ...formData,
        status: 'new',
        updated_at: new Date().toISOString()
      }, { onConflict: 'submission_id' })

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

    return new Response(
      JSON.stringify({ success: true, message: "Submission processed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    )
  }
})
