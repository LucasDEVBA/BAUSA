const { google } = require('googleapis');
const functions = require('@google-cloud/functions-framework');

// ─── Configuração via variáveis de ambiente (NUNCA hardcode) ────
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.SERVICE_ACCOUNT_EMAIL;
const RAW_KEY = process.env.SERVICE_ACCOUNT_PRIVATE_KEY || '';
const SERVICE_ACCOUNT_PRIVATE_KEY = RAW_KEY
  .replace(/^["']|["']$/g, '')
  .replace(/\\n/g, '\n')
  .replace(/\\\\n/g, '\n');

// ─── Log estruturado ───────────────────────────────────────────
const log = (level, action, details = {}) => {
  console.log(JSON.stringify({ level, action, ...details }));
};

// ─── Autenticação Google Sheets ────────────────────────────────
const getAuthClient = () => {
  if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error('SERVICE_ACCOUNT_EMAIL ou SERVICE_ACCOUNT_PRIVATE_KEY não configurada');
  }

  return new google.auth.JWT(
    SERVICE_ACCOUNT_EMAIL,
    null,
    SERVICE_ACCOUNT_PRIVATE_KEY,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
};

// ─── Busca a linha existente por email + athlete_name ──────────
const findExistingRow = async (sheets, email, athleteName) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Página1!A:BG',
    });

    const rows = response.data.values || [];

    for (let i = 0; i < rows.length; i++) {
      const rowEmail = (rows[i][8] || '').trim().toLowerCase();  // col I
      const rowName = (rows[i][4] || '').trim().toLowerCase();   // col E

      if (rowEmail === email.trim().toLowerCase() && rowName === athleteName.trim().toLowerCase()) {
        return i + 1;
      }
    }

    return null;
  } catch (error) {
    log('ERROR', 'sheets_search_failed', { error: error.message });
    return null;
  }
};

// ─── Monta a linha de dados ────────────────────────────────────
const buildRow = (data) => {
  return [
    // A-B: COLUNAS DE QUALIFICAÇÃO (IA)
    data.qualified ? 'SIM' : (data.qualified === false ? 'NÃO' : ''),  // A
    data.qualification_reason || '',                                      // B

    // C-D: METADADOS
    new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), // C
    data.submission_id || '',                                               // D

    // E-I: DADOS BÁSICOS DO ATLETA
    data.athlete_name || '',       // E
    data.birth_date || '',         // F
    data.age || '',                // G
    data.athlete_whatsapp || '',   // H
    data.email || '',              // I

    // J-M: BASE EDUCACIONAL
    data.school_year || '',        // J
    data.current_school || '',     // K
    data.school_city_state || '',  // L
    data.education_model || '',    // M

    // N-P: DIREÇÃO ESTRATÉGICA
    data.start_timing || '',       // N
    data.project_direction || '',  // O
    data.investment_range || '',   // P

    // Q-U: PERFIL ESPORTIVO
    data.position || '',           // Q
    data.club_history || '',       // R
    data.achievements || '',       // S
    data.instagram || '',          // T
    data.video_highlights || '',   // U

    // V-Z: PERFIL ACADÊMICO E COMPORTAMENTAL
    data.academic_performance || '',      // V
    data.english_level || '',             // W
    data.behavioral_profile || '',        // X
    data.youth_commitment || '',          // Y
    data.family_decision_structure || '', // Z

    // AA-AD: RESPONSÁVEL LEGAL
    data.guardian_name || '',        // AA
    data.guardian_email || '',       // AB
    data.guardian_whatsapp || '',    // AC
    data.guardian_profession || '',  // AD

    // AE-AF: OBSERVAÇÕES E STATUS
    data.notes || '',               // AE
    data.status || 'new',           // AF

    // AG-AM: ENDEREÇO
    data.address_cep || '',           // AG
    data.address_street || '',        // AH
    data.address_number || '',        // AI
    data.address_complement || '',    // AJ
    data.address_neighborhood || '',  // AK
    data.address_city || '',          // AL
    data.address_state || '',         // AM

    // AN-AO: STATUS WHATSAPP INICIAL
    data.whatsapp_sent_at ? 'SIM' : 'NÃO',  // AN - WhatsApp Enviado
    data.whatsapp_sent_at ? new Date(data.whatsapp_sent_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',  // AO - Data Envio WhatsApp

    // AP-AQ: FOLLOW-UP 1 (48h sem agendamento)
    data.followup_1_sent_at ? 'SIM' : 'NÃO',  // AP - Follow-up 1 Enviado
    data.followup_1_sent_at ? new Date(data.followup_1_sent_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',  // AQ - Data Follow-up 1

    // AR-AS: FOLLOW-UP 2 (7 dias sem agendamento)
    data.followup_2_sent_at ? 'SIM' : 'NÃO',  // AR - Follow-up 2 Enviado
    data.followup_2_sent_at ? new Date(data.followup_2_sent_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',  // AS - Data Follow-up 2

    // AT-AU: REUNIÃO AGENDADA (detectada via Google Calendar API)
    data.meeting_scheduled ? 'SIM' : 'NÃO',  // AT - Reunião Agendada
    data.meeting_scheduled_at ? new Date(data.meeting_scheduled_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',  // AU - Data Detecção Reunião

    // AV: PAÍS (suporte internacional)
    data.address_country || 'BR',  // AV - País do lead

    // AW-BG: TRACKING & ATRIBUIÇÃO
    data.utm_source || '',         // AW - UTM Source
    data.utm_medium || '',         // AX - UTM Medium
    data.utm_campaign || '',       // AY - UTM Campaign
    data.utm_content || '',        // AZ - UTM Content
    data.utm_term || '',           // BA - UTM Term
    data.referrer_url || '',       // BB - Referrer URL
    data.landing_url || '',        // BC - Landing URL
    data.session_id || '',         // BD - Session ID
    data.cta_source || '',         // BE - CTA Source (hero/final/header)
    data.device_type || '',        // BF - Device Type (mobile/tablet/desktop)
    data.form_started_at ? new Date(data.form_started_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',  // BG - Form Started At
  ];
};

// ─── Cloud Function principal ──────────────────────────────────
functions.http('syncLeads', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  // ─── Autenticação via secret compartilhado ──────────────────
  if (WEBHOOK_SECRET) {
    const incoming = req.headers['x-webhook-secret'];
    if (incoming !== WEBHOOK_SECRET) {
      log('WARN', 'auth_failed', { ip: req.ip });
      return res.status(401).send({ success: false, error: 'Unauthorized' });
    }
  }

  const startTime = Date.now();

  try {
    if (!SPREADSHEET_ID) {
      throw new Error('SPREADSHEET_ID não configurada');
    }

    const payload = req.body;
    const data = payload.record || payload;

    if (!data || Object.keys(data).length === 0) {
      log('WARN', 'empty_payload');
      return res.status(200).send({ message: 'No data' });
    }

    if (!data.email || !data.athlete_name) {
      log('WARN', 'validation_failed', {
        hasEmail: !!data.email,
        hasAthleteName: !!data.athlete_name,
      });
      return res.status(400).send({
        success: false,
        error: 'email e athlete_name são obrigatórios',
      });
    }

    log('INFO', 'sync_start', {
      email: data.email,
      athlete: data.athlete_name,
    });

    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const row = buildRow(data);

    const existingRowIndex = await findExistingRow(sheets, data.email, data.athlete_name);

    if (existingRowIndex) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Página1!A${existingRowIndex}:BG${existingRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [row] },
      });

      log('INFO', 'sheets_updated', {
        email: data.email,
        athlete: data.athlete_name,
        row: existingRowIndex,
        durationMs: Date.now() - startTime,
      });

      return res.status(200).send({
        success: true,
        action: 'updated',
        row: existingRowIndex,
      });

    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Página1!A:A',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [row] },
      });

      log('INFO', 'sheets_inserted', {
        email: data.email,
        athlete: data.athlete_name,
        durationMs: Date.now() - startTime,
      });

      return res.status(200).send({
        success: true,
        action: 'inserted',
      });
    }

  } catch (error) {
    log('CRITICAL', 'sync_failed', {
      error: error.message,
      durationMs: Date.now() - startTime,
    });

    return res.status(500).send({
      success: false,
      error: 'Erro interno ao sincronizar com Google Sheets',
    });
  }
});
