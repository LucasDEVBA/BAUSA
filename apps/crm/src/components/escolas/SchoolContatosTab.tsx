"use client";

import { useEffect, useId, useState, useTransition } from "react";
import {
  Calendar,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Video,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { listarContatosEscola, registrarContatoEscola } from "@/lib/actions/escolas";
import { formatarDataCurta, hojeIsoBrasilia } from "@/lib/escolas/apresentacao";
import type { ContatoEscola } from "@/types/school";
import { Button } from "@/components/ui";

import {
  TIPO_CONTATO_LABEL,
  TIPO_CONTATO_OPTIONS,
  TIPO_CONTATO_VALUES,
  isValorDe,
  type TipoContato,
} from "./school-options";

const ICONE_CONTATO: Readonly<Record<TipoContato, LucideIcon>> = {
  email: Mail,
  ligacao: Phone,
  videochamada: Video,
  reuniao: Calendar,
  mensagem: MessageSquare,
  outro: FileText,
};

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-placeholder focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30";
const labelClass = "mb-1 block text-[10px] font-medium text-muted-foreground";

interface SchoolContatosTabProps {
  escolaId: string;
  agoraMs: number;
  /** Chamado após registrar (atualiza "último contato" no card via router.refresh). */
  onRegistrado: () => void;
}

type EstadoLista =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; contatos: ContatoEscola[] };

/** Timeline de contatos com a escola — carrega e atualiza a PRÓPRIA lista. */
export function SchoolContatosTab({ escolaId, agoraMs, onRegistrado }: SchoolContatosTabProps) {
  const idBase = useId();
  const [lista, setLista] = useState<EstadoLista>({ fase: "carregando" });
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState<{ data: string; tipo: TipoContato; resumo: string }>(() => ({
    data: hojeIsoBrasilia(agoraMs),
    tipo: "email",
    resumo: "",
  }));
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    listarContatosEscola(escolaId)
      .then((r) => {
        if (!ativo) return;
        setLista(r.success ? { fase: "pronto", contatos: r.data } : { fase: "erro", mensagem: r.error });
      })
      .catch((e: unknown) => {
        console.error({ level: "error", action: "listar_contatos_escola_ui", escolaId, erro: String(e) });
        if (ativo) setLista({ fase: "erro", mensagem: "Falha de conexão ao carregar os contatos." });
      });
    return () => {
      ativo = false;
    };
  }, [escolaId, tentativa]);

  const salvar = () => {
    if (form.resumo.trim().length < 3) {
      setErroForm("Descreva o contato (mínimo de 3 caracteres).");
      return;
    }
    setErroForm(null);
    startSalvar(async () => {
      try {
        const r = await registrarContatoEscola(escolaId, form);
        if (!r.success) {
          setErroForm(r.error);
          return;
        }
        setLista((atual) =>
          atual.fase === "pronto"
            ? { fase: "pronto", contatos: [r.data, ...atual.contatos].sort((a, b) => b.data.localeCompare(a.data)) }
            : { fase: "pronto", contatos: [r.data] },
        );
        setForm({ data: hojeIsoBrasilia(agoraMs), tipo: "email", resumo: "" });
        setMostrarForm(false);
        toast.success("Contato registrado.");
        onRegistrado();
      } catch (e) {
        console.error({ level: "error", action: "registrar_contato_escola_ui", escolaId, erro: String(e) });
        setErroForm("Falha de conexão ao salvar. Tente de novo.");
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Timeline de contatos</h3>
        <Button variant="secondary" size="sm" onClick={() => setMostrarForm((v) => !v)} aria-expanded={mostrarForm}>
          <Plus aria-hidden />
          Novo contato
        </Button>
      </div>

      {mostrarForm && (
        <div className="space-y-3 rounded-lg border border-primary/20 bg-card/60 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${idBase}-data`} className={labelClass}>Data</label>
              <input
                id={`${idBase}-data`}
                type="date"
                value={form.data}
                max={hojeIsoBrasilia(agoraMs)}
                onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor={`${idBase}-tipo`} className={labelClass}>Tipo</label>
              <select
                id={`${idBase}-tipo`}
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoContato }))}
                className={cn(inputClass, "appearance-none")}
              >
                {TIPO_CONTATO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor={`${idBase}-resumo`} className={labelClass}>Resumo</label>
            <textarea
              id={`${idBase}-resumo`}
              value={form.resumo}
              onChange={(e) => setForm((f) => ({ ...f, resumo: e.target.value }))}
              rows={3}
              maxLength={2000}
              placeholder="Descreva o contato realizado…"
              aria-invalid={erroForm != null}
              aria-describedby={erroForm ? `${idBase}-erro` : undefined}
              className={cn(inputClass, "resize-none")}
            />
          </div>
          {erroForm && (
            <p id={`${idBase}-erro`} role="alert" className="text-xs font-medium text-destructive">{erroForm}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMostrarForm(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button size="sm" onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 aria-hidden className="animate-spin" />}
              Salvar contato
            </Button>
          </div>
        </div>
      )}

      {lista.fase === "carregando" && (
        <p className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
          <Loader2 aria-hidden className="size-3.5 animate-spin" /> Carregando contatos…
        </p>
      )}

      {lista.fase === "erro" && (
        <div role="alert" className="rounded-lg border border-sys-red/25 bg-sys-red/8 px-3 py-2 text-xs text-sys-red">
          {lista.mensagem}{" "}
          <button type="button" onClick={() => { setLista({ fase: "carregando" }); setTentativa((t) => t + 1); }} className="font-semibold underline">
            Tentar de novo
          </button>
        </div>
      )}

      {lista.fase === "pronto" && lista.contatos.length === 0 && (
        <div className="rounded-lg border border-border/70 bg-card/60 px-4 py-8 text-center">
          <MessageSquare aria-hidden className="mx-auto mb-2 size-8 text-label-tertiary" />
          <p className="text-xs text-muted-foreground">Nenhum contato registrado com esta escola.</p>
        </div>
      )}

      {lista.fase === "pronto" && lista.contatos.length > 0 && (
        <div className="relative">
          {/* Linha da timeline FORA do <ol>: lista só pode ter <li> como filho. */}
          <span aria-hidden className="absolute bottom-2 left-3 top-2 w-px bg-border" />
          <ol className="relative space-y-0">
            {lista.contatos.map((contato) => {
              // Tipo gravado fora do vocabulário da UI aparece cru, com ícone genérico.
              const tipoConhecido = isValorDe(TIPO_CONTATO_VALUES, contato.tipo) ? contato.tipo : null;
              const Icone = tipoConhecido ? ICONE_CONTATO[tipoConhecido] : FileText;
              return (
                <li key={contato.id} className="relative flex gap-3 py-2">
                  <span className="z-10 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                    <Icone aria-hidden className="size-3 text-primary" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2.5">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-medium text-primary">
                        {tipoConhecido ? TIPO_CONTATO_LABEL[tipoConhecido] : contato.tipo}
                      </span>
                      <time dateTime={contato.data} className="text-[10px] text-label-tertiary">
                        {formatarDataCurta(contato.data)}
                      </time>
                    </div>
                    <p className="whitespace-pre-line break-words text-xs leading-relaxed text-foreground">{contato.resumo}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
