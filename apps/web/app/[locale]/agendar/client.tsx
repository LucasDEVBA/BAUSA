"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  User,
  Phone,
  Mail,
  Video,
  ArrowLeft,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useLanguage } from "@/i18n";
import logoWhite from "@/assets/logo-white.png";

// ─── i18n texts ─────────────────────────────────────────────────────────────

const TEXTS = {
  pt: {
    title: "Reunião Estratégica Individual",
    subtitle: "com Leandro Ribeiro — Bolsa Atleta USA",
    selectDate: "Selecione uma data",
    selectTime: "Horários disponíveis",
    noSlots: "Sem horários disponíveis neste dia",
    confirm: "Confirmar Reunião",
    confirming: "Agendando...",
    name: "Nome completo",
    phone: "WhatsApp",
    email: "E-mail",
    review: "Confirme seus dados",
    successTitle: "Reunião Confirmada!",
    successMsg: "Você receberá o link da reunião por WhatsApp.",
    meetLink: "Link da reunião",
    backHome: "Voltar ao início",
    weekend: "Sem disponibilidade nos finais de semana",
    loading: "Buscando horários...",
    errorGeneric: "Erro ao agendar. Tente novamente.",
    prev: "Anterior",
    next: "Próximo",
    duration: "60 min",
    timezone: "Horário de Brasília",
  },
  en: {
    title: "Individual Strategic Meeting",
    subtitle: "with Leandro Ribeiro — Bolsa Atleta USA",
    selectDate: "Select a date",
    selectTime: "Available times",
    noSlots: "No available slots on this day",
    confirm: "Confirm Meeting",
    confirming: "Scheduling...",
    name: "Full name",
    phone: "WhatsApp",
    email: "Email",
    review: "Review your details",
    successTitle: "Meeting Confirmed!",
    successMsg: "You will receive the meeting link via WhatsApp.",
    meetLink: "Meeting link",
    backHome: "Back to home",
    weekend: "No availability on weekends",
    loading: "Loading times...",
    errorGeneric: "Error scheduling. Please try again.",
    prev: "Previous",
    next: "Next",
    duration: "60 min",
    timezone: "Brasília Time (BRT)",
  },
  es: {
    title: "Reunión Estratégica Individual",
    subtitle: "con Leandro Ribeiro — Bolsa Atleta USA",
    selectDate: "Seleccione una fecha",
    selectTime: "Horarios disponibles",
    noSlots: "Sin horarios disponibles en este día",
    confirm: "Confirmar Reunión",
    confirming: "Agendando...",
    name: "Nombre completo",
    phone: "WhatsApp",
    email: "Correo electrónico",
    review: "Confirme sus datos",
    successTitle: "¡Reunión Confirmada!",
    successMsg: "Recibirá el enlace de la reunión por WhatsApp.",
    meetLink: "Enlace de la reunión",
    backHome: "Volver al inicio",
    weekend: "Sin disponibilidad los fines de semana",
    loading: "Buscando horarios...",
    errorGeneric: "Error al agendar. Intente nuevamente.",
    prev: "Anterior",
    next: "Siguiente",
    duration: "60 min",
    timezone: "Hora de Brasilia",
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function decodeToken(token: string | null): { n?: string; p?: string; e?: string } {
  if (!token) return {};
  try {
    return JSON.parse(atob(token));
  } catch {
    return {};
  }
}

function formatDateLabel(date: Date, locale: string): string {
  return date.toLocaleDateString(locale === "pt" ? "pt-BR" : locale === "es" ? "es-ES" : "en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatFullDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale === "pt" ? "pt-BR" : locale === "es" ? "es-ES" : "en-US", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Slot {
  time: string;
  available: boolean;
}

type Step = "date" | "time" | "confirm" | "success";

export default function AgendarContent() {
  const { lang } = useLanguage();
  const t = TEXTS[lang as keyof typeof TEXTS] ?? TEXTS.pt;
  const searchParams = useSearchParams();

  // Decode token from URL
  const prefilled = useMemo(() => decodeToken(searchParams.get("t")), [searchParams]);

  // State
  const [step, setStep] = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [name, setName] = useState(prefilled.n ?? "");
  const [phone, setPhone] = useState(prefilled.p ?? "");
  const [email, setEmail] = useState(prefilled.e ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meetLink, setMeetLink] = useState<string | null>(null);
  const [confirmedDate, setConfirmedDate] = useState("");
  const [confirmedTime, setConfirmedTime] = useState("");

  // Calendar navigation
  const [weekOffset, setWeekOffset] = useState(0);

  const weekDays = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() + weekOffset * 7);
    if (weekOffset === 0) {
      // Start from today
    } else {
      // Start from Monday of that week
      const dayOfWeek = start.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      start.setDate(start.getDate() + diff);
    }

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekOffset]);

  // Fetch slots when date selected
  const fetchSlots = useCallback(async (date: Date) => {
    setLoadingSlots(true);
    setSlots([]);
    try {
      const res = await fetch(`/api/agendar?date=${toDateStr(date)}`);
      const data = await res.json();
      setSlots(data.slots ?? []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDate && !isWeekend(selectedDate)) {
      fetchSlots(selectedDate);
    }
  }, [selectedDate, fetchSlots]);

  // Pre-fill from token
  useEffect(() => {
    if (prefilled.n) setName(prefilled.n);
    if (prefilled.p) setPhone(prefilled.p);
    if (prefilled.e) setEmail(prefilled.e);
  }, [prefilled]);

  // Submit
  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime || !name || !phone || !email) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/agendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          date: toDateStr(selectedDate),
          time: selectedTime,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? t.errorGeneric);
      }

      setMeetLink(data.meetLink);
      setConfirmedDate(data.eventDate);
      setConfirmedTime(data.eventTime);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1128] flex items-center justify-center p-4">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-[#8e1824]/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-[#1A365D]/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        {/* Logo + Header */}
        <div className="mb-6 text-center">
          <img src={logoWhite.src} alt="Bolsa Atleta USA" className="mx-auto h-10 mb-4 opacity-80" />
          <h1 className="text-xl sm:text-2xl font-bold text-white">{t.title}</h1>
          <p className="text-sm text-zinc-400 mt-1">{t.subtitle}</p>
          <div className="mt-2 flex items-center justify-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t.duration}</span>
            <span className="flex items-center gap-1"><Video className="h-3 w-3" />Google Meet</span>
            <span>{t.timezone}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 sm:p-8">
          <AnimatePresence mode="wait">
            {/* ═══ STEP: DATE ═══ */}
            {step === "date" && (
              <motion.div
                key="date"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
                  {t.selectDate}
                </p>

                {/* Week navigation */}
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setWeekOffset((p) => Math.max(0, p - 1))}
                    disabled={weekOffset === 0}
                    className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:text-white disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setWeekOffset((p) => Math.min(4, p + 1))}
                    className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:text-white"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Day buttons */}
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((day) => {
                    const isToday = toDateStr(day) === toDateStr(new Date());
                    const isWe = isWeekend(day);
                    const isPast = day < new Date(new Date().toDateString());
                    const isSelected = selectedDate && toDateStr(day) === toDateStr(selectedDate);

                    return (
                      <button
                        key={toDateStr(day)}
                        onClick={() => {
                          if (!isWe && !isPast) {
                            setSelectedDate(day);
                            setSelectedTime(null);
                          }
                        }}
                        disabled={isWe || isPast}
                        className={`flex flex-col items-center rounded-xl py-3 px-1 text-center transition-all ${
                          isSelected
                            ? "border-2 border-indigo-500 bg-indigo-500/20 text-white"
                            : isWe || isPast
                              ? "border border-white/5 bg-white/[0.02] text-zinc-600 cursor-not-allowed"
                              : "border border-white/10 bg-white/[0.03] text-zinc-300 hover:border-indigo-500/50 hover:bg-indigo-500/10"
                        }`}
                      >
                        <span className="text-[10px] uppercase">
                          {day.toLocaleDateString(lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US", { weekday: "short" })}
                        </span>
                        <span className={`text-lg font-bold ${isToday ? "text-indigo-400" : ""}`}>
                          {day.getDate()}
                        </span>
                        <span className="text-[10px]">
                          {day.toLocaleDateString(lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US", { month: "short" })}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Time slots */}
                {selectedDate && (
                  <div className="mt-6">
                    <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
                      {t.selectTime} — {formatDateLabel(selectedDate, lang)}
                    </p>

                    {isWeekend(selectedDate) ? (
                      <p className="text-sm text-zinc-500 text-center py-6">{t.weekend}</p>
                    ) : loadingSlots ? (
                      <div className="flex items-center justify-center py-6 gap-2 text-zinc-500 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" /> {t.loading}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {slots.map((slot) => (
                          <button
                            key={slot.time}
                            onClick={() => {
                              if (slot.available) {
                                setSelectedTime(slot.time);
                                setStep("confirm");
                              }
                            }}
                            disabled={!slot.available}
                            className={`rounded-lg py-2.5 text-sm font-medium transition-all ${
                              selectedTime === slot.time
                                ? "bg-indigo-600 text-white"
                                : slot.available
                                  ? "border border-white/10 text-zinc-300 hover:border-indigo-500 hover:text-white"
                                  : "border border-white/5 text-zinc-700 cursor-not-allowed line-through"
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                        {slots.length === 0 && !loadingSlots && (
                          <p className="col-span-full text-sm text-zinc-500 text-center py-4">{t.noSlots}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ STEP: CONFIRM ═══ */}
            {step === "confirm" && selectedDate && selectedTime && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-5"
              >
                <button
                  onClick={() => setStep("date")}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  <ArrowLeft className="h-3 w-3" /> {t.prev}
                </button>

                {/* Selected slot */}
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-indigo-300">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium capitalize">{formatFullDate(selectedDate, lang)}</span>
                  </div>
                  <p className="text-2xl font-bold text-white mt-1">{selectedTime}h</p>
                </div>

                {/* Form fields */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
                    {t.review}
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400 flex items-center gap-1.5">
                        <User className="h-3 w-3" /> {t.name}
                      </label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400 flex items-center gap-1.5">
                        <Phone className="h-3 w-3" /> {t.phone}
                      </label>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        type="tel"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400 flex items-center gap-1.5">
                        <Mail className="h-3 w-3" /> {t.email}
                      </label>
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleConfirm}
                  disabled={submitting || !name || !phone || !email}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8e1824] to-[#1A365D] py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-[#8e1824]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> {t.confirming}</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4" /> {t.confirm}</>
                  )}
                </button>
              </motion.div>
            )}

            {/* ═══ STEP: SUCCESS ═══ */}
            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-5 py-4"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-white">{t.successTitle}</h2>
                  <p className="text-sm text-zinc-400 mt-1">{t.successMsg}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">📅 Data</span>
                    <span className="text-white font-medium capitalize">{confirmedDate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">🕐 Horário</span>
                    <span className="text-white font-medium">{confirmedTime}h</span>
                  </div>
                  {meetLink && (
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">📍 {t.meetLink}</span>
                      <a
                        href={meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 font-medium"
                      >
                        Abrir Meet
                      </a>
                    </div>
                  )}
                </div>

                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t.backHome}
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
