"use client";

import { useEffect } from "react";

// V1: Redireciona para Google Calendar Appointment Schedule
// V2: Página custom com slots + confirmação WhatsApp (ver docs/IMPROVEMENTS.md #7)
const GOOGLE_CALENDAR_URL = "https://calendar.app.google/zd5Q1dhmJZqoKBPD7";

export default function AgendarContent() {
  useEffect(() => {
    window.location.href = GOOGLE_CALENDAR_URL;
  }, []);

  return (
    <div className="min-h-screen bg-[#0a1128] flex items-center justify-center">
      <p className="text-zinc-400 text-sm">Redirecionando para agendamento...</p>
    </div>
  );
}
