"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  GraduationCap,
  Trophy,
  Target,
  UserCheck,
  MapPin,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Zap,
  Loader2,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@/lib/supabase-browser";

const STEPS = [
  { id: 1, label: "Atleta", icon: User },
  { id: 2, label: "Educação", icon: GraduationCap },
  { id: 3, label: "Esporte", icon: Trophy },
  { id: 4, label: "Projeto", icon: Target },
  { id: 5, label: "Responsável", icon: UserCheck },
  { id: 6, label: "Endereço", icon: MapPin },
];

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-sys-red">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder transition-colors focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30";

const selectClass =
  "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none";

export default function NovoLeadPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // LGPD consent state
  const [consentimentoLgpd, setConsentimentoLgpd] = useState(false);
  const [aceiteWhatsapp, setAceiteWhatsapp] = useState(true);
  const [aceiteEmail, setAceiteEmail] = useState(true);

  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");

  const fetchCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    setCepError("");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (data.erro) {
        setCepError("CEP nao encontrado");
      } else {
        setForm((prev) => ({
          ...prev,
          address_street: data.logradouro || "",
          address_city: data.localidade || "",
          address_state: data.uf || "",
        }));
      }
    } catch {
      setCepError("Erro ao buscar CEP");
    } finally {
      setCepLoading(false);
    }
  };

  const [form, setForm] = useState({
    // Atleta
    athlete_name: "",
    birth_date: "",
    age: "",
    athlete_whatsapp: "",
    email: "",
    instagram: "",
    school_year: "",
    video_highlights: "",
    // Educação
    current_school: "",
    school_city_state: "",
    education_model: "",
    academic_performance: "",
    english_level: "",
    // Esporte
    position: "",
    club_history: "",
    achievements: "",
    // Projeto
    start_timing: "",
    project_direction: "",
    athlete_commitment: "",
    family_decision: "",
    investment_range: "",
    // Responsável
    guardian_name: "",
    guardian_profession: "",
    guardian_profession_2: "",
    guardian_phone: "",
    guardian_email: "",
    // Origem / Indicação
    origem: "" as string,
    indicador_nome: "",
    indicador_tipo: "",
    // Endereço
    address_cep: "",
    address_city: "",
    address_state: "",
    address_street: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.athlete_name || !form.guardian_name) return;
    if (!consentimentoLgpd) {
      toast.error("Voce precisa aceitar a Politica de Privacidade para prosseguir.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createBrowserClient();

      const origemInfo = form.origem
        ? `Origem: ${form.origem}${form.origem === "indicacao" ? ` | Indicador: ${form.indicador_nome || "N/A"} (${form.indicador_tipo || "N/A"})` : ""}`
        : "";
      const lgpdPrefix = [
        origemInfo,
        `LGPD: WhatsApp=${aceiteWhatsapp ? "Sim" : "Nao"}, Email=${aceiteEmail ? "Sim" : "Nao"} | Consentimento em ${new Date().toISOString()}`,
      ].filter(Boolean).join(" | ");

      const { error } = await supabase.from("form_submissions").insert({
        athlete_name: form.athlete_name,
        email: form.email || `${form.athlete_name.toLowerCase().replace(/\s+/g, ".")}@manual.crm`,
        birth_date: form.birth_date || null,
        guardian_whatsapp: form.athlete_whatsapp || null,
        position: form.position || null,
        school_year: form.school_year || null,
        current_school: form.current_school || null,
        city_state: form.school_city_state || null,
        english_level: form.english_level || null,
        guardian_name: form.guardian_name || null,
        guardian_profession: form.guardian_profession || null,
        guardian_profession_2: form.guardian_profession_2 || null,
        guardian_email: form.guardian_email || null,
        investment_range: form.investment_range || null,
        club_history: form.club_history || null,
        achievements: form.achievements || null,
        instagram: form.instagram || null,
        video_link: form.video_highlights || null,
        status: "new",
        submitted_at: new Date().toISOString(),
        consentimento_lgpd: true,
        notes: lgpdPrefix,
      });

      if (error) {
        toast.error(`Erro ao cadastrar lead: ${error.message}`);
        return;
      }

      toast.success("Lead cadastrado com sucesso!");
      setSubmitted(true);
    } catch (err) {
      toast.error("Erro inesperado ao cadastrar lead. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-sys-green/10 border border-sys-green/30">
            <CheckCircle className="h-8 w-8 text-sys-green" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-foreground">Lead cadastrado com sucesso!</h2>
          <p className="mb-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{form.athlete_name}</span> foi adicionado ao CRM.
          </p>
          <p className="mb-6 text-xs text-label-tertiary">
            A IA irá analisar automaticamente o perfil e calcular o Lead Score nas próximas horas.
            Um convite de reunião será enviado em 22h.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push("/leads")}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
            >
              Ver lista de leads
            </button>
            <button
              onClick={() => { setSubmitted(false); setStep(1); setConsentimentoLgpd(false); setAceiteWhatsapp(true); setAceiteEmail(true); setForm({
                athlete_name: "", birth_date: "", age: "", athlete_whatsapp: "", email: "", instagram: "", school_year: "", video_highlights: "",
                current_school: "", school_city_state: "", education_model: "", academic_performance: "", english_level: "",
                position: "", club_history: "", achievements: "",
                start_timing: "", project_direction: "", athlete_commitment: "", family_decision: "", investment_range: "",
                guardian_name: "", guardian_profession: "", guardian_profession_2: "", guardian_phone: "", guardian_email: "",
                origem: "", indicador_nome: "", indicador_tipo: "",
                address_cep: "", address_city: "", address_state: "", address_street: "",
              }); }}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
            >
              + Novo lead
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-5 w-5 text-primary" />
            <h1 className="text-title-2 text-foreground">Novo Lead</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Cadastro completo do atleta — alimenta a IA de análise e o motor de match
          </p>
        </div>

        {/* Steps */}
        <div className="mb-8 flex items-center gap-0">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isDone = s.id < step;
            return (
              <div key={s.id} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-all",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : isDone
                        ? "border-sys-green bg-sys-green/20 text-sys-green"
                        : "border-border bg-card text-label-tertiary"
                    )}
                  >
                    {isDone ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={cn("text-[10px] font-medium hidden sm:block", isActive ? "text-foreground" : isDone ? "text-sys-green" : "text-label-tertiary")}>
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={cn("flex-1 h-px mx-2", isDone ? "bg-sys-green/40" : "bg-border")} />
                )}
              </div>
            );
          })}
        </div>

        {/* Form card */}
        <div className="rounded-lg border border-border/70 bg-card/60 p-4">
          {/* Step 1 — Atleta */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-foreground">Dados do Atleta</h2>
                <p className="text-xs text-muted-foreground">Informações pessoais e de contato</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Nome completo do atleta" required>
                    <input className={inputClass} placeholder="Ex: Gabriel Souza Martins" value={form.athlete_name} onChange={(e) => update("athlete_name", e.target.value)} />
                  </Field>
                </div>
                <Field label="Data de nascimento" required>
                  <input type="date" className={inputClass} value={form.birth_date} onChange={(e) => update("birth_date", e.target.value)} />
                </Field>
                <Field label="Série / Ano escolar" required>
                  <select className={selectClass} value={form.school_year} onChange={(e) => update("school_year", e.target.value)}>
                    <option value="">Selecionar...</option>
                    {["7th Grade", "8th Grade", "9th Grade", "10th Grade", "11th Grade", "12th Grade"].map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </Field>
                <Field label="WhatsApp" required>
                  <input className={inputClass} placeholder="(11) 99999-9999" value={form.athlete_whatsapp} onChange={(e) => update("athlete_whatsapp", e.target.value)} />
                </Field>
                <Field label="E-mail">
                  <input type="email" className={inputClass} placeholder="atleta@email.com" value={form.email} onChange={(e) => update("email", e.target.value)} />
                </Field>
                <Field label="Instagram">
                  <input className={inputClass} placeholder="@usuario" value={form.instagram} onChange={(e) => update("instagram", e.target.value)} />
                </Field>
                <Field label="Link de vídeo Highlights">
                  <input className={inputClass} placeholder="https://youtube.com/..." value={form.video_highlights} onChange={(e) => update("video_highlights", e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {/* Step 2 — Educação */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-foreground">Perfil Educacional</h2>
                <p className="text-xs text-muted-foreground">Informações acadêmicas para o motor de match</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Escola atual" required>
                    <input className={inputClass} placeholder="Nome da escola" value={form.current_school} onChange={(e) => update("current_school", e.target.value)} />
                  </Field>
                </div>
                <Field label="Cidade / Estado da escola" required>
                  <input className={inputClass} placeholder="Ex: São Paulo / SP" value={form.school_city_state} onChange={(e) => update("school_city_state", e.target.value)} />
                </Field>
                <Field label="Modelo educacional">
                  <select className={selectClass} value={form.education_model} onChange={(e) => update("education_model", e.target.value)}>
                    <option value="">Selecionar...</option>
                    <option value="regular">Regular (público/privado)</option>
                    <option value="bilingual">Bilíngue</option>
                    <option value="american">Escola americana</option>
                    <option value="international">Escola internacional</option>
                    <option value="other">Outro</option>
                  </select>
                </Field>
                <Field label="Desempenho acadêmico" required>
                  <select className={selectClass} value={form.academic_performance} onChange={(e) => update("academic_performance", e.target.value)}>
                    <option value="">Selecionar...</option>
                    <option value="excelente">Excelente (acima de 8.5)</option>
                    <option value="bom">Bom (7.0 a 8.5)</option>
                    <option value="regular">Regular (5.0 a 7.0)</option>
                    <option value="baixo">Baixo (abaixo de 5.0)</option>
                  </select>
                </Field>
                <Field label="Nível de inglês" required>
                  <select className={selectClass} value={form.english_level} onChange={(e) => update("english_level", e.target.value)}>
                    <option value="">Selecionar...</option>
                    <option value="Básico">Básico</option>
                    <option value="Básico-Intermediário">Básico-Intermediário</option>
                    <option value="Intermediário">Intermediário</option>
                    <option value="Avançado">Avançado</option>
                    <option value="Fluente">Fluente</option>
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* Step 3 — Esporte */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-foreground">Trajetória Esportiva</h2>
                <p className="text-xs text-muted-foreground">Informações para análise do perfil atlético</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Posição" required>
                  <select className={selectClass} value={form.position} onChange={(e) => update("position", e.target.value)}>
                    <option value="">Selecionar...</option>
                    {["Goleiro", "Zagueiro", "Lateral Direito", "Lateral Esquerdo", "Volante", "Meio-campo", "Meia Atacante", "Ponta Direita", "Ponta Esquerda", "Atacante Centro"].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </Field>
                <div />
                <div className="sm:col-span-2">
                  <Field label="Histórico de clubes">
                    <textarea className={cn(inputClass, "resize-none")} rows={3} placeholder="Liste os clubes onde já jogou..." value={form.club_history} onChange={(e) => update("club_history", e.target.value)} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Conquistas e destaques">
                    <textarea className={cn(inputClass, "resize-none")} rows={3} placeholder="Títulos, seleções, destaque regional..." value={form.achievements} onChange={(e) => update("achievements", e.target.value)} />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* Step 4 — Projeto */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-foreground">Projeto e Investimento</h2>
                <p className="text-xs text-muted-foreground">Timing, direção e capacidade de investimento</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Momento de início" required>
                  <select className={selectClass} value={form.start_timing} onChange={(e) => update("start_timing", e.target.value)}>
                    <option value="">Selecionar...</option>
                    <option value="imediato">Imediato (próximos 6 meses)</option>
                    <option value="6_12">6 a 12 meses</option>
                    <option value="1_2_anos">1 a 2 anos</option>
                    <option value="acima_2_anos">Acima de 2 anos</option>
                  </select>
                </Field>
                <Field label="Direção do projeto">
                  <select className={selectClass} value={form.project_direction} onChange={(e) => update("project_direction", e.target.value)}>
                    <option value="">Selecionar...</option>
                    <option value="esporte">Foco esportivo (carreira profissional)</option>
                    <option value="academico">Foco acadêmico (universidade top)</option>
                    <option value="balanceado">Balanceado (esporte + academia)</option>
                    <option value="indefinido">Ainda indefinido</option>
                  </select>
                </Field>
                <Field label="Comprometimento do atleta" required>
                  <select className={selectClass} value={form.athlete_commitment} onChange={(e) => update("athlete_commitment", e.target.value)}>
                    <option value="">Selecionar...</option>
                    <option value="alto">Alto — atleta muito motivado</option>
                    <option value="medio">Médio — motivado mas incerto</option>
                    <option value="baixo">Baixo — mais vontade dos pais</option>
                  </select>
                </Field>
                <Field label="Decisão familiar">
                  <select className={selectClass} value={form.family_decision} onChange={(e) => update("family_decision", e.target.value)}>
                    <option value="">Selecionar...</option>
                    <option value="decidida">Família decidida</option>
                    <option value="consultando">Consultando membros</option>
                    <option value="oposta">Há resistência familiar</option>
                    <option value="monoparental">Decisão monoparental</option>
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Faixa de investimento anual (US$)" required>
                    <select className={selectClass} value={form.investment_range} onChange={(e) => update("investment_range", e.target.value)}>
                      <option value="">Selecionar...</option>
                      <option value="abaixo_15k">Abaixo de US$ 15k</option>
                      <option value="15k_20k">US$ 15k – 20k</option>
                      <option value="20k_30k">US$ 20k – 30k</option>
                      <option value="30k_40k">US$ 30k – 40k</option>
                      <option value="40k_50k">US$ 40k – 50k</option>
                      <option value="acima_50k">Acima de US$ 50k</option>
                    </select>
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* Step 5 — Responsável */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-foreground">Dados do Responsável</h2>
                <p className="text-xs text-muted-foreground">Pai, mãe ou responsável legal pelo atleta</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Nome completo" required>
                    <input className={inputClass} placeholder="Nome do responsável" value={form.guardian_name} onChange={(e) => update("guardian_name", e.target.value)} />
                  </Field>
                </div>
                <Field label="Profissão" required>
                  <input className={inputClass} placeholder="Ex: Empresário, Médico..." value={form.guardian_profession} onChange={(e) => update("guardian_profession", e.target.value)} />
                </Field>
                <Field label="Profissão do 2º responsável (opcional)">
                  <input className={inputClass} placeholder="Renda familiar é somada no classificador" value={form.guardian_profession_2} onChange={(e) => update("guardian_profession_2", e.target.value)} />
                </Field>
                <Field label="Telefone / WhatsApp" required>
                  <input className={inputClass} placeholder="(11) 99999-9999" value={form.guardian_phone} onChange={(e) => update("guardian_phone", e.target.value)} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="E-mail">
                    <input type="email" className={inputClass} placeholder="responsavel@email.com" value={form.guardian_email} onChange={(e) => update("guardian_email", e.target.value)} />
                  </Field>
                </div>
              </div>

              {/* Origem / Indicação */}
              <div className="mt-6 border-t border-border pt-5">
                <h3 className="text-sm font-semibold text-foreground/80 mb-3">Origem do Lead</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field label="Como conheceu a BAUSA?">
                      <select className={selectClass} value={form.origem} onChange={(e) => update("origem", e.target.value)}>
                        <option value="">Selecionar...</option>
                        <option value="formulario_web">Formulario web</option>
                        <option value="indicacao">Indicacao</option>
                        <option value="instagram">Instagram</option>
                        <option value="meta_ads">Meta Ads</option>
                        <option value="outro">Outro</option>
                      </select>
                    </Field>
                  </div>
                  {form.origem === "indicacao" && (
                    <>
                      <Field label="Nome de quem indicou">
                        <input className={inputClass} placeholder="Nome completo do indicador" value={form.indicador_nome} onChange={(e) => update("indicador_nome", e.target.value)} />
                      </Field>
                      <Field label="Tipo de indicacao">
                        <select className={selectClass} value={form.indicador_tipo} onChange={(e) => update("indicador_tipo", e.target.value)}>
                          <option value="">Selecionar...</option>
                          <option value="familia_cliente">Familia de cliente</option>
                          <option value="amigo">Amigo</option>
                          <option value="profissional">Profissional</option>
                        </select>
                      </Field>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 6 — Endereço */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-foreground">Endereço</h2>
                <p className="text-xs text-muted-foreground">Localização da família — usada para análise regional</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="CEP">
                  <div className="relative">
                    <input
                      className={inputClass}
                      placeholder="00000-000"
                      value={form.address_cep}
                      onChange={(e) => {
                        const val = e.target.value;
                        update("address_cep", val);
                        const clean = val.replace(/\D/g, "");
                        if (clean.length === 8) {
                          fetchCep(val);
                        }
                      }}
                    />
                    {cepLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  {cepError && (
                    <p className="mt-1 text-xs text-sys-red">{cepError}</p>
                  )}
                </Field>
                <Field label="Estado" required>
                  <select className={selectClass} value={form.address_state} onChange={(e) => update("address_state", e.target.value)}>
                    <option value="">UF</option>
                    {["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"].map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Cidade" required>
                  <input className={inputClass} placeholder="Cidade" value={form.address_city} onChange={(e) => update("address_city", e.target.value)} />
                </Field>
                <Field label="Rua / Logradouro">
                  <input className={inputClass} placeholder="Endereço" value={form.address_street} onChange={(e) => update("address_street", e.target.value)} />
                </Field>
              </div>

              {/* Preview de lead score */}
              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Inteligência Automática — após cadastro</p>
                </div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• IA analisará perfil acadêmico, esportivo, financeiro e timing</li>
                  <li>• Lead Score calculado automaticamente (0–100)</li>
                  <li>• Classificação: <span className="text-sys-green">Quente</span> / <span className="text-sys-orange">Morno</span> / <span className="text-sys-blue">Frio</span></li>
                  <li>• Convite de reunião enviado automaticamente em 22h</li>
                  <li>• Se não agendar em 24h → tarefa criada para follow-up do CEO</li>
                </ul>
              </div>

              {/* LGPD Consent */}
              <div className="mt-4 rounded-xl border border-border bg-background p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Consentimento LGPD</p>
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentimentoLgpd}
                    onChange={(e) => setConsentimentoLgpd(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border bg-card text-primary focus:ring-primary/30"
                  />
                  <span className="text-xs text-foreground/80">
                    Li e concordo com a Politica de Privacidade e Termos de Uso <span className="text-sys-red">*</span>
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aceiteWhatsapp}
                    onChange={(e) => setAceiteWhatsapp(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border bg-card text-primary focus:ring-primary/30"
                  />
                  <span className="text-xs text-muted-foreground">
                    Autorizo contato via WhatsApp
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aceiteEmail}
                    onChange={(e) => setAceiteEmail(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border bg-card text-primary focus:ring-primary/30"
                  />
                  <span className="text-xs text-muted-foreground">
                    Autorizo contato via E-mail
                  </span>
                </label>

                <p className="text-[10px] text-label-tertiary leading-relaxed pt-1">
                  Ao enviar este formulario, voce consente com o tratamento dos seus dados pessoais conforme a Lei Geral de Protecao de Dados (Lei 13.709/2018). Os dados serao utilizados exclusivamente para fins de assessoria em bolsas esportivas e nao serao compartilhados com terceiros sem consentimento previo.
                </p>
              </div>
            </div>
          )}

          {/* Navegação */}
          <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
            <button
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
              className={cn(
                "flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors",
                step === 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-accent hover:text-foreground"
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>

            <p className="text-xs text-label-tertiary">Etapa {step} de {STEPS.length}</p>

            {step < STEPS.length ? (
              <button
                onClick={() => setStep(Math.min(STEPS.length, step + 1))}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
              >
                Próximo
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!form.athlete_name || !form.guardian_name || !consentimentoLgpd || isSubmitting}
                className="flex items-center gap-2 rounded-md bg-sys-green px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                {isSubmitting ? "Salvando..." : "Cadastrar Lead"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
