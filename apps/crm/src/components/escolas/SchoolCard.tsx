"use client";

import { AlertTriangle, ExternalLink, MapPin, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  NAO_INFORMADO,
  STATUS_ESCOLA_TOM,
  diasDesde,
  formatarDataCurta,
  formatarFaixaBudget,
  formatarLocalizacao,
  formatarPercentual,
  hrefEmail,
  hrefExterno,
  rotulo,
} from "@/lib/escolas/apresentacao";
import type { HistoricoEscola, School } from "@/types/school";
import { Badge } from "@/components/ui";

import {
  AGRESSIVIDADE_LABEL,
  INFLUENCIA_LABEL,
  INGLES_LABEL,
  PERFIL_LABEL,
  SERIE_LABEL,
  STATUS_LABEL,
  TIPO_LABEL,
} from "./school-options";

const DIAS_ALERTA_CONTATO = 90;

interface SchoolCardProps {
  school: School;
  onSelect: (school: School) => void;
  /** Timestamp gerado no servidor (cálculo de "dias atrás" puro). */
  agoraMs: number;
  historicoDisponivel: boolean;
}

function Linha({ rotulo: titulo, valor, vazio }: { rotulo: string; valor: string; vazio: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[11px] text-label-tertiary">{titulo}</dt>
      <dd
        className={cn(
          "min-w-0 text-right text-[11px] font-medium",
          vazio ? "italic text-label-tertiary" : "text-foreground",
        )}
      >
        {valor}
      </dd>
    </div>
  );
}

/** Histórico real (estrategia_escolas) — nunca "0 aplicações" inventado. */
function HistoricoBausa({ historico, disponivel }: { historico: HistoricoEscola; disponivel: boolean }) {
  if (!disponivel) {
    return <p className="text-[11px] italic text-label-tertiary">Histórico BAUSA indisponível agora.</p>;
  }
  if (historico.atletas_total === 0) {
    return <p className="text-[11px] text-label-tertiary">Nenhum atleta BAUSA nesta escola ainda.</p>;
  }
  const partes: { chave: string; texto: string; tom: "blue" | "orange" | "green" | "red" }[] = [];
  if (historico.em_andamento > 0) partes.push({ chave: "and", texto: `${historico.em_andamento} em andamento`, tom: "blue" });
  if (historico.em_planejamento > 0) partes.push({ chave: "plan", texto: `${historico.em_planejamento} em planejamento`, tom: "orange" });
  if (historico.aceitos > 0) partes.push({ chave: "ace", texto: `${historico.aceitos} ${historico.aceitos === 1 ? "aceito" : "aceitos"}`, tom: "green" });
  if (historico.recusados > 0) partes.push({ chave: "rec", texto: `${historico.recusados} ${historico.recusados === 1 ? "recusado" : "recusados"}`, tom: "red" });

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-foreground">
        {historico.atletas_total} {historico.atletas_total === 1 ? "atleta BAUSA" : "atletas BAUSA"}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {partes.map((p) => (
          <Badge key={p.chave} tone={p.tom} size="sm">
            {p.texto}
          </Badge>
        ))}
        {historico.bolsa_media_obtida_pct != null && (
          <Badge tone="green" size="sm">
            Bolsa média {formatarPercentual(historico.bolsa_media_obtida_pct)}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function SchoolCard({ school, onSelect, agoraMs, historicoDisponivel }: SchoolCardProps) {
  const tituloId = `escola-${school.id}-titulo`;
  const localizacao = formatarLocalizacao(school.cidade, school.estado_us);
  const budget = formatarFaixaBudget(school.budget_minimo_usd, school.budget_forte_usd);
  const diasContato = diasDesde(school.ultimo_contato_at, agoraMs);
  const inscricao = hrefExterno(school.link_inscricao);
  const planoSaude = hrefExterno(school.link_plano_saude);
  const emailOfficer = hrefEmail(school.admissions_officer_email);

  const linhas = [
    { rotulo: "Budget (USD)", valor: budget },
    { rotulo: "Inglês mínimo", valor: rotulo(INGLES_LABEL, school.ingles_minimo) },
    { rotulo: "Série máxima", valor: rotulo(SERIE_LABEL, school.serie_maxima) },
    { rotulo: "Agressividade de bolsa", valor: rotulo(AGRESSIVIDADE_LABEL, school.agressividade_bolsa) },
    { rotulo: "Influência do esporte", valor: rotulo(INFLUENCIA_LABEL, school.influencia_esporte) },
  ];

  return (
    <article
      aria-labelledby={tituloId}
      className="relative flex h-full flex-col gap-4 rounded-xl border border-border/70 bg-card/60 p-5 transition-all focus-within:ring-2 focus-within:ring-primary/40 hover:border-primary/30 hover:shadow-md"
    >
      <header className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="brand" size="sm">{TIPO_LABEL[school.tipo]}</Badge>
          {school.perfil && (
            <Badge tone="purple" size="sm">{PERFIL_LABEL[school.perfil]}</Badge>
          )}
          <Badge tone={STATUS_ESCOLA_TOM[school.status]} size="sm">
            {STATUS_LABEL[school.status]}
          </Badge>
        </div>
        <h3 id={tituloId} className="text-sm font-semibold leading-tight text-foreground">
          {/* Botão "esticado": o card inteiro abre o detalhe sem aninhar links num role=button. */}
          <button
            type="button"
            onClick={() => onSelect(school)}
            className="break-words text-left after:absolute after:inset-0 after:rounded-xl after:content-[''] focus:outline-none"
          >
            {school.nome}
          </button>
        </h3>
        {localizacao ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin aria-hidden className="size-3 shrink-0" />
            <span className="min-w-0 truncate">{localizacao}</span>
          </p>
        ) : (
          <p className="flex items-center gap-1 text-xs font-medium text-sys-orange">
            <AlertTriangle aria-hidden className="size-3 shrink-0" />
            Localização a confirmar
          </p>
        )}
      </header>

      <HistoricoBausa historico={school.historico} disponivel={historicoDisponivel} />

      <dl className="space-y-1.5 border-t border-border/60 pt-3">
        {linhas.map((l) => (
          <Linha key={l.rotulo} rotulo={l.rotulo} valor={l.valor} vazio={l.valor === NAO_INFORMADO} />
        ))}
      </dl>

      {(school.rolling_admission || school.gpa_minimo != null || school.nota_minima_duolingo != null || school.testes_exigidos.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {school.rolling_admission && <Badge tone="green" size="sm">Rolling admission</Badge>}
          {school.gpa_minimo != null && <Badge tone="blue" size="sm">GPA mín. {school.gpa_minimo.toFixed(1)}</Badge>}
          {school.nota_minima_duolingo != null && (
            <Badge tone="blue" size="sm">Duolingo mín. {school.nota_minima_duolingo}</Badge>
          )}
          {school.testes_exigidos.map((teste) => (
            <Badge key={teste} tone="neutral" size="sm">{teste}</Badge>
          ))}
        </div>
      )}

      {(school.deadline_fall || school.deadline_spring || diasContato != null) && (
        <dl className="grid grid-cols-2 gap-2 text-[11px]">
          {school.deadline_fall && (
            <div>
              <dt className="text-label-tertiary">Deadline Fall</dt>
              <dd className="font-medium text-foreground">{formatarDataCurta(school.deadline_fall)}</dd>
            </div>
          )}
          {school.deadline_spring && (
            <div>
              <dt className="text-label-tertiary">Deadline Spring</dt>
              <dd className="font-medium text-foreground">{formatarDataCurta(school.deadline_spring)}</dd>
            </div>
          )}
          {diasContato != null && (
            <div className="col-span-2">
              <dt className="text-label-tertiary">Último contato</dt>
              <dd
                className={cn(
                  "flex items-center gap-1 font-medium",
                  diasContato > DIAS_ALERTA_CONTATO ? "text-sys-red" : "text-foreground",
                )}
              >
                {diasContato > DIAS_ALERTA_CONTATO && <AlertTriangle aria-hidden className="size-3" />}
                {diasContato === 0 ? "hoje" : `há ${diasContato} ${diasContato === 1 ? "dia" : "dias"}`}
              </dd>
            </div>
          )}
        </dl>
      )}

      {school.regra_pratica && (
        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
          <p className="mb-0.5 text-[10px] font-semibold text-primary">Regra BAUSA</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{school.regra_pratica}</p>
        </div>
      )}

      {(inscricao || planoSaude || school.admissions_officer_nome) && (
        // relative z-10: fica ACIMA do botão esticado — os links seguem clicáveis.
        <div className="relative z-10 mt-auto space-y-2">
          {(inscricao || planoSaude) && (
            <div className="flex flex-wrap gap-2">
              {inscricao && (
                <a
                  href={inscricao}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-[8rem] flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <ExternalLink aria-hidden className="size-3" />
                  Inscrição
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              )}
              {planoSaude && (
                <a
                  href={planoSaude}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-[8rem] flex-1 items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
                >
                  <ExternalLink aria-hidden className="size-3" />
                  Plano de saúde
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              )}
            </div>
          )}
          {school.admissions_officer_nome && (
            <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <Users aria-hidden className="size-3 shrink-0" />
              <span className="min-w-0 truncate">{school.admissions_officer_nome}</span>
              {emailOfficer && (
                <a
                  href={emailOfficer}
                  className="ml-auto shrink-0 text-primary hover:text-primary/80"
                  aria-label={`Enviar e-mail para ${school.admissions_officer_nome}`}
                >
                  <ExternalLink aria-hidden className="size-3" />
                </a>
              )}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
