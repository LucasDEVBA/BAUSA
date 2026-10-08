"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink, MapPin, Pencil, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  NAO_INFORMADO,
  STATUS_ESCOLA_TOM,
  formatarDataCurta,
  formatarLocalizacao,
  formatarUsd,
  hrefEmail,
  hrefExterno,
  rotulo,
} from "@/lib/escolas/apresentacao";
import type { School } from "@/types/school";
import { Badge, useConfirm } from "@/components/ui";

import {
  AGRESSIVIDADE_LABEL,
  INFLUENCIA_LABEL,
  INGLES_LABEL,
  PERFIL_LABEL,
  SERIE_LABEL,
  STATUS_LABEL,
  TEMPERATURA_LABEL,
  TIPO_LABEL,
} from "./school-options";
import { prenderTabNoDialogo, travarRolagemDoFundo } from "./prender-foco";
import { SchoolContatosTab } from "./SchoolContatosTab";
import { SchoolEditForm } from "./SchoolEditForm";

type Aba = "info" | "contatos";

interface SchoolDetailSheetProps {
  school: School;
  agoraMs: number;
  onClose: () => void;
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-border/70 bg-card/60 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">{titulo}</h3>
      {children}
    </section>
  );
}

function Campo({ titulo, valor }: { titulo: string; valor: string | null }) {
  const texto = valor ?? NAO_INFORMADO;
  const vazio = valor == null || valor === NAO_INFORMADO || valor === "—";
  return (
    <div className="min-w-0">
      <dt className="text-[10px] text-label-tertiary">{titulo}</dt>
      <dd className={cn("break-words text-sm", vazio ? "italic text-label-tertiary" : "text-foreground")}>{texto}</dd>
    </div>
  );
}

function InfoView({ school }: { school: School }) {
  const site = hrefExterno(school.website);
  const inscricao = hrefExterno(school.link_inscricao);
  const planoSaude = hrefExterno(school.link_plano_saude);
  const emailOfficer = hrefEmail(school.admissions_officer_email);
  const sim = (v: boolean) => (v ? "Sim" : "Não");

  return (
    <div className="space-y-4">
      <Secao titulo="Dados principais">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo titulo="Tipo" valor={TIPO_LABEL[school.tipo]} />
          <Campo titulo="Perfil" valor={school.perfil ? PERFIL_LABEL[school.perfil] : "Não classificado"} />
          <Campo titulo="Status" valor={STATUS_LABEL[school.status]} />
          <Campo titulo="Relacionamento" valor={rotulo(TEMPERATURA_LABEL, school.temperatura_relacionamento)} />
        </dl>
        {site ? (
          <a href={site} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80">
            <ExternalLink aria-hidden className="size-3.5" /> Site oficial
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        ) : (
          <p className="text-xs italic text-label-tertiary">Site oficial não informado.</p>
        )}
      </Secao>

      <Secao titulo="Links da escola">
        {inscricao || planoSaude ? (
          <div className="flex flex-wrap gap-2">
            {inscricao && (
              <a href={inscricao} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                <ExternalLink aria-hidden className="size-3.5" /> Abrir inscrição
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            )}
            {planoSaude && (
              <a href={planoSaude} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20">
                <ExternalLink aria-hidden className="size-3.5" /> Plano de saúde
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            )}
          </div>
        ) : (
          <p className="text-xs italic text-label-tertiary">Nenhum link cadastrado. Use Editar para adicionar.</p>
        )}
      </Secao>

      <Secao titulo="Regras financeiras">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo titulo="Budget mínimo (USD)" valor={school.budget_minimo_usd == null ? null : formatarUsd(school.budget_minimo_usd)} />
          <Campo titulo="Budget forte (USD)" valor={school.budget_forte_usd == null ? null : formatarUsd(school.budget_forte_usd)} />
          <Campo titulo="Agressividade de bolsa" valor={rotulo(AGRESSIVIDADE_LABEL, school.agressividade_bolsa)} />
        </dl>
      </Secao>

      <Secao titulo="Acadêmico e prazos">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo titulo="Inglês mínimo" valor={rotulo(INGLES_LABEL, school.ingles_minimo)} />
          <Campo titulo="Duolingo mínimo" valor={school.nota_minima_duolingo == null ? null : String(school.nota_minima_duolingo)} />
          <Campo titulo="GPA mínimo" valor={school.gpa_minimo == null ? null : school.gpa_minimo.toFixed(1)} />
          <Campo titulo="Série máxima" valor={rotulo(SERIE_LABEL, school.serie_maxima)} />
          <Campo titulo="Rolling admission" valor={sim(school.rolling_admission)} />
          <Campo titulo="Testes exigidos" valor={school.testes_exigidos.length > 0 ? school.testes_exigidos.join(", ") : null} />
          <Campo titulo="Deadline Fall" valor={school.deadline_fall ? formatarDataCurta(school.deadline_fall) : null} />
          <Campo titulo="Deadline Spring" valor={school.deadline_spring ? formatarDataCurta(school.deadline_spring) : null} />
        </dl>
      </Secao>

      <Secao titulo="Esportes">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo titulo="Influência do esporte" valor={rotulo(INFLUENCIA_LABEL, school.influencia_esporte)} />
          <Campo titulo="Exceção para atleta de elite" valor={sim(school.aceita_excecao_elite)} />
          <Campo
            titulo="Esportes oferecidos"
            valor={school.esportes_oferecidos.length > 0 ? school.esportes_oferecidos.join(", ") : "Não restringe o Match"}
          />
        </dl>
      </Secao>

      <Secao titulo="Admissions officer">
        {school.admissions_officer_nome || school.admissions_officer_email || school.admissions_officer_telefone ? (
          <div className="space-y-0.5 text-sm">
            <p className="font-medium text-foreground">{school.admissions_officer_nome ?? "Nome não informado"}</p>
            {emailOfficer && (
              <a href={emailOfficer} className="block break-all text-xs text-primary hover:text-primary/80">
                {school.admissions_officer_email}
              </a>
            )}
            {school.admissions_officer_telefone && (
              <p className="text-xs text-muted-foreground">{school.admissions_officer_telefone}</p>
            )}
          </div>
        ) : (
          <p className="text-xs italic text-label-tertiary">Nenhum officer cadastrado.</p>
        )}
      </Secao>

      <Secao titulo="Regra BAUSA e notas">
        {school.regra_pratica || school.notas_internas ? (
          <div className="space-y-2">
            {school.regra_pratica && (
              <div>
                <p className="mb-0.5 text-[10px] font-semibold text-primary">Regra BAUSA</p>
                <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{school.regra_pratica}</p>
              </div>
            )}
            {school.notas_internas && (
              <div>
                <p className="mb-0.5 text-[10px] font-semibold text-muted-foreground">Notas</p>
                <p className="whitespace-pre-line break-words text-xs leading-relaxed text-muted-foreground">{school.notas_internas}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs italic text-label-tertiary">Sem regras ou notas.</p>
        )}
      </Secao>
    </div>
  );
}

/**
 * Detalhe da escola (sheet lateral, tela cheia no celular). Dados vêm SEMPRE
 * da lista atual do servidor (EscolasClient deriva por id), então depois de
 * salvar + router.refresh() a tela já mostra o valor novo.
 */
export function SchoolDetailSheet({ school, agoraMs, onClose }: SchoolDetailSheetProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [aba, setAba] = useState<Aba>("info");
  const [editando, setEditando] = useState(false);
  const [formSujo, setFormSujo] = useState(false);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const tituloId = `escola-detalhe-${school.id}`;
  const localizacao = formatarLocalizacao(school.cidade, school.estado_us);

  const fechar = useCallback(async () => {
    if (editando && formSujo) {
      const descartar = await confirm({
        title: "Descartar alterações?",
        description: "As mudanças nesta escola ainda não foram salvas.",
        confirmLabel: "Descartar",
        tone: "danger",
      });
      if (!descartar) return;
    }
    onClose();
  }, [confirm, editando, formSujo, onClose]);

  // Foco inicial no fechar; Esc fecha; foco volta para quem abriu; sem scroll do fundo.
  useEffect(() => {
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    fecharRef.current?.focus();
    const destravar = travarRolagemDoFundo();
    return () => {
      destravar();
      if (anterior?.isConnected) anterior.focus();
    };
  }, []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") void fechar();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [fechar]);

  const aoSalvar = useCallback(() => {
    setEditando(false);
    setFormSujo(false);
    router.refresh();
  }, [router]);

  const cancelarEdicao = useCallback(async () => {
    if (formSujo) {
      const descartar = await confirm({
        title: "Descartar alterações?",
        confirmLabel: "Descartar",
        tone: "danger",
      });
      if (!descartar) return;
    }
    setEditando(false);
    setFormSujo(false);
  }, [confirm, formSujo]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => void fechar()} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onKeyDown={prenderTabNoDialogo}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col shadow-2xl liquid-glass"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0 space-y-1">
            <h2 id={tituloId} className="break-words text-lg font-semibold text-foreground">{school.nome}</h2>
            {localizacao ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin aria-hidden className="size-3 shrink-0" />
                {localizacao}
              </p>
            ) : (
              <p className="flex items-center gap-1 text-xs font-medium text-sys-orange">
                <AlertTriangle aria-hidden className="size-3 shrink-0" />
                Localização a confirmar — use Editar para corrigir
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge tone="brand" size="sm">{TIPO_LABEL[school.tipo]}</Badge>
              {school.perfil && <Badge tone="purple" size="sm">{PERFIL_LABEL[school.perfil]}</Badge>}
              <Badge tone={STATUS_ESCOLA_TOM[school.status]} size="sm">{STATUS_LABEL[school.status]}</Badge>
            </div>
          </div>
          <button
            ref={fecharRef}
            type="button"
            onClick={() => void fechar()}
            aria-label="Fechar detalhe da escola"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X aria-hidden className="size-5" />
          </button>
        </header>

        <div role="tablist" aria-label="Seções da escola" className="flex gap-1 border-b border-border px-5 py-2 sm:px-6">
          {(
            [
              ["info", "Informações"],
              ["contatos", "Contatos"],
            ] as const
          ).map(([id, titulo]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`aba-${id}-${school.id}`}
              aria-selected={aba === id}
              aria-controls={`painel-${id}-${school.id}`}
              disabled={editando && id !== "info"}
              onClick={() => setAba(id)}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:opacity-40",
                aba === id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {titulo}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`painel-${aba}-${school.id}`}
          aria-labelledby={`aba-${aba}-${school.id}`}
          className="crm-scroll flex-1 overflow-y-auto px-5 py-5 sm:px-6"
        >
          {aba === "info" &&
            (editando ? (
              <SchoolEditForm
                // Remonta quando o dado do servidor muda (defaults sempre frescos).
                key={school.updated_at}
                school={school}
                onCancel={() => void cancelarEdicao()}
                onSaved={aoSalvar}
                onDirtyChange={setFormSujo}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setEditando(true)}
                    className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    <Pencil aria-hidden className="size-3" />
                    Editar
                  </button>
                </div>
                <InfoView school={school} />
              </div>
            ))}
          {aba === "contatos" && (
            <SchoolContatosTab escolaId={school.id} agoraMs={agoraMs} onRegistrado={() => router.refresh()} />
          )}
        </div>
      </div>
    </>
  );
}
