"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronRight, ChevronLeft, Lock, CheckCircle2, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import logoWhite from "@/assets/logo-white.png";
import logoFormColor from "@/assets/logo-form-color.png";
import logoFormWhite from "@/assets/logo-form-white.png";
import { Link } from "@/i18n/navigation";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n";
import LanguageSelector from "@/components/LanguageSelector";
import FormPhoneInput from "@/components/ui/phone-input";
import { CountrySelect } from "@/components/ui/country-select";
// supabase é importado dinamicamente dentro do onSubmit para evitar
// que a inicialização do cliente (que exige env vars) quebre o carregamento da página

// Constants for local storage
const FORM_DRAFT_KEY = "bolsa_atleta_form_draft_v2";
const FORM_SUBMISSION_ID_KEY = "bolsa_atleta_submission_id";

const generateSubmissionId = (): string =>
  `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

// --- Schema ---
const formSchema = z.object({
  // Stage 1
  athleteName: z.string().min(1, "Nome é obrigatório"),
  birthDate: z.string().min(1, "Data de nascimento é obrigatória"),
  whatsapp: z.string().min(1, "WhatsApp é obrigatório"),
  schoolYear: z.string().min(1, "Série é obrigatória"),
  currentSchool: z.string().min(1, "Escola é obrigatória"),
  cityState: z.string().min(1, "Cidade/Estado é obrigatório"),
  educationalModel: z.string().min(1, "Modelo educacional é obrigatório"),
  startTiming: z.string().min(1, "Selecione uma opção"),
  projectDirection: z.string().min(1, "Selecione uma opção"),
  investmentRange: z.string().min(1, "Selecione uma faixa"),
  // Stage 2
  position: z.string().min(1, "Posição é obrigatória"),
  clubHistory: z.string().min(1, "Histórico é obrigatório"),
  achievements: z.string().optional(),
  instagram: z.string().optional(),
  videoHighlights: z.string().url("URL inválida").optional().or(z.literal("")),
  academicPerformance: z.string().min(1, "Selecione uma opção"),
  englishLevel: z.string().min(1, "Selecione uma opção"),
  behavioralProfile: z.string().min(1, "Selecione uma opção"),
  youthCommitment: z.string().min(1, "Selecione uma opção"),
  familyDecision: z.string().min(1, "Selecione uma opção"),
  guardianName: z.string().min(1, "Nome é obrigatório"),
  guardianProfession: z.string().min(1, "Profissão é obrigatória"),
  guardianWhatsapp: z.string().min(1, "Telefone é obrigatório"),
  guardianEmail: z.string().email("E-mail inválido").min(1, "E-mail é obrigatório"),
  // Address — campos condicionais por país (validados via superRefine)
  country: z.string().min(1, "País é obrigatório"),
  addressCep: z.string().optional(),
  addressStreet: z.string().optional(),
  addressNumber: z.string().optional(),
  addressComplement: z.string().optional(),
  addressNeighborhood: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
}).superRefine((data, ctx) => {
  // Cidade é obrigatória para todos os países
  if (!data.addressCity?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cidade é obrigatória",
      path: ["addressCity"],
    });
  }

  // Campos extras obrigatórios apenas para Brasil
  if (data.country === "BR") {
    if (!data.addressCep || !/^\d{5}-\d{3}$/.test(data.addressCep)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CEP inválido",
        path: ["addressCep"],
      });
    }
    if (!data.addressStreet?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rua é obrigatória",
        path: ["addressStreet"],
      });
    }
    if (!data.addressNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Número é obrigatório",
        path: ["addressNumber"],
      });
    }
    if (!data.addressNeighborhood?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bairro é obrigatório",
        path: ["addressNeighborhood"],
      });
    }
    if (!data.addressState?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Estado é obrigatório",
        path: ["addressState"],
      });
    }
  }
});

type FormData = z.infer<typeof formSchema>;

// --- Step definitions ---
// Steps 0-5: Stage 1 (0=intro, 1-5=fields)
// Steps 6-12: Stage 2 (6=intro, 7-12=fields with submit on last)
const STAGE_1_INTRO = 0;
const STAGE_1_START = 1;
const STAGE_1_END = 5;
const STAGE_2_INTRO = 6;
const STAGE_2_START = 7;
const STAGE_2_END = 13;
const TOTAL_FIELD_STEPS = 12; // 5 in stage 1 + 7 in stage 2

const stepFieldsMap: Record<number, (keyof FormData)[]> = {
  1: ["athleteName", "birthDate", "whatsapp", "schoolYear"],
  2: ["currentSchool", "cityState", "educationalModel"],
  3: ["position", "clubHistory", "achievements", "instagram", "videoHighlights"],
  4: ["startTiming"],
  5: ["projectDirection"],
  7: ["academicPerformance", "englishLevel"],
  8: ["behavioralProfile"],
  9: ["youthCommitment"],
  10: ["familyDecision"],
  11: ["investmentRange"],
  12: ["guardianName", "guardianProfession", "guardianWhatsapp", "guardianEmail"],
  13: ["country", "addressCep", "addressStreet", "addressNumber", "addressComplement", "addressNeighborhood", "addressCity", "addressState"],
};

// Auto-advance steps (single radio)
const autoAdvanceSteps = [4, 5, 8, 9, 10, 11];

const Forms = () => {
  // SEO handled by generateMetadata in app/[locale]/forms/page.tsx
  const { t, translateError } = useLanguage();
  const [showIntro, setShowIntro] = useState(true);
  const [currentStep, setCurrentStep] = useState(STAGE_1_INTRO);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const submissionIdRef = useRef<string>("");
  const isNavigatingRef = useRef(false);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      athleteName: "", birthDate: "", whatsapp: "", schoolYear: "",
      currentSchool: "", cityState: "", educationalModel: "",
      startTiming: "", projectDirection: "", investmentRange: "",
      position: "", clubHistory: "", achievements: "", instagram: "", videoHighlights: "",
      academicPerformance: "", englishLevel: "",
      behavioralProfile: "", youthCommitment: "", familyDecision: "",
      guardianName: "", guardianProfession: "", guardianWhatsapp: "", guardianEmail: "",
      country: "BR",
      addressCep: "", addressStreet: "", addressNumber: "", addressComplement: "",
      addressNeighborhood: "", addressCity: "", addressState: "",
    },
  });

  const { register, handleSubmit, watch, setValue, formState: { errors }, trigger, getValues } = form;
  const allFormValues = watch();

  // --- localStorage draft ---
  useEffect(() => {
    const stored = localStorage.getItem(FORM_SUBMISSION_ID_KEY);
    if (stored) { submissionIdRef.current = stored; }
    else {
      const id = generateSubmissionId();
      submissionIdRef.current = id;
      localStorage.setItem(FORM_SUBMISSION_ID_KEY, id);
    }
    const draft = localStorage.getItem(FORM_DRAFT_KEY);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        Object.keys(parsed).forEach((k) => {
          const key = k as keyof FormData;
          if (parsed[key]) setValue(key, parsed[key]);
        });
      } catch (e) {
        console.error("[Forms] Erro ao restaurar rascunho:", e);
      }
    }
  }, [setValue]);

  useEffect(() => {
    const t = setTimeout(() => {
      const data = getValues();
      const has = Object.values(data).some(v => v !== "" && v !== undefined);
      if (has && !isComplete) localStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(data));
    }, 1000);
    return () => clearTimeout(t);
  }, [allFormValues, isComplete, getValues]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(FORM_DRAFT_KEY);
    localStorage.removeItem(FORM_SUBMISSION_ID_KEY);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  // --- CEP lookup ---

  // --- CEP lookup com fallback automático ---
  const fetchAddressByCep = useCallback(async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setIsFetchingCep(true);
    setCepError(null);

    // Função para tentar ViaCEP
    const tryViaCep = async (cleanCep: string) => {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
          signal: AbortSignal.timeout(5000), // 5s timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.erro) {
          throw new Error("CEP não encontrado");
        }

        return {
          logradouro: data.logradouro || "",
          bairro: data.bairro || "",
          localidade: data.localidade || "",
          uf: data.uf || "",
        };
      } catch (error) {
        console.warn("[ViaCEP] Falhou:", error);
        throw error;
      }
    };

    // Função para tentar BrasilAPI (fallback)
    const tryBrasilApi = async (cleanCep: string) => {
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`, {
          signal: AbortSignal.timeout(5000), // 5s timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        return {
          logradouro: data.street || "",
          bairro: data.neighborhood || "",
          localidade: data.city || "",
          uf: data.state || "",
        };
      } catch (error) {
        console.warn("[BrasilAPI] Falhou:", error);
        throw error;
      }
    };

    try {
      let addressData = null;

      // 1. Tenta ViaCEP primeiro
      try {
        addressData = await tryViaCep(cleanCep);
        console.log("[CEP] Sucesso via ViaCEP");
      } catch (error) {
        // 2. Se ViaCEP falhar, tenta BrasilAPI
        console.log("[CEP] ViaCEP falhou, tentando BrasilAPI...");
        addressData = await tryBrasilApi(cleanCep);
        console.log("[CEP] Sucesso via BrasilAPI");
      }

      if (!addressData) {
        setCepError("CEP não encontrado");
        return;
      }

      // Preencher campos
      setValue("addressStreet", addressData.logradouro, { shouldValidate: true });
      setValue("addressNeighborhood", addressData.bairro, { shouldValidate: true });
      setValue("addressCity", addressData.localidade, { shouldValidate: true });
      setValue("addressState", addressData.uf, { shouldValidate: true });

      // Focus no campo número
      setTimeout(() => {
        const numInput = document.getElementsByName("addressNumber")[0] as HTMLInputElement;
        if (numInput) numInput.focus();
      }, 100);

    } catch (error) {
      setCepError("Serviço de CEP temporariamente indisponível");
      console.error("[CEP] Todas as APIs falharam:", error);
    } finally {
      setIsFetchingCep(false);
    }
  }, [setValue]);

  // --- Navigation ---
  const validateStep = async (step: number): Promise<boolean> => {
    const fields = stepFieldsMap[step];
    if (!fields || fields.length === 0) return true;

    const currentCountry = getValues("country");
    const isBrazil = currentCountry === "BR";

    const results = await Promise.all(fields.filter(f => {
      // Campos sempre opcionais
      if (f === "achievements" || f === "instagram" || f === "addressComplement") return false;
      // Campos opcionais para não-brasileiros (superRefine valida conforme país)
      if (!isBrazil && (f === "addressCep" || f === "addressStreet" || f === "addressNumber" || f === "addressNeighborhood" || f === "addressState")) return false;
      return true;
    }).map(f => trigger(f as keyof FormData)));
    return results.every(Boolean);
  };

  const nextStep = async () => {
    if (isNavigatingRef.current) return;
    if (currentStep >= STAGE_2_END) return;
    isNavigatingRef.current = true;

    try {
      // Validate current step fields
      if (stepFieldsMap[currentStep]) {
        const valid = await validateStep(currentStep);
        if (!valid) {
          isNavigatingRef.current = false;
          return;
        }
      }
      setDirection("forward");
      setCurrentStep(prev => prev + 1);
    } finally {
      setTimeout(() => { isNavigatingRef.current = false; }, 300);
    }
  };

  const prevStep = () => {
    if (isNavigatingRef.current) return;
    if (currentStep <= STAGE_1_START) return;
    isNavigatingRef.current = true;

    setDirection("back");
    setCurrentStep(prev => prev - 1);

    setTimeout(() => { isNavigatingRef.current = false; }, 300);
  };

  // --- Submit ---
  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setSubmissionError(null);
    try {
      const birthDateValue = data.birthDate?.trim() || null;

      // Compute numeric age from birth date
      let computedAge: number | null = null;
      if (birthDateValue) {
        const birth = new Date(birthDateValue);
        const today = new Date();
        computedAge = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
          computedAge--;
        }
      }

      const submissionData = {
        submission_id: submissionIdRef.current,
        email: data.guardianEmail.trim(),
        athlete_name: data.athleteName.trim(),
        birth_date: birthDateValue,
        age: computedAge,
        athlete_whatsapp: data.whatsapp.trim(),
        school_year: data.schoolYear.trim(),
        current_school: data.currentSchool.trim(),
        school_city_state: data.cityState.trim(),
        education_model: data.educationalModel,
        start_timing: data.startTiming,
        project_direction: data.projectDirection,
        investment_range: data.investmentRange,
        position: data.position.trim(),
        club_history: data.clubHistory.trim(),
        achievements: data.achievements?.trim() || null,
        instagram: data.instagram?.trim() || null,
        video_highlights: data.videoHighlights?.trim() || null,
        academic_performance: data.academicPerformance,
        english_level: data.englishLevel,
        behavioral_profile: data.behavioralProfile,
        youth_commitment: data.youthCommitment,
        family_decision_structure: data.familyDecision,
        guardian_name: data.guardianName.trim(),
        guardian_email: data.guardianEmail.trim(),
        guardian_whatsapp: data.guardianWhatsapp.trim() || data.whatsapp.trim(),
        guardian_profession: data.guardianProfession.trim(),
        address_country: data.country || "BR",
        address_cep: data.addressCep?.trim() || null,
        address_street: data.addressStreet?.trim() || null,
        address_number: data.addressNumber?.trim() || null,
        address_complement: data.addressComplement?.trim() || null,
        address_neighborhood: data.addressNeighborhood?.trim() || null,
        address_city: data.addressCity?.trim() || null,
        address_state: data.addressState?.trim() || null,
        notes: `whatsapp_stage1: ${data.whatsapp}`,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent || null : null,
      };

      // Usa fetch direta para garantir controle total dos headers.
      // A cadeia createClient → fetchWithAuth → new Headers() tem um bug
      // de timing que impede o Content-Profile de chegar na requisição.
      // Fetch direta é explícita, rastreável no Network tab e sempre correta.
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA ?? 'public';

      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Prefer': 'return=minimal,resolution=ignore-duplicates',
      };

      // Header de schema para PostgREST rotear para uat/dev (não necessário em PRD)
      if (schema !== 'public') {
        requestHeaders['Content-Profile'] = schema;
      }

      const res = await fetch(
        `${supabaseUrl}/rest/v1/form_submissions?on_conflict=email%2Cathlete_name`,
        { method: 'POST', headers: requestHeaders, body: JSON.stringify(submissionData) }
      );

      if (!res.ok) {
        const raw = await res.text();
        console.error('[Form] Supabase error:', res.status, raw);
        let parsed: { message?: string; details?: string } = {};
        try { parsed = JSON.parse(raw); } catch { /* mantém parsed vazio */ }
        throw new Error(parsed.message ?? `Erro ${res.status}: ${parsed.details ?? 'falha no envio'}`);
      }

      clearDraft();
      setIsComplete(true);
      toast({ title: t("form.toast.title"), description: t("form.toast.description") });
    } catch (err) {
      console.error("[Form] Unexpected error:", err);
      if (err instanceof Error) {
        setSubmissionError(err.message);
      } else {
        setSubmissionError("Erro ao processar envio.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditResponse = () => {
    const newId = generateSubmissionId();
    submissionIdRef.current = newId;
    localStorage.setItem(FORM_SUBMISSION_ID_KEY, newId);
    const currentData = getValues();
    localStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(currentData));
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    isNavigatingRef.current = false;
    setIsComplete(false);
    setSubmissionError(null);
    setCurrentStep(STAGE_1_START);
    setShowIntro(false);
    setDirection("forward");
  };

  // --- Progress ---
  const getProgress = () => {
    let completed = 0;
    if (currentStep >= STAGE_1_START && currentStep <= STAGE_1_END) {
      completed = currentStep - STAGE_1_START;
    } else if (currentStep >= STAGE_2_START) {
      completed = 5 + (currentStep - STAGE_2_START);
    } else if (currentStep === STAGE_2_INTRO) {
      completed = 5;
    }

    // Ensure final step reaches 100%
    if (currentStep === STAGE_2_END) return 100;
    return (completed / TOTAL_FIELD_STEPS) * 100;
  };

  const getCurrentStage = () => currentStep <= STAGE_1_END ? 1 : 2;

  // --- Background components ---
  const BackgroundLogos = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <img src={logoFormWhite.src} alt="" loading="lazy" className="absolute top-[3%] right-[-8%] sm:right-[3%] w-[180px] sm:w-[300px] lg:w-[400px] h-auto opacity-[0.04] sm:opacity-[0.05]" aria-hidden="true" />
      <img src={logoFormColor.src} alt="" loading="lazy" className="absolute top-[8%] left-[-12%] sm:left-[-5%] w-[160px] sm:w-[250px] lg:w-[320px] h-auto opacity-[0.025] sm:opacity-[0.035] rotate-[-10deg]" aria-hidden="true" />
      <img src={logoFormWhite.src} alt="" loading="lazy" className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[500px] lg:w-[700px] h-auto opacity-[0.025] sm:opacity-[0.035]" aria-hidden="true" />
      <img src={logoFormWhite.src} alt="" loading="lazy" className="absolute bottom-[12%] left-[-10%] sm:left-[2%] w-[200px] sm:w-[280px] lg:w-[350px] h-auto opacity-[0.04] sm:opacity-[0.05] rotate-[-15deg]" aria-hidden="true" />
      <img src={logoFormColor.src} alt="" loading="lazy" className="absolute bottom-[5%] right-[-8%] sm:right-[5%] w-[180px] sm:w-[260px] lg:w-[330px] h-auto opacity-[0.02] sm:opacity-[0.03] rotate-[12deg]" aria-hidden="true" />
    </div>
  );

  const ChevronPattern = () => (
    <svg className="absolute inset-0 w-full h-full opacity-[0.015] sm:opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="chevrons" x="0" y="0" width="60" height="40" patternUnits="userSpaceOnUse">
          <polyline points="0,20 30,0 60,20" fill="none" stroke="white" strokeWidth="1" />
          <polyline points="0,40 30,20 60,40" fill="none" stroke="white" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#chevrons)" />
    </svg>
  );

  // --- Animation ---
  const variants = {
    enter: (dir: "forward" | "back") => ({ opacity: 0, y: dir === "forward" ? 20 : -20 }),
    center: { opacity: 1, y: 0 },
    exit: (dir: "forward" | "back") => ({ opacity: 0, y: dir === "forward" ? -20 : 20 }),
  };

  // --- Shared input styles ---
  const inputClass = "w-full bg-transparent border-0 border-b-2 border-white/30 focus:border-white rounded-none px-1 py-3.5 sm:py-4 text-[16px] sm:text-lg text-white placeholder:text-white/45 focus:ring-0 focus:outline-none transition-all duration-300";
  const labelClass = "text-white/80 text-sm font-medium mb-1.5 block";
  const fieldGroupClass = "space-y-5 sm:space-y-6";

  const FieldError = ({ field }: { field: keyof FormData }) => {
    const err = errors[field];
    if (!err) return null;
    return (
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[hsl(var(--burgundy-glow))] text-sm mt-1.5">
        {translateError(err.message as string)}
      </motion.p>
    );
  };

  // Radio option component
  const RadioOption = ({ field, value, label, onReselect }: { field: keyof FormData; value: string; label: string; onReselect?: () => void }) => {
    const current = watch(field) as string;
    const isSelected = current === value;
    return (
      <label
        onClick={() => {
          if (isSelected && onReselect && !isNavigatingRef.current) {
            if (autoAdvanceTimerRef.current) {
              clearTimeout(autoAdvanceTimerRef.current);
            }
            autoAdvanceTimerRef.current = setTimeout(() => {
              autoAdvanceTimerRef.current = null;
              onReselect();
            }, 350);
          }
        }}
        className={`flex items-center gap-4 p-4 sm:p-5 rounded-xl border cursor-pointer transition-all duration-200 active:scale-[0.98] min-h-[52px] ${isSelected ? "border-white/50 bg-white/10" : "border-white/25 hover:border-white/40 hover:bg-white/5"
          }`}
      >
        <RadioGroupItem value={value} className="border-white/50 text-white min-w-[22px] min-h-[22px]" />
        <span className="text-white text-[15px] sm:text-base leading-snug">{label}</span>
      </label>
    );
  };

  // Handle radio auto-advance for single-radio steps
  const handleRadioChange = (field: keyof FormData, value: string, step: number) => {
    setValue(field, value);
    if (autoAdvanceSteps.includes(step)) {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
      autoAdvanceTimerRef.current = setTimeout(() => {
        autoAdvanceTimerRef.current = null;
        nextStep();
      }, 350);
    }
  };

  // --- Render step content ---
  const renderStepContent = () => {
    switch (currentStep) {
      case STAGE_1_INTRO:
        return null;

      // ===== STEP 1: Informações Iniciais =====
      case 1:
        return (
          <div className={fieldGroupClass}>
            <StepHeader title={t("form.step1.header")} />
            <div>
              <label className={labelClass}>{t("form.step1.name.label")}</label>
              <Input {...register("athleteName")} placeholder={t("form.step1.name.placeholder")} className={inputClass} autoFocus />
              <FieldError field="athleteName" />
            </div>
            <div>
              <label className={labelClass}>{t("form.step1.birth.label")}</label>
              <Input {...register("birthDate")} type="date" className={`${inputClass} [color-scheme:dark]`} />
              <FieldError field="birthDate" />
            </div>
            <div>
              <label className={labelClass}>{t("form.step1.whatsapp.label")}</label>
              <FormPhoneInput
                value={watch("whatsapp")}
                onChange={(v) => setValue("whatsapp", v, { shouldValidate: true })}
                placeholder="(11) 99999-9999"
              />
              <FieldError field="whatsapp" />
            </div>
            <div>
              <label className={labelClass}>{t("form.step1.schoolYear.label")}</label>
              <Select
                value={watch("schoolYear")}
                onValueChange={(v) => setValue("schoolYear", v, { shouldValidate: true })}
              >
                <SelectTrigger className="w-full bg-transparent border-0 border-b-2 border-white/30 data-[state=open]:border-white rounded-none px-1 py-3.5 sm:py-4 text-[16px] sm:text-lg text-white ring-0 outline-none focus:ring-0 h-auto shadow-none">
                  <SelectValue placeholder={t("form.step1.schoolYear.placeholder")} className="text-white/45" />
                </SelectTrigger>
                <SelectContent className="bg-[hsl(220,40%,10%)] border-white/15 text-white rounded-xl shadow-2xl">
                  {[
                    { value: "before_7th",          label: t("form.step1.schoolYear.opt_before_7th") },
                    { value: "8th_grade",            label: t("form.step1.schoolYear.opt_8th") },
                    { value: "9th_grade",            label: t("form.step1.schoolYear.opt_9th") },
                    { value: "hs_1st",               label: t("form.step1.schoolYear.opt_hs1") },
                    { value: "hs_2nd",               label: t("form.step1.schoolYear.opt_hs2") },
                    { value: "hs_3rd",               label: t("form.step1.schoolYear.opt_hs3") },
                    { value: "graduated_last_year",  label: t("form.step1.schoolYear.opt_grad_last") },
                    { value: "graduated_2plus",      label: t("form.step1.schoolYear.opt_grad_2plus") },
                  ].map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-white/85 focus:bg-white/10 focus:text-white cursor-pointer text-[15px] py-3"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError field="schoolYear" />
            </div>
          </div>
        );

      // ===== STEP 2: Base Educacional =====
      case 2:
        return (
          <div className={fieldGroupClass}>
            <StepHeader title={t("form.step2.header")} />
            <div>
              <label className={labelClass}>{t("form.step2.school.label")}</label>
              <Input {...register("currentSchool")} placeholder={t("form.step2.school.placeholder")} className={inputClass} autoFocus />
              <FieldError field="currentSchool" />
            </div>
            <div>
              <label className={labelClass}>{t("form.step2.cityState.label")}</label>
              <Input {...register("cityState")} placeholder={t("form.step2.cityState.placeholder")} className={inputClass} />
              <FieldError field="cityState" />
            </div>
            <div>
              <label className={labelClass}>{t("form.step2.educationModel.label")}</label>
              <RadioGroup
                onValueChange={(v) => setValue("educationalModel", v)}
                value={watch("educationalModel")}
                className="space-y-2.5"
              >
                {([
                  { value: "Bilíngue",      label: t("form.step2.educationModel.bilingual") },
                  { value: "Internacional", label: t("form.step2.educationModel.international") },
                  { value: "Tradicional",   label: t("form.step2.educationModel.traditional") },
                  { value: "Outro",         label: t("form.step2.educationModel.other") },
                ] as const).map(opt => (
                  <RadioOption key={opt.value} field="educationalModel" value={opt.value} label={opt.label} />
                ))}
              </RadioGroup>
              <FieldError field="educationalModel" />
            </div>
          </div>
        );

      // ===== STEP 3: Trajetória Esportiva =====
      case 3:
        return (
          <div className={fieldGroupClass}>
            <StepHeader title={t("form.step3.header")} />
            <div>
              <label className={labelClass}>{t("form.step3.position.label")}</label>
              <Input {...register("position")} placeholder={t("form.step3.position.placeholder")} className={inputClass} autoFocus />
              <FieldError field="position" />
            </div>
            <div>
              <label className={labelClass}>{t("form.step3.clubs.label")}</label>
              <Textarea
                {...register("clubHistory")}
                placeholder={t("form.step3.clubs.placeholder")}
                className="w-full bg-white/5 border border-white/25 focus:border-white/40 rounded-xl px-4 py-4 text-[16px] sm:text-lg text-white placeholder:text-white/45 focus:ring-0 focus:outline-none transition-all duration-300 min-h-[100px] resize-none"
              />
              <FieldError field="clubHistory" />
            </div>
            <div>
              <label className={labelClass}>
                {t("form.step3.achievements.label")} <span className="text-white/40">({t("form.optional")})</span>
              </label>
              <Textarea
                {...register("achievements")}
                placeholder={t("form.step3.achievements.placeholder")}
                className="w-full bg-white/5 border border-white/25 focus:border-white/40 rounded-xl px-4 py-4 text-[16px] sm:text-lg text-white placeholder:text-white/45 focus:ring-0 focus:outline-none transition-all duration-300 min-h-[80px] resize-none"
              />
            </div>
            <div>
              <label className={labelClass}>
                {t("form.step3.instagram.label")} <span className="text-white/40">({t("form.optional")})</span>
              </label>
              <Input {...register("instagram")} placeholder={t("form.step3.instagram.placeholder")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>
                {t("form.step3.video.label")} <span className="text-white/40">({t("form.optional")})</span>
              </label>
              <Input
                {...register("videoHighlights")}
                type="url"
                placeholder={t("form.step3.video.placeholder")}
                className={inputClass}
              />
              <FieldError field="videoHighlights" />
              <p className="text-white/40 text-xs mt-1.5">
                {t("form.step3.video.helper")}
              </p>
            </div>
          </div>
        );

      // ===== STEP 4: Momento de Início =====
      case 4:
        return (
          <div className={fieldGroupClass}>
            <StepHeader title={t("form.step4.header")} />
            <h2 className="text-white text-lg sm:text-xl font-semibold leading-snug">
              {t("form.step4.question")}
            </h2>
            <RadioGroup
              onValueChange={(v) => handleRadioChange("startTiming", v, 4)}
              value={watch("startTiming")}
              className="space-y-2.5"
            >
              {([
                { value: "Próximo ano letivo",              label: t("form.step4.nextYear") },
                { value: "Em até 2 anos",                   label: t("form.step4.twoYears") },
                { value: "Apenas avaliando possibilidades", label: t("form.step4.exploring") },
                { value: "Ainda sem definição",             label: t("form.step4.undefined") },
              ] as const).map(opt => (
                <RadioOption key={opt.value} field="startTiming" value={opt.value} label={opt.label} onReselect={() => nextStep()} />
              ))}
            </RadioGroup>
            <FieldError field="startTiming" />
          </div>
        );

      // ===== STEP 5: Direção do Projeto =====
      case 5:
        return (
          <div className={fieldGroupClass}>
            <StepHeader title={t("form.step5.header")} />
            <h2 className="text-white text-lg sm:text-xl font-semibold leading-snug">
              {t("form.step5.question")}
            </h2>
            <RadioGroup
              onValueChange={(v) => handleRadioChange("projectDirection", v, 5)}
              value={watch("projectDirection")}
              className="space-y-2.5"
            >
              {([
                { value: "Formação acadêmica de excelência",         label: t("form.step5.academic") },
                { value: "Planejamento universitário estruturado",   label: t("form.step5.university") },
                { value: "Desenvolvimento esportivo consistente",    label: t("form.step5.sports") },
                { value: "Formação humana com visão de longo prazo", label: t("form.step5.human") },
                { value: "Integração entre todos os pilares",        label: t("form.step5.integrated") },
              ] as const).map(opt => (
                <RadioOption key={opt.value} field="projectDirection" value={opt.value} label={opt.label} onReselect={() => nextStep()} />
              ))}
            </RadioGroup>
            <FieldError field="projectDirection" />
          </div>
        );

      // ===== STAGE 2 INTRO =====
      case STAGE_2_INTRO:
        return (
          <div className="space-y-5 sm:space-y-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <div className="h-5 sm:h-7 w-1 bg-gradient-to-b from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] rounded-full" />
              <span className="text-white/60 text-xs sm:text-sm font-medium uppercase tracking-wider">
                {t("form.stage2.badge")}
              </span>
            </div>
            <h1 className="text-[1.4rem] sm:text-2xl lg:text-3xl font-bold text-white leading-tight">
              {t("form.stage2.title1")}{" "}
              <span className="text-[hsl(var(--burgundy-glow))]">{t("form.stage2.title2")}</span>
            </h1>
            <div className="space-y-4 text-white/70 text-[15px] sm:text-base leading-relaxed">
              <p>{t("form.stage2.line1")}</p>
              <p>{t("form.stage2.line2")}</p>
            </div>
            <Button
              type="button"
              onClick={nextStep}
              className="w-full bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] text-white border-0 px-6 py-5 sm:py-6 text-[16px] sm:text-lg font-semibold hover:opacity-90 transition-all duration-300 active:scale-[0.98] min-h-[56px] rounded-xl shadow-lg shadow-[hsl(var(--burgundy)/0.3)] mt-4"
            >
              {t("form.stage2.cta")}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        );

      // ===== STEP 7: Base Acadêmica =====
      case 7:
        return (
          <div className={fieldGroupClass}>
            <StepHeader title={t("form.step7.header")} />
            <div>
              <label className={labelClass}>{t("form.step7.performance.label")}</label>
              <RadioGroup
                onValueChange={(v) => setValue("academicPerformance", v)}
                value={watch("academicPerformance")}
                className="space-y-2.5"
              >
                {([
                  { value: "Alto e consistente",              label: t("form.step7.performance.high") },
                  { value: "Bom com potencial de evolução",   label: t("form.step7.performance.good") },
                  { value: "Mediano, mas comprometido",       label: t("form.step7.performance.average") },
                  { value: "Necessita redirecionamento acadêmico", label: t("form.step7.performance.needs") },
                ] as const).map(opt => (
                  <RadioOption key={opt.value} field="academicPerformance" value={opt.value} label={opt.label} />
                ))}
              </RadioGroup>
              <FieldError field="academicPerformance" />
            </div>
            <div className="pt-2">
              <label className={labelClass}>{t("form.step7.english.label")}</label>
              <RadioGroup
                onValueChange={(v) => setValue("englishLevel", v)}
                value={watch("englishLevel")}
                className="space-y-2.5"
              >
                {([
                  { value: "Fluente",       label: t("form.step7.english.fluent") },
                  { value: "Avançado",      label: t("form.step7.english.advanced") },
                  { value: "Intermediário", label: t("form.step7.english.intermediate") },
                  { value: "Básico",        label: t("form.step7.english.basic") },
                ] as const).map(opt => (
                  <RadioOption key={opt.value} field="englishLevel" value={opt.value} label={opt.label} />
                ))}
              </RadioGroup>
              <FieldError field="englishLevel" />
            </div>
          </div>
        );

      // ===== STEP 8: Perfil Comportamental =====
      case 8:
        return (
          <div className={fieldGroupClass}>
            <StepHeader title={t("form.step8.header")} />
            <h2 className="text-white text-lg sm:text-xl font-semibold leading-snug">
              {t("form.step8.question")}
            </h2>
            <RadioGroup
              onValueChange={(v) => handleRadioChange("behavioralProfile", v, 8)}
              value={watch("behavioralProfile")}
              className="space-y-2.5"
            >
              {([
                { value: "Preparado para avançar",                        label: t("form.step8.ready") },
                { value: "Interessado, com necessidade de orientação",    label: t("form.step8.interested") },
                { value: "Está conhecendo melhor essa possibilidade",     label: t("form.step8.exploring") },
              ] as const).map(opt => (
                <RadioOption key={opt.value} field="behavioralProfile" value={opt.value} label={opt.label} onReselect={() => nextStep()} />
              ))}
            </RadioGroup>
            <FieldError field="behavioralProfile" />
          </div>
        );

      // ===== STEP 9: Comprometimento =====
      case 9:
        return (
          <div className={fieldGroupClass}>
            <StepHeader title={t("form.step9.header")} />
            <h2 className="text-white text-lg sm:text-xl font-semibold leading-snug">
              {t("form.step9.question")}
            </h2>
            <RadioGroup
              onValueChange={(v) => handleRadioChange("youthCommitment", v, 9)}
              value={watch("youthCommitment")}
              className="space-y-2.5"
            >
              {([
                { value: "Sim, demonstra iniciativa",            label: t("form.step9.initiative") },
                { value: "Sim, mas precisa de direcionamento",   label: t("form.step9.guidance") },
                { value: "Ainda em processo de maturação",       label: t("form.step9.maturing") },
              ] as const).map(opt => (
                <RadioOption key={opt.value} field="youthCommitment" value={opt.value} label={opt.label} onReselect={() => nextStep()} />
              ))}
            </RadioGroup>
            <FieldError field="youthCommitment" />
          </div>
        );

      // ===== STEP 10: Decisão Familiar =====
      case 10:
        return (
          <div className={fieldGroupClass}>
            <StepHeader title={t("form.step10.header")} />
            <h2 className="text-white text-lg sm:text-xl font-semibold leading-snug">
              {t("form.step10.question")}
            </h2>
            <RadioGroup
              onValueChange={(v) => handleRadioChange("familyDecision", v, 10)}
              value={watch("familyDecision")}
              className="space-y-2.5"
            >
              {([
                {
                  value: "É uma decisão amadurecida ao longo do tempo, já integrada ao planejamento familiar",
                  label: t("form.step10.mature"),
                },
                {
                  value: "É uma decisão recente, mas com intenção clara de avançar",
                  label: t("form.step10.recent"),
                },
                {
                  value: "Estamos conhecendo melhor essa possibilidade antes de decidir",
                  label: t("form.step10.exploring"),
                },
              ] as const).map(opt => (
                <RadioOption key={opt.value} field="familyDecision" value={opt.value} label={opt.label} onReselect={() => nextStep()} />
              ))}
            </RadioGroup>
            <FieldError field="familyDecision" />
          </div>
        );

      // ===== STEP 11: Estrutura Estratégica =====
      case 11: {
        const investmentRanges = [
          { value: "15k-20k",  label: t("form.step11.range1") },
          { value: "20k-30k",  label: t("form.step11.range2") },
          { value: "30k-40k",  label: t("form.step11.range3") },
          { value: "40k-50k",  label: t("form.step11.range4") },
          { value: "50k-70k",  label: t("form.step11.range5") },
          { value: "over-70k", label: t("form.step11.range6") },
        ];
        return (
          <div className={fieldGroupClass}>
            <StepHeader title={t("form.step11.header")} />
            <p className="text-white/70 text-sm leading-relaxed">
              {t("form.step11.desc1")}
            </p>
            <p className="text-white/60 text-[13px] leading-relaxed">
              {t("form.step11.desc2")}
            </p>
            <h2 className="text-white text-lg sm:text-xl font-semibold leading-snug pt-2">
              {t("form.step11.question")}
            </h2>
            <p className="text-white/40 text-xs italic">{t("form.step11.helper")}</p>
            <RadioGroup
              onValueChange={(v) => handleRadioChange("investmentRange", v, 11)}
              value={watch("investmentRange")}
              className="space-y-2.5"
            >
              {investmentRanges.map(r => (
                <RadioOption key={r.value} field="investmentRange" value={r.value} label={r.label} onReselect={() => nextStep()} />
              ))}
            </RadioGroup>
            <p className="text-white/40 text-[11px] text-center pt-2">
              {t("form.step11.footer")}
            </p>
            <FieldError field="investmentRange" />
          </div>
        );
      }

      // ===== STEP 12: Responsável Legal =====
      case 12:
        return (
          <div className={fieldGroupClass}>
            <StepHeader title={t("form.step12.header")} />
            <div>
              <label className={labelClass}>{t("form.step12.name.label")}</label>
              <Input {...register("guardianName")} placeholder={t("form.step12.name.placeholder")} className={inputClass} autoFocus />
              <FieldError field="guardianName" />
            </div>
            <div>
              <label className={labelClass}>{t("form.step12.profession.label")}</label>
              <Input {...register("guardianProfession")} placeholder={t("form.step12.profession.placeholder")} className={inputClass} />
              <FieldError field="guardianProfession" />
            </div>
            <div>
              <label className={labelClass}>{t("form.step12.phone.label")}</label>
              <FormPhoneInput
                value={watch("guardianWhatsapp")}
                onChange={(v) => setValue("guardianWhatsapp", v, { shouldValidate: true })}
                placeholder="(11) 99999-9999"
              />
              <FieldError field="guardianWhatsapp" />
            </div>
            <div>
              <label className={labelClass}>{t("form.step12.email.label")}</label>
              <Input {...register("guardianEmail")} type="email" placeholder={t("form.step12.email.placeholder")} className={inputClass} />
              <FieldError field="guardianEmail" />
            </div>
          </div>
        );

      // ===== STEP 13: Endereço Residencial (FINAL STEP WITH SUBMIT) =====
      case 13:
        return (
          <div className={fieldGroupClass}>
            <StepHeader title={t("form.step13.header")} />

            {/* País */}
            <div>
              <label className={labelClass}>{t("form.step13.country.label")}</label>
              <CountrySelect
                value={watch("country") || "BR"}
                onChange={(v) => setValue("country", v, { shouldValidate: true })}
              />
              <FieldError field="country" />
            </div>

            {watch("country") === "BR" ? (
              <>
                <div>
                  <label className={labelClass}>{t("form.step13.cep.label")}</label>
                  <Input
                    {...register("addressCep")}
                    placeholder={t("form.step13.cep.placeholder")}
                    className={inputClass}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, "");
                      if (v.length > 8) v = v.slice(0, 8);
                      if (v.length > 5) {
                        v = v.replace(/^(\d{5})(\d)/, "$1-$2");
                      }
                      setValue("addressCep", v, { shouldValidate: true });
                      if (v.replace("-", "").length === 8) {
                        fetchAddressByCep(v);
                      }
                    }}
                    disabled={isFetchingCep}
                  />
                  {isFetchingCep && (
                    <p className="text-white/50 text-xs mt-1.5 flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {t("form.step13.cep.searching")}
                    </p>
                  )}
                  {cepError && (
                    <p className="text-[hsl(var(--burgundy-glow))] text-sm mt-1.5">{cepError}</p>
                  )}
                  <FieldError field="addressCep" />
                </div>

                <div>
                  <label className={labelClass}>{t("form.step13.street.label")}</label>
                  <Input
                    {...register("addressStreet")}
                    placeholder={t("form.step13.street.placeholder")}
                    className={inputClass}
                    disabled={isFetchingCep}
                  />
                  <FieldError field="addressStreet" />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className={labelClass}>{t("form.step13.number.label")}</label>
                    <Input
                      {...register("addressNumber")}
                      placeholder={t("form.step13.number.placeholder")}
                      className={inputClass}
                      disabled={isFetchingCep}
                    />
                    <FieldError field="addressNumber" />
                  </div>
                  <div>
                    <label className={labelClass}>
                      {t("form.step13.complement.label")} <span className="text-white/40">({t("form.optional")})</span>
                    </label>
                    <Input
                      {...register("addressComplement")}
                      placeholder={t("form.step13.complement.placeholder")}
                      className={inputClass}
                      disabled={isFetchingCep}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>{t("form.step13.neighborhood.label")}</label>
                  <Input
                    {...register("addressNeighborhood")}
                    placeholder={t("form.step13.neighborhood.placeholder")}
                    className={inputClass}
                    disabled={isFetchingCep}
                  />
                  <FieldError field="addressNeighborhood" />
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-3 sm:gap-4">
                  <div>
                    <label className={labelClass}>{t("form.step13.city.label")}</label>
                    <Input
                      {...register("addressCity")}
                      placeholder={t("form.step13.city.placeholder")}
                      className={inputClass}
                      disabled={isFetchingCep}
                    />
                    <FieldError field="addressCity" />
                  </div>
                  <div className="w-20 sm:w-24">
                    <label className={labelClass}>{t("form.step13.state.label")}</label>
                    <Input
                      {...register("addressState")}
                      placeholder={t("form.step13.state.placeholder")}
                      className={`${inputClass} text-center`}
                      disabled={isFetchingCep}
                    />
                    <FieldError field="addressState" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={labelClass}>{t("form.step13.city.label")}</label>
                  <Input
                    {...register("addressCity")}
                    placeholder={t("form.step13.city.placeholder")}
                    className={inputClass}
                  />
                  <FieldError field="addressCity" />
                </div>

                <div>
                  <label className={labelClass}>
                    {t("form.step13.postalCode.label")} <span className="text-white/40">({t("form.optional")})</span>
                  </label>
                  <Input
                    {...register("addressCep")}
                    placeholder={t("form.step13.postalCode.placeholder")}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    {t("form.step13.address.label")} <span className="text-white/40">({t("form.optional")})</span>
                  </label>
                  <Input
                    {...register("addressStreet")}
                    placeholder={t("form.step13.address.placeholder")}
                    className={inputClass}
                  />
                </div>
              </>
            )}

            {submissionError && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-300 text-sm font-medium">{t("form.error.title")}</p>
                  <p className="text-red-300/70 text-xs mt-0.5">{submissionError}</p>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Step header component
  const StepHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 sm:gap-3 mb-1">
      <div className="h-4 sm:h-6 w-1 bg-gradient-to-b from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] rounded-full" />
      <span className="text-white/80 text-xs sm:text-sm font-medium uppercase tracking-wider">{title}</span>
    </div>
  );

  // Get button config for current step
  const getNavConfig = () => {
    const isIntro = currentStep === STAGE_1_INTRO || currentStep === STAGE_2_INTRO;
    const isLastStep = currentStep === STAGE_2_END;
    const isSingleRadio = autoAdvanceSteps.includes(currentStep);
    const showBack = currentStep > STAGE_1_START && currentStep !== STAGE_1_INTRO;
    const showNext = !isIntro && !isLastStep && !isSingleRadio;
    const showSubmit = isLastStep;
    const isStage1Last = currentStep === STAGE_1_END;
    const nextLabel = isStage1Last ? t("form.nav.proceed") : t("form.nav.confirm");

    return { showBack, showNext, showSubmit, nextLabel };
  };

  // ===== WELCOME INTRO =====
  if (showIntro) {
    return (
      <div className="min-h-[100dvh] relative flex flex-col overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--navy-deep))] via-[hsl(var(--navy-medium))] to-[hsl(var(--burgundy)/0.3)]" />
        <BackgroundLogos />
        <ChevronPattern />
        <header className="relative z-50 flex-shrink-0 py-4 sm:py-5 px-5 sm:px-8">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center touch-manipulation">
              <img src={logoWhite.src} alt="Bolsa Atleta USA" className="h-9 sm:h-11 w-auto" />
            </Link>
            <div className="flex items-center gap-3 sm:gap-4">
              <LanguageSelector variant="dark" size="default" />
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-white/60">
                <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{t("header.protectedData")}</span>
              </div>
            </div>
          </div>
        </header>
        <main className="relative z-10 flex-1 flex flex-col justify-center px-5 sm:px-8 py-6 sm:py-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="w-full max-w-lg mx-auto"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
              <div className="h-5 sm:h-7 w-1 bg-gradient-to-b from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] rounded-full" />
              <span className="text-white/60 text-xs sm:text-sm font-medium uppercase tracking-wider">
                {t("form.welcome.badge")}
              </span>
            </div>

            <h1 className="text-[1.5rem] sm:text-3xl font-bold text-white mb-5 sm:mb-6 leading-tight">
              {t("form.welcome.title1")}<br />
              <span className="text-[hsl(var(--burgundy-glow))]">{t("form.welcome.title2")}</span>
            </h1>

            <div className="space-y-4 text-white/70 text-[15px] sm:text-base leading-relaxed mb-8 sm:mb-10">
              <p>{t("form.welcome.line1")}</p>
              <p>
                {t("form.welcome.line2")} <strong className="text-white/90">{t("form.welcome.line2Bold")}</strong>
              </p>
              <p>{t("form.welcome.line3")}</p>
              <p>{t("form.welcome.line4")}</p>
            </div>

            <Button
              onClick={() => {
                setShowIntro(false);
                if (currentStep === STAGE_1_INTRO) {
                  setCurrentStep(STAGE_1_START);
                }
              }}
              className="w-full bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] text-white border-0 px-6 py-5 sm:py-6 text-[16px] sm:text-lg font-semibold hover:opacity-90 transition-all duration-300 active:scale-[0.98] min-h-[56px] sm:min-h-[60px] rounded-xl shadow-lg shadow-[hsl(var(--burgundy)/0.3)]"
            >
              {t("form.welcome.cta")}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </motion.div>
        </main>
        <footer className="relative z-10 flex-shrink-0 py-4 sm:py-5 px-5 sm:px-8 pb-[max(env(safe-area-inset-bottom),16px)]">
          <p className="text-white/40 text-[11px] sm:text-xs text-center flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3" />
            {t("form.welcome.footer")}
          </p>
        </footer>
      </div>
    );
  }

  // ===== COMPLETION SCREEN =====
  if (isComplete) {
    return (
      <div className="min-h-[100dvh] relative flex items-center justify-center p-5 sm:p-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--navy-deep))] via-[hsl(var(--navy-medium))] to-[hsl(var(--burgundy)/0.3)]" />
        <BackgroundLogos />
        <ChevronPattern />
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="relative z-10 w-full max-w-[420px] sm:max-w-xl"
        >
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 180, damping: 15 }}
            className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-5 sm:mb-6 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center"
          >
            <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400" />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-[1.5rem] sm:text-2xl font-bold text-white mb-6 text-center"
          >
            {t("form.success.title")}
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-white/70 text-[15px] sm:text-base leading-[1.7] space-y-4 mb-8 text-left px-1"
          >
            <p>{t("form.success.line1")}</p>

            <p>{t("form.success.line2")}</p>

            <p className="text-white/80 font-medium pt-4">{t("form.success.team")}</p>
          </motion.div>


          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            onClick={handleEditResponse}
            className="block mx-auto text-white/40 hover:text-white/70 text-sm underline underline-offset-4 transition-all duration-300 py-2 px-4"
          >
            {t("form.success.edit")}
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ===== MAIN FORM =====
  const nav = getNavConfig();

  return (
    <div className="fixed inset-0 flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--navy-deep))] via-[hsl(var(--navy-medium))] to-[hsl(var(--burgundy)/0.3)]" />
      <BackgroundLogos />
      <ChevronPattern />

      {/* Header */}
      <header className="relative z-50 flex-shrink-0 py-4 sm:py-5 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center touch-manipulation">
            <img src={logoWhite.src} alt="Bolsa Atleta USA" className="h-9 sm:h-11 w-auto" />
          </Link>
          {/* 2-stage progress */}
          <div className="flex items-center gap-2 sm:gap-3">
            {[1, 2].map(stage => (
              <div key={stage} className="flex flex-col items-center gap-1">
                <span className={`text-[10px] sm:text-xs font-medium ${getCurrentStage() >= stage ? "text-white/70" : "text-white/30"}`}>
                  {stage === 1 ? t("form.stage1Badge") : t("form.stage2Badge")}
                </span>
                <div className={`w-12 sm:w-20 h-1 rounded-full transition-all duration-500 ${getCurrentStage() > stage ? "bg-white" : getCurrentStage() === stage ? "bg-white/70" : "bg-white/20"
                  }`} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSelector variant="dark" size="default" />
            <div className="flex items-center gap-1.5 text-xs text-white/60">
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("header.protectedData")}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col px-5 sm:px-8 py-3 sm:py-6 overflow-y-auto">
        <div className="w-full max-w-2xl mx-auto mt-0 sm:my-auto">
          <form onSubmit={handleSubmit(onSubmit)} className="min-h-[400px] flex flex-col">
            {/* Content container with fixed height to prevent button jumping */}
            <div className="flex-1">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentStep}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  {renderStepContent()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Fixed navigation buttons container */}
            <div className="pt-6 sm:pt-8 min-h-[72px] flex items-center">
              <div className="flex items-center justify-between w-full gap-3">
                {nav.showBack ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={prevStep}
                    className="text-white/60 hover:text-white hover:bg-white/10 px-3 sm:px-4 py-2.5 touch-manipulation min-h-[48px]"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">{t("form.nav.back")}</span>
                  </Button>
                ) : <div />}

                {nav.showNext && (
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="flex-1 sm:flex-none bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] text-white border-0 px-5 sm:px-6 py-4 sm:py-5 text-[14px] sm:text-base font-semibold hover:opacity-90 transition-all duration-300 active:scale-[0.98] min-h-[52px] rounded-xl"
                  >
                    {nav.nextLabel}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}

                {nav.showSubmit && (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] text-white border-0 px-5 sm:px-6 py-4 sm:py-5 text-[14px] sm:text-base font-semibold hover:opacity-90 transition-all duration-300 active:scale-[0.98] min-h-[52px] rounded-xl shadow-lg shadow-[hsl(var(--burgundy)/0.3)]"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> {t("form.nav.submitting")}</>
                    ) : (
                      <>{t("form.nav.submit")} <ArrowRight className="ml-2 w-5 h-5" /></>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </main>

      {/* Footer Progress */}
      <footer className="relative z-10 flex-shrink-0 py-3 sm:py-5 px-5 sm:px-8 pb-[max(env(safe-area-inset-bottom),12px)]">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white/40 text-[11px] sm:text-xs">
              {getCurrentStage() === 1 ? t("form.stage1Badge") : t("form.stage2Badge")} {t("form.stageOf")} 2
            </span>
            <span className="text-white/40 text-[11px] sm:text-xs">
              {Math.round(getProgress())}{t("form.complete")}
            </span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${getProgress()}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <p className="text-white/40 text-[10px] sm:text-xs text-center mt-3 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3" />
            {t("form.welcome.footer")}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Forms;