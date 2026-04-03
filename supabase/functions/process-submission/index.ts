import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    const formData = payload.record || payload

    // ─── Validação de campos obrigatórios ─────────────────────
    if (!formData.email || !formData.email.includes('@')) {
      return new Response(
        JSON.stringify({ success: false, error: "Campo 'email' ausente ou inválido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    if (!formData.athlete_name || formData.athlete_name.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Campo 'athlete_name' ausente ou vazio" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    // Normaliza dados para evitar duplicatas por diferença de formatação
    formData.email = formData.email.trim().toLowerCase()
    formData.athlete_name = formData.athlete_name.trim()

    console.log(JSON.stringify({
      level: "INFO",
      action: "submission_received",
      email: formData.email,
      athlete: formData.athlete_name,
    }))

    // ─── Salvar no Banco de Dados (Postgres) ──────────────────
    // onConflict: 'email,athlete_name' → mesmo atleta + mesmo email = UPDATE
    // Atleta diferente com mesmo email de responsável = INSERT (novo lead)
    const { error: dbError } = await supabaseClient
      .from('form_submissions')
      .upsert({
        ...formData,
        status: 'new',
        updated_at: new Date().toISOString()
      }, { onConflict: 'email,athlete_name' })

    if (dbError) {
      console.log(JSON.stringify({
        level: "ERROR",
        action: "db_upsert_failed",
        error: dbError.message,
        email: formData.email,
      }))
      throw dbError
    }

    console.log(JSON.stringify({
      level: "INFO",
      action: "submission_saved",
      email: formData.email,
      athlete: formData.athlete_name,
    }))

    // Nota: O envio de e-mail é disparado automaticamente pelo webhook
    // configurado na tabela form_submissions (trigger: INSERT only)
    // Quando o upsert faz UPDATE (reenvio), o webhook NÃO dispara = sem email duplicado

    return new Response(
      JSON.stringify({ success: true, message: "Submission processed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )

  } catch (error) {
    console.log(JSON.stringify({
      level: "ERROR",
      action: "unhandled_error",
      error: error.message,
    }))

    return new Response(
      JSON.stringify({ success: false, error: "Erro interno ao processar submissão" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})