import { Badge } from "@/components/ui";
import { FIELD_CLASS, SECTION_LABEL } from "@/components/automacoes/builder-shared";
import { cn } from "@/lib/utils";

/**
 * InstrucoesIAEditor — editor controlado de um prompt de SISTEMA no formato
 * `{ instrucoes?: string }` (chaves de configuracoes_sistema). Presentational:
 * o pai controla o valor e a persistência (ex.: atualizarInstrucoesIA /
 * atualizarInsightsConversaPrompt). Reusado em /automacoes e /agents — fonte
 * ÚNICA para não divergir o visual/limite entre as duas telas.
 *
 * Vazio = volta ao default do código (fail-open) — a badge "Personalizada"
 * só aparece quando há override diferente do default.
 */
const INSTRUCOES_MAX = 4000;

export interface InstrucoesIAEditorProps {
  id: string;
  titulo: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  defaultTexto: string;
  rodape: string;
}

export function InstrucoesIAEditor({
  id,
  titulo,
  rotulo,
  valor,
  onChange,
  defaultTexto,
  rodape,
}: InstrucoesIAEditorProps) {
  const personalizada = valor.trim() !== defaultTexto.trim() && valor.trim() !== "";
  return (
    <section className="space-y-2">
      <p className={SECTION_LABEL}>{titulo}</p>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[11px] font-semibold text-foreground">
          {rotulo}
          {personalizada && (
            <Badge tone="blue" size="sm" className="ml-1.5">
              Personalizada
            </Badge>
          )}
        </label>
        <span
          className={cn(
            "text-[11px] tabular-nums",
            valor.length > INSTRUCOES_MAX ? "text-sys-red" : "text-muted-foreground",
          )}
        >
          {valor.length}/{INSTRUCOES_MAX}
        </span>
      </div>
      <textarea
        id={id}
        className={cn(FIELD_CLASS, "min-h-40 resize-y font-mono text-[11px] leading-relaxed")}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-[11px] text-muted-foreground">{rodape}</p>
    </section>
  );
}
