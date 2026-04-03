"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  MapPin,
  Phone,
  Mail,
  Plus,
  MessageSquare,
  Video,
  Calendar,
  FileText,
  Loader2,
  Save,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { registrarContatoEscola, atualizarEscola } from "@/lib/actions/escolas";
import { toast } from "sonner";
import type { School, ScholarshipAggressiveness, SchoolSportInfluence } from "@/types/school";

interface ContatoEscola {
  id: string;
  escola_id: string;
  data_contato: string;
  tipo_contato: string;
  resumo: string;
  created_at: string;
}

interface SchoolDetailSheetProps {
  school: School;
  contatos: ContatoEscola[];
  open: boolean;
  onClose: () => void;
}

const TIPO_CONTATO_OPTIONS = [
  { value: "email", label: "E-mail", icon: Mail },
  { value: "ligacao", label: "Ligacao", icon: Phone },
  { value: "videochamada", label: "Videochamada", icon: Video },
  { value: "reuniao", label: "Reuniao Presencial", icon: Calendar },
  { value: "mensagem", label: "Mensagem", icon: MessageSquare },
  { value: "outro", label: "Outro", icon: FileText },
];

const STATUS_OPTIONS = [
  { value: "ativa", label: "Ativa" },
  { value: "inativa", label: "Inativa" },
  { value: "em_analise", label: "Em Analise" },
];

const INGLES_OPTIONS = [
  { value: "Basico", label: "Basico" },
  { value: "Basico-Intermediario", label: "Basico-Intermediario" },
  { value: "Intermediario", label: "Intermediario" },
  { value: "Avancado", label: "Avancado" },
  { value: "Fluente", label: "Fluente" },
];

const AGRESSIVIDADE_OPTIONS = [
  { value: "conservadora", label: "Conservadora" },
  { value: "moderada", label: "Moderada" },
  { value: "agressiva", label: "Agressiva" },
];

const INFLUENCIA_OPTIONS = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "decisiva", label: "Decisiva" },
];

const TEMPERATURA_OPTIONS = [
  { value: "frio", label: "Frio" },
  { value: "neutro", label: "Neutro" },
  { value: "bom", label: "Bom" },
  { value: "forte", label: "Forte" },
];

const inputClass =
  "w-full rounded-lg border border-[#1e2130] bg-[#0c0e16] px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30";
const selectClass =
  "w-full rounded-lg border border-[#1e2130] bg-[#0c0e16] px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500/50 focus:outline-none appearance-none";
const labelClass = "text-[10px] font-medium text-zinc-500 mb-1 block";

export function SchoolDetailSheet({
  school,
  contatos,
  open,
  onClose,
}: SchoolDetailSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"info" | "contatos">("info");
  const [isEditing, setIsEditing] = useState(false);

  // Contact form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    data: new Date().toISOString().slice(0, 10),
    tipo: "email",
    resumo: "",
  });

  // Editable school fields
  const [editData, setEditData] = useState({
    nome: school.name,
    status: school.status === "em_avaliacao" ? "em_analise" : school.status,
    budget_minimo_usd: school.min_budget_usd,
    budget_forte_usd: school.strong_budget_usd,
    ingles_minimo: school.min_english_level,
    agressividade_bolsa: school.scholarship_aggressiveness,
    influencia_esporte: school.sport_influence,
    temperatura_relacionamento: school.temperatura_relacionamento ?? "neutro",
    admissions_officer_nome: school.coach_name ?? "",
    admissions_officer_email: school.coach_email ?? "",
    admissions_officer_telefone: school.coach_phone ?? "",
    regra_pratica: school.practical_rule ?? "",
    notas_internas: school.notes ?? "",
    gpa_minimo: school.gpa_minimo ?? 0,
    rolling_admission: school.rolling_admission ?? false,
    serie_maxima: school.serie_maxima ?? "",
    deadline_fall: school.deadline_fall ?? "",
    deadline_spring: school.deadline_spring ?? "",
  });

  if (!open) return null;

  const handleSubmitContato = () => {
    if (!formData.resumo.trim()) {
      toast.error("Preencha o resumo do contato.");
      return;
    }

    startTransition(async () => {
      const result = await registrarContatoEscola(school.id, formData);
      if (result.success) {
        toast.success("Contato registrado com sucesso");
        setFormData({
          data: new Date().toISOString().slice(0, 10),
          tipo: "email",
          resumo: "",
        });
        setShowForm(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao registrar contato");
      }
    });
  };

  const handleSaveSchool = () => {
    startTransition(async () => {
      const result = await atualizarEscola(school.id, {
        nome: editData.nome,
        status: editData.status as "ativa" | "inativa" | "em_analise",
        budget_minimo_usd: editData.budget_minimo_usd,
        budget_forte_usd: editData.budget_forte_usd,
        ingles_minimo: editData.ingles_minimo,
        agressividade_bolsa: editData.agressividade_bolsa,
        influencia_esporte: editData.influencia_esporte,
        temperatura_relacionamento: editData.temperatura_relacionamento,
        admissions_officer_nome: editData.admissions_officer_nome || null,
        admissions_officer_email: editData.admissions_officer_email || null,
        admissions_officer_telefone: editData.admissions_officer_telefone || null,
        regra_pratica: editData.regra_pratica || null,
        notas_internas: editData.notas_internas || null,
        gpa_minimo: editData.gpa_minimo || null,
        rolling_admission: editData.rolling_admission,
        serie_maxima: editData.serie_maxima || null,
        deadline_fall: editData.deadline_fall || null,
        deadline_spring: editData.deadline_spring || null,
      } as Record<string, unknown>);
      if (result.success) {
        toast.success("Escola atualizada com sucesso");
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao atualizar escola");
      }
    });
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-[#1e2130] bg-[#0c0e16] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e2130] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{school.name}</h2>
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              <MapPin className="h-3 w-3" />
              {school.city}, {school.state}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 py-2 border-b border-[#1e2130]">
          <button
            onClick={() => setActiveTab("info")}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              activeTab === "info"
                ? "bg-indigo-600/20 text-indigo-300"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5",
            )}
          >
            Informacoes
          </button>
          <button
            onClick={() => setActiveTab("contatos")}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              activeTab === "contatos"
                ? "bg-indigo-600/20 text-indigo-300"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5",
            )}
          >
            Contatos ({contatos.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* TAB: INFORMACOES */}
          {activeTab === "info" && (
            <>
              {/* Edit toggle */}
              <div className="flex justify-end">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-500/20"
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="rounded-lg border border-[#1e2130] px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-white/5"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveSchool}
                      disabled={isPending}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                    >
                      {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Salvar
                    </button>
                  </div>
                )}
              </div>

              {/* School Info */}
              <div className="rounded-lg border border-[#1e2130] bg-[#141720] p-4 space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  Dados Principais
                </p>

                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Nome</label>
                      <input
                        value={editData.nome}
                        onChange={(e) => setEditData((p) => ({ ...p, nome: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Status</label>
                        <select
                          value={editData.status}
                          onChange={(e) => setEditData((p) => ({ ...p, status: e.target.value }))}
                          className={selectClass}
                        >
                          {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Temperatura</label>
                        <select
                          value={editData.temperatura_relacionamento}
                          onChange={(e) => setEditData((p) => ({ ...p, temperatura_relacionamento: e.target.value }))}
                          className={selectClass}
                        >
                          {TEMPERATURA_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] text-zinc-600">Status</p>
                      <p className="text-zinc-200 capitalize">{school.status.replace("_", " ")}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-600">Tipo</p>
                      <p className="text-zinc-200">{school.type}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-600">Temperatura</p>
                      <p className="text-zinc-200 capitalize">{school.temperatura_relacionamento ?? "neutro"}</p>
                    </div>
                    {school.gpa_minimo != null && school.gpa_minimo > 0 && (
                      <div>
                        <p className="text-[10px] text-zinc-600">GPA Minimo</p>
                        <p className="text-zinc-200">{school.gpa_minimo.toFixed(1)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Budget */}
              <div className="rounded-lg border border-[#1e2130] bg-[#141720] p-4 space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  Regras Financeiras
                </p>

                {isEditing ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Budget Minimo (USD)</label>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={editData.budget_minimo_usd}
                        onChange={(e) => setEditData((p) => ({ ...p, budget_minimo_usd: Number(e.target.value) }))}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Budget Forte (USD)</label>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={editData.budget_forte_usd}
                        onChange={(e) => setEditData((p) => ({ ...p, budget_forte_usd: Number(e.target.value) }))}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Agressividade Bolsa</label>
                      <select
                        value={editData.agressividade_bolsa}
                        onChange={(e) => setEditData((p) => ({ ...p, agressividade_bolsa: e.target.value as ScholarshipAggressiveness }))}
                        className={selectClass}
                      >
                        {AGRESSIVIDADE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Influencia Esportiva</label>
                      <select
                        value={editData.influencia_esporte}
                        onChange={(e) => setEditData((p) => ({ ...p, influencia_esporte: e.target.value as SchoolSportInfluence }))}
                        className={selectClass}
                      >
                        {INFLUENCIA_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] text-zinc-600">Budget Minimo</p>
                      <p className="text-amber-400 font-semibold">US$ {(school.min_budget_usd / 1000).toFixed(0)}k</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-600">Budget Forte</p>
                      <p className="text-emerald-400 font-semibold">US$ {(school.strong_budget_usd / 1000).toFixed(0)}k</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-600">Agressividade</p>
                      <p className="text-zinc-200 capitalize">{school.scholarship_aggressiveness}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-600">Influencia Esportiva</p>
                      <p className="text-zinc-200 capitalize">{school.sport_influence}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Academico */}
              <div className="rounded-lg border border-[#1e2130] bg-[#141720] p-4 space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  Academico e Prazos
                </p>

                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Ingles Minimo</label>
                        <select
                          value={editData.ingles_minimo}
                          onChange={(e) => setEditData((p) => ({ ...p, ingles_minimo: e.target.value }))}
                          className={selectClass}
                        >
                          {INGLES_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>GPA Minimo</label>
                        <input
                          type="number"
                          min={0}
                          max={4}
                          step={0.1}
                          value={editData.gpa_minimo}
                          onChange={(e) => setEditData((p) => ({ ...p, gpa_minimo: Number(e.target.value) }))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Serie Maxima</label>
                        <input
                          value={editData.serie_maxima}
                          onChange={(e) => setEditData((p) => ({ ...p, serie_maxima: e.target.value }))}
                          className={inputClass}
                          placeholder="Ex: 12th"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <input
                          type="checkbox"
                          checked={editData.rolling_admission}
                          onChange={(e) => setEditData((p) => ({ ...p, rolling_admission: e.target.checked }))}
                          className="h-4 w-4 rounded border-zinc-600 bg-[#141720] text-indigo-600 focus:ring-indigo-500/30"
                        />
                        <label className="text-xs text-zinc-400">Rolling Admission</label>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Deadline Fall</label>
                        <input
                          type="date"
                          value={editData.deadline_fall}
                          onChange={(e) => setEditData((p) => ({ ...p, deadline_fall: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Deadline Spring</label>
                        <input
                          type="date"
                          value={editData.deadline_spring}
                          onChange={(e) => setEditData((p) => ({ ...p, deadline_spring: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] text-zinc-600">Ingles Minimo</p>
                      <p className="text-zinc-200">{school.min_english_level}</p>
                    </div>
                    {school.serie_maxima && (
                      <div>
                        <p className="text-[10px] text-zinc-600">Serie Maxima</p>
                        <p className="text-zinc-200">{school.serie_maxima}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] text-zinc-600">Rolling Admission</p>
                      <p className="text-zinc-200">{school.rolling_admission ? "Sim" : "Nao"}</p>
                    </div>
                    {school.deadline_fall && (
                      <div>
                        <p className="text-[10px] text-zinc-600">Deadline Fall</p>
                        <p className="text-zinc-200">{new Date(school.deadline_fall).toLocaleDateString("pt-BR")}</p>
                      </div>
                    )}
                    {school.deadline_spring && (
                      <div>
                        <p className="text-[10px] text-zinc-600">Deadline Spring</p>
                        <p className="text-zinc-200">{new Date(school.deadline_spring).toLocaleDateString("pt-BR")}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Admissions Officer */}
              <div className="rounded-lg border border-[#1e2130] bg-[#141720] p-4 space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  Admissions Officer
                </p>

                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Nome</label>
                      <input
                        value={editData.admissions_officer_nome}
                        onChange={(e) => setEditData((p) => ({ ...p, admissions_officer_nome: e.target.value }))}
                        className={inputClass}
                        placeholder="Nome do officer"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>E-mail</label>
                        <input
                          type="email"
                          value={editData.admissions_officer_email}
                          onChange={(e) => setEditData((p) => ({ ...p, admissions_officer_email: e.target.value }))}
                          className={inputClass}
                          placeholder="email@school.edu"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Telefone</label>
                        <input
                          value={editData.admissions_officer_telefone}
                          onChange={(e) => setEditData((p) => ({ ...p, admissions_officer_telefone: e.target.value }))}
                          className={inputClass}
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                    </div>
                  </div>
                ) : school.coach_name ? (
                  <div>
                    <p className="text-sm font-medium text-white">{school.coach_name}</p>
                    {school.coach_email && (
                      <p className="mt-1 text-xs text-indigo-400">{school.coach_email}</p>
                    )}
                    {school.coach_phone && (
                      <p className="mt-0.5 text-xs text-zinc-400">{school.coach_phone}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-600">Nenhum officer cadastrado.</p>
                )}
              </div>

              {/* Regra pratica + notas */}
              <div className="rounded-lg border border-[#1e2130] bg-[#141720] p-4 space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  Regra BAUSA e Notas
                </p>

                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Regra Pratica BAUSA</label>
                      <textarea
                        value={editData.regra_pratica}
                        onChange={(e) => setEditData((p) => ({ ...p, regra_pratica: e.target.value }))}
                        rows={2}
                        className={cn(inputClass, "resize-none")}
                        placeholder="Regra pratica para esta escola..."
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Notas Internas</label>
                      <textarea
                        value={editData.notas_internas}
                        onChange={(e) => setEditData((p) => ({ ...p, notas_internas: e.target.value }))}
                        rows={3}
                        className={cn(inputClass, "resize-none")}
                        placeholder="Observacoes internas..."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {school.practical_rule && (
                      <div>
                        <p className="text-[10px] text-indigo-400 font-semibold mb-0.5">Regra BAUSA</p>
                        <p className="text-xs text-zinc-400 leading-relaxed">{school.practical_rule}</p>
                      </div>
                    )}
                    {school.notes && (
                      <div>
                        <p className="text-[10px] text-zinc-500 font-semibold mb-0.5">Notas</p>
                        <p className="text-xs text-zinc-400 leading-relaxed">{school.notes}</p>
                      </div>
                    )}
                    {!school.practical_rule && !school.notes && (
                      <p className="text-xs text-zinc-600">Sem regras ou notas.</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB: CONTATOS */}
          {activeTab === "contatos" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-white">
                  Timeline de Contatos
                </p>
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-500/20"
                >
                  <Plus className="h-3 w-3" />
                  Novo contato
                </button>
              </div>

              {/* Form */}
              {showForm && (
                <div className="mb-4 rounded-lg border border-indigo-500/20 bg-[#141720] p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Data</label>
                      <input
                        type="date"
                        value={formData.data}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, data: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Tipo</label>
                      <select
                        value={formData.tipo}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, tipo: e.target.value }))
                        }
                        className={selectClass}
                      >
                        {TIPO_CONTATO_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Resumo</label>
                    <textarea
                      value={formData.resumo}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, resumo: e.target.value }))
                      }
                      rows={3}
                      placeholder="Descreva o contato realizado..."
                      className={cn(inputClass, "resize-none")}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowForm(false)}
                      className="rounded-lg border border-[#1e2130] px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/5"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSubmitContato}
                      disabled={isPending}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
                    >
                      {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                      Salvar
                    </button>
                  </div>
                </div>
              )}

              {/* Timeline */}
              {contatos.length === 0 ? (
                <div className="rounded-lg border border-[#1e2130] bg-[#141720] px-4 py-8 text-center">
                  <MessageSquare className="mx-auto h-8 w-8 text-zinc-700 mb-2" />
                  <p className="text-xs text-zinc-500">
                    Nenhum contato registrado com esta escola.
                  </p>
                </div>
              ) : (
                <div className="relative space-y-0">
                  <div className="absolute left-3 top-2 bottom-2 w-px bg-[#1e2130]" />

                  {contatos.map((contato) => {
                    const tipoConfig = TIPO_CONTATO_OPTIONS.find(
                      (t) => t.value === contato.tipo_contato
                    );
                    const Icon = tipoConfig?.icon ?? FileText;

                    return (
                      <div key={contato.id} className="relative flex gap-3 py-2">
                        <div className="z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-[#1e2130] bg-[#141720]">
                          <Icon className="h-3 w-3 text-indigo-400" />
                        </div>
                        <div className="flex-1 rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-medium text-indigo-400">
                              {tipoConfig?.label ?? contato.tipo_contato}
                            </span>
                            <span className="text-[10px] text-zinc-600">
                              {new Date(contato.data_contato).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            {contato.resumo}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
