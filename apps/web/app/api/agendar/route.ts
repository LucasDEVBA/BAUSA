import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SERVICE_ACCOUNT_EMAIL = process.env.SERVICE_ACCOUNT_EMAIL ?? "";
const RAW_KEY = process.env.SERVICE_ACCOUNT_PRIVATE_KEY ?? "";
const SERVICE_ACCOUNT_PRIVATE_KEY = RAW_KEY
  .replace(/^["']|["']$/g, "")
  .replace(/\\n/g, "\n")
  .replace(/\\\\n/g, "\n");
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA ?? "public";
const SEND_WHATSAPP_URL = process.env.SEND_WHATSAPP_URL ?? "";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";
const CEO_WHATSAPP = process.env.CEO_WHATSAPP ?? "";

function getCalendarAuth() {
  return new google.auth.JWT(
    SERVICE_ACCOUNT_EMAIL,
    undefined,
    SERVICE_ACCOUNT_PRIVATE_KEY,
    ["https://www.googleapis.com/auth/calendar"],
  );
}

// GET — busca slots disponíveis
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");

    if (!dateStr) {
      return NextResponse.json({ error: "date param required" }, { status: 400 });
    }

    // Debug: verificar env vars
    if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY || !GOOGLE_CALENDAR_ID) {
      console.error("[agendar] Missing env vars:", {
        hasEmail: !!SERVICE_ACCOUNT_EMAIL,
        hasKey: SERVICE_ACCOUNT_PRIVATE_KEY.length > 0,
        keyLength: SERVICE_ACCOUNT_PRIVATE_KEY.length,
        keyStart: SERVICE_ACCOUNT_PRIVATE_KEY.substring(0, 30),
        hasCalendarId: !!GOOGLE_CALENDAR_ID,
      });
      return NextResponse.json({
        error: "Calendar not configured",
        debug: {
          hasEmail: !!SERVICE_ACCOUNT_EMAIL,
          hasKey: SERVICE_ACCOUNT_PRIVATE_KEY.length > 0,
          hasCalendarId: !!GOOGLE_CALENDAR_ID,
        },
      }, { status: 500 });
    }

    const auth = getCalendarAuth();
    const calendar = google.calendar({ version: "v3", auth });

    const dayStart = new Date(`${dateStr}T00:00:00-03:00`);
    const dayEnd = new Date(`${dateStr}T23:59:59-03:00`);

    // Buscar eventos existentes no dia
    const { data } = await calendar.events.list({
      calendarId: GOOGLE_CALENDAR_ID,
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const busySlots = (data.items ?? []).map((event) => ({
      start: event.start?.dateTime ?? event.start?.date ?? "",
      end: event.end?.dateTime ?? event.end?.date ?? "",
    }));

    // Gerar slots de 1h entre 9h e 18h (horário Brasília)
    const slots: { time: string; available: boolean }[] = [];
    for (let hour = 9; hour < 18; hour++) {
      const slotStart = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:00:00-03:00`);
      const slotEnd = new Date(`${dateStr}T${String(hour + 1).padStart(2, "0")}:00:00-03:00`);

      const isOccupied = busySlots.some((busy) => {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        return slotStart < busyEnd && slotEnd > busyStart;
      });

      // Não mostrar slots no passado
      const isPast = slotStart < new Date();

      slots.push({
        time: `${String(hour).padStart(2, "0")}:00`,
        available: !isOccupied && !isPast,
      });
    }

    return NextResponse.json({ slots });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[agendar] GET error:", msg, error);
    return NextResponse.json({ error: "Failed to fetch slots", detail: msg }, { status: 500 });
  }
}

// POST — cria evento + envia WhatsApp
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, email, date, time } = body;

    if (!name || !phone || !email || !date || !time) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }

    const auth = getCalendarAuth();
    const calendar = google.calendar({ version: "v3", auth });

    const startDateTime = `${date}T${time}:00-03:00`;
    const endHour = String(parseInt(time.split(":")[0]) + 1).padStart(2, "0");
    const endDateTime = `${date}T${endHour}:00:00-03:00`;

    // Criar evento com Google Meet
    const event = await calendar.events.insert({
      calendarId: GOOGLE_CALENDAR_ID,
      conferenceDataVersion: 1,
      requestBody: {
        summary: `Reunião Estratégica — ${name}`,
        description: `Reunião Estratégica Individual com ${name}\nTelefone: ${phone}\nEmail: ${email}\n\nBolsa Atleta USA — Educação Esportiva Inteligente®`,
        start: { dateTime: startDateTime, timeZone: "America/Sao_Paulo" },
        end: { dateTime: endDateTime, timeZone: "America/Sao_Paulo" },
        attendees: [{ email }],
        conferenceData: {
          createRequest: {
            requestId: `bausa-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 60 },
            { method: "popup", minutes: 30 },
          ],
        },
      },
    });

    const meetLink =
      event.data.hangoutLink ??
      event.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
      event.data.htmlLink ??
      "";

    const eventDate = new Date(startDateTime).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    });

    const eventTime = time;

    // Enviar WhatsApp para o lead
    if (SEND_WHATSAPP_URL && phone) {
      const leadMessage = `✅ *Reunião Confirmada!*

Olá, *${name}*!

Sua *Reunião Estratégica Individual* com *Leandro Ribeiro* está confirmada.

📅 *Data:* ${eventDate}
🕐 *Horário:* ${eventTime}h (Brasília)
📍 *Link da reunião:* ${meetLink}

_Recomendamos acessar 5 minutos antes do horário marcado._

Nos vemos em breve!
*Bolsa Atleta USA*`;

      try {
        await fetch(SEND_WHATSAPP_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(WEBHOOK_SECRET ? { "x-webhook-secret": WEBHOOK_SECRET } : {}),
          },
          body: JSON.stringify({
            record: {
              athlete_name: name,
              guardian_name: name,
              guardian_whatsapp: phone,
              athlete_whatsapp: phone,
              qualification_classification: "QUENTE",
            },
            messageType: "meeting_confirmed",
            customMessage: leadMessage,
            phone,
          }),
        });
      } catch (err) {
        console.error("[agendar] WhatsApp lead error:", err);
      }
    }

    // Enviar WhatsApp para o CEO
    if (SEND_WHATSAPP_URL && CEO_WHATSAPP) {
      const ceoMessage = `🔔 *Nova Reunião Agendada*

*Atleta/Responsável:* ${name}
*Telefone:* ${phone}
*Email:* ${email}

📅 *Data:* ${eventDate}
🕐 *Horário:* ${eventTime}h
📍 *Link:* ${meetLink}`;

      try {
        await fetch(SEND_WHATSAPP_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(WEBHOOK_SECRET ? { "x-webhook-secret": WEBHOOK_SECRET } : {}),
          },
          body: JSON.stringify({
            record: {
              athlete_name: name,
              guardian_name: "CEO",
              guardian_whatsapp: CEO_WHATSAPP,
              athlete_whatsapp: CEO_WHATSAPP,
              qualification_classification: "QUENTE",
            },
            messageType: "meeting_confirmed",
            customMessage: ceoMessage,
            phone: CEO_WHATSAPP,
          }),
        });
      } catch (err) {
        console.error("[agendar] WhatsApp CEO error:", err);
      }
    }

    // Atualizar Supabase — marcar reunião no form_submissions (se email bater)
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        const headers: Record<string, string> = {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          "Content-Profile": SUPABASE_SCHEMA,
        };

        // Buscar lead pelo email ou telefone
        const searchRes = await fetch(
          `${SUPABASE_URL}/rest/v1/form_submissions?or=(guardian_email.eq.${encodeURIComponent(email)},guardian_whatsapp.eq.${encodeURIComponent(phone)},email.eq.${encodeURIComponent(email)})&select=id,email,athlete_name&limit=1`,
          { headers: { ...headers, "Accept-Profile": SUPABASE_SCHEMA } },
        );

        const leads = await searchRes.json();
        if (Array.isArray(leads) && leads.length > 0) {
          const leadId = leads[0].id;

          // Marcar reunião
          await fetch(
            `${SUPABASE_URL}/rest/v1/form_submissions?id=eq.${leadId}`,
            {
              method: "PATCH",
              headers,
              body: JSON.stringify({
                meeting_scheduled: true,
                meeting_scheduled_at: new Date().toISOString(),
              }),
            },
          );

          // Buscar atleta → deal e mover para reuniao_marcada
          const atletaRes = await fetch(
            `${SUPABASE_URL}/rest/v1/atletas?form_submission_id=eq.${leadId}&deleted_at=is.null&select=id`,
            { headers: { ...headers, "Accept-Profile": SUPABASE_SCHEMA } },
          );
          const atletas = await atletaRes.json();

          if (Array.isArray(atletas) && atletas.length > 0) {
            const atletaId = atletas[0].id;

            const dealRes = await fetch(
              `${SUPABASE_URL}/rest/v1/deals?atleta_id=eq.${atletaId}&etapa=eq.lead&deleted_at=is.null&select=id`,
              { headers: { ...headers, "Accept-Profile": SUPABASE_SCHEMA } },
            );
            const deals = await dealRes.json();

            if (Array.isArray(deals) && deals.length > 0) {
              await fetch(
                `${SUPABASE_URL}/rest/v1/deals?id=eq.${deals[0].id}`,
                {
                  method: "PATCH",
                  headers,
                  body: JSON.stringify({
                    etapa: "reuniao_marcada",
                    etapa_anterior: "lead",
                    google_calendar_event_id: event.data.id,
                    next_action: "Preparar para reunião",
                    data_proxima_acao: date,
                    reuniao_agendada_at: new Date().toISOString(),
                    reuniao_data: startDateTime,
                    reuniao_link: meetLink,
                  }),
                },
              );
            }
          }
        }
      } catch (err) {
        console.error("[agendar] Supabase update error:", err);
      }
    }

    return NextResponse.json({
      success: true,
      meetLink,
      eventDate,
      eventTime,
      eventId: event.data.id,
    });
  } catch (error) {
    console.error("[agendar] POST error:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
