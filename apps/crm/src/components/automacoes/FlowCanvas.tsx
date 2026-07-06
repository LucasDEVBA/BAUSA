"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Bell,
  ClipboardList,
  Clock,
  Diamond,
  Mail,
  Maximize,
  MessageCircle,
  MessageSquareText,
  MoveRight,
  Plus,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";

import { Button, Card } from "@/components/ui";
import {
  ACAO_CATALOG,
  GATILHO_CATALOG,
  type AutomacaoAcaoTipo,
} from "@/types/automacao";
import { cn } from "@/lib/utils";

import {
  camposCondicaoDoGatilho,
  resumoAcao,
  resumoCondicao,
  resumoGatilho,
  type BuilderState,
} from "./builder-shared";

/**
 * FlowCanvas — visão de fluxo estilo n8n do builder de automações.
 * Canvas próprio (zero dependência externa): nós em colunas fixas
 * Gatilho → Condições (grupo AND) → Ações, conectados por beziers SVG,
 * com pan (arrastar o fundo) e zoom (scroll + botões e "fit").
 */

// ─── Seleção ─────────────────────────────────────────────────────────────────

export type FlowSelection =
  | { kind: "gatilho" }
  | { kind: "condicao"; index: number }
  | { kind: "acao"; index: number };

export type GhostMenu = "condicao" | "acao" | null;

interface FlowCanvasProps {
  builder: BuilderState;
  selection: FlowSelection | null;
  onSelect: (sel: FlowSelection | null) => void;
  ghostMenu: GhostMenu;
  onGhostMenu: (menu: GhostMenu) => void;
  onAddCondicao: (campo: string) => void;
  onAddAcao: (tipo: AutomacaoAcaoTipo) => void;
  onRemoveCondicao: (index: number) => void;
  onRemoveAcao: (index: number) => void;
}

// ─── Layout determinístico (colunas fixas, sem drag de nós — MVP) ────────────

const NODE_W = 240;
const NODE_H = 96;
const GHOST_H = 48;
const V_GAP = 16;
const COL_GAP = 120;
const PAD = 40;
/** Padding interno do grupo de condições + altura do label do grupo. */
const G_PAD = 14;
const G_LABEL_H = 22;

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.75;

/** Menus dos nós fantasmas — overlay NÃO escalado no viewport (fora do mundo
 *  pan/zoom). Altura máxima + scroll interno garantem TODOS os itens do
 *  catálogo acessíveis, em qualquer zoom/posição do fluxo. */
const GHOST_MENU_MAX_H = 320;
const GHOST_MENU_W_ACAO = 288; // w-72
const GHOST_MENU_W_CONDICAO = 256; // w-64
const GHOST_MENU_MARGIN = 8;

const ACAO_ICON: Record<AutomacaoAcaoTipo, LucideIcon> = {
  criar_tarefa: ClipboardList,
  criar_notificacao: Bell,
  enviar_whatsapp: MessageCircle,
  enviar_whatsapp_custom: MessageSquareText,
  enviar_email_custom: Mail,
  mover_deal: MoveRight,
};

interface FlowLayout {
  worldW: number;
  worldH: number;
  gatilho: { x: number; y: number };
  /** Caixa do grupo de condições (só quando há ≥1 condição). */
  grupo: { x: number; y: number; w: number; h: number } | null;
  condicoes: { x: number; y: number }[];
  /** Nó fantasma "+ Condição" (null quando o gatilho não suporta condições). */
  ghostCondicao: { x: number; y: number } | null;
  acoes: { x: number; y: number }[];
  ghostAcao: { x: number; y: number };
}

function computeLayout(builder: BuilderState): FlowLayout {
  const suportaCondicoes = camposCondicaoDoGatilho(builder.gatilho).length > 0;
  const nCond = suportaCondicoes ? builder.condicoes.length : 0;
  const nAcoes = builder.acoes.length;

  const condStackH = nCond > 0 ? nCond * NODE_H + (nCond - 1) * V_GAP : 0;
  const grupoH = nCond > 0 ? G_LABEL_H + G_PAD * 2 + condStackH : 0;
  const hCond = suportaCondicoes ? (nCond > 0 ? grupoH + V_GAP + GHOST_H : GHOST_H) : 0;
  const hAcao = nAcoes * (NODE_H + V_GAP) + GHOST_H;
  const contentH = Math.max(NODE_H, hCond, hAcao);

  const gatilhoX = PAD;
  const grupoX = PAD + NODE_W + COL_GAP;
  const condNodeX = grupoX + G_PAD;
  const acaoX = suportaCondicoes
    ? grupoX + NODE_W + G_PAD * 2 + COL_GAP
    : PAD + NODE_W + COL_GAP;

  const gatilhoY = PAD + (contentH - NODE_H) / 2;
  const condColTop = PAD + (contentH - hCond) / 2;
  const acaoColTop = PAD + (contentH - hAcao) / 2;

  const grupo =
    nCond > 0 ? { x: grupoX, y: condColTop, w: NODE_W + G_PAD * 2, h: grupoH } : null;
  const condicoes = Array.from({ length: nCond }, (_, i) => ({
    x: condNodeX,
    y: condColTop + G_LABEL_H + G_PAD + i * (NODE_H + V_GAP),
  }));
  const ghostCondicao = suportaCondicoes
    ? { x: condNodeX, y: nCond > 0 ? condColTop + grupoH + V_GAP : condColTop }
    : null;
  const acoes = Array.from({ length: nAcoes }, (_, i) => ({
    x: acaoX,
    y: acaoColTop + i * (NODE_H + V_GAP),
  }));
  const ghostAcao = { x: acaoX, y: acaoColTop + nAcoes * (NODE_H + V_GAP) };

  return {
    worldW: acaoX + NODE_W + PAD,
    worldH: PAD * 2 + contentH,
    gatilho: { x: gatilhoX, y: gatilhoY },
    grupo,
    condicoes,
    ghostCondicao,
    acoes,
    ghostAcao,
  };
}

/** Path bezier horizontal estilo n8n. */
function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(48, (x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

interface Edge {
  path: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  dashed?: boolean;
  /** Aresta que chega no nó selecionado ganha cor primária. */
  active?: boolean;
}

function computeEdges(layout: FlowLayout, selection: FlowSelection | null): Edge[] {
  const edges: Edge[] = [];
  const saidaGatilho = {
    x: layout.gatilho.x + NODE_W,
    y: layout.gatilho.y + NODE_H / 2,
  };
  const temGrupo = layout.grupo !== null;
  const origem = temGrupo && layout.grupo
    ? { x: layout.grupo.x + layout.grupo.w, y: layout.grupo.y + layout.grupo.h / 2 }
    : saidaGatilho;

  if (temGrupo && layout.grupo) {
    const entradaGrupo = { x: layout.grupo.x, y: layout.grupo.y + layout.grupo.h / 2 };
    edges.push({
      path: edgePath(saidaGatilho.x, saidaGatilho.y, entradaGrupo.x, entradaGrupo.y),
      from: saidaGatilho,
      to: entradaGrupo,
      active: selection?.kind === "condicao",
    });
  }

  layout.acoes.forEach((acao, i) => {
    const entrada = { x: acao.x, y: acao.y + NODE_H / 2 };
    edges.push({
      path: edgePath(origem.x, origem.y, entrada.x, entrada.y),
      from: origem,
      to: entrada,
      active: selection?.kind === "acao" && selection.index === i,
    });
  });

  // Sem ações ainda: aresta tracejada até o fantasma "+ Ação" guia o olhar.
  if (layout.acoes.length === 0) {
    const entrada = { x: layout.ghostAcao.x, y: layout.ghostAcao.y + GHOST_H / 2 };
    edges.push({
      path: edgePath(origem.x, origem.y, entrada.x, entrada.y),
      from: origem,
      to: entrada,
      dashed: true,
    });
  }

  return edges;
}

// ─── Nó ──────────────────────────────────────────────────────────────────────

function FlowNode({
  x,
  y,
  icon: Icon,
  eyebrow,
  titulo,
  resumo,
  selected,
  ariaLabel,
  onClick,
  onRemove,
  removeLabel,
}: {
  x: number;
  y: number;
  icon: LucideIcon;
  eyebrow: string;
  titulo: string;
  resumo: string;
  selected: boolean;
  ariaLabel: string;
  onClick: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <Card
      variant="plain"
      padding="none"
      className={cn(
        "absolute overflow-visible",
        selected && "border-primary/50 ring-2 ring-ring/60",
      )}
      style={{ left: x, top: y, width: NODE_W, height: NODE_H }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onClick}
        className="flex h-full w-full flex-col justify-center gap-1 rounded-2xl p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-shadow hover:shadow-md"
      >
        <span className="flex items-center gap-1.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon aria-hidden className="h-3 w-3" />
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-label-tertiary">
            {eyebrow}
          </span>
        </span>
        <span className="truncate text-xs font-semibold text-foreground">{titulo}</span>
        <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {resumo}
        </span>
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel ?? "Remover nó"}
          onClick={onRemove}
          className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-sys-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden className="h-3 w-3" />
        </button>
      )}
    </Card>
  );
}

function GhostNode({
  x,
  y,
  label,
  ariaLabel,
  expanded,
  onClick,
}: {
  x: number;
  y: number;
  label: string;
  ariaLabel: string;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-expanded={expanded}
      onClick={onClick}
      className="absolute flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card/60 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ left: x, top: y, width: NODE_W, height: GHOST_H }}
    >
      <Plus aria-hidden className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ─── Canvas ──────────────────────────────────────────────────────────────────

interface ViewState {
  x: number;
  y: number;
  zoom: number;
}

export function FlowCanvas({
  builder,
  selection,
  onSelect,
  ghostMenu,
  onGhostMenu,
  onAddCondicao,
  onAddAcao,
  onRemoveCondicao,
  onRemoveAcao,
}: FlowCanvasProps) {
  const layout = computeLayout(builder);
  const { worldW, worldH } = layout;
  const edges = computeEdges(layout, selection);
  const gatilhoInfo = GATILHO_CATALOG[builder.gatilho];
  const GatilhoIcon = gatilhoInfo.origem === "evento" ? Zap : Clock;
  const camposDisponiveis = camposCondicaoDoGatilho(builder.gatilho);

  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ViewState>({ x: PAD, y: PAD, zoom: 1 });
  const panRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const [panning, setPanning] = useState(false);
  /** Depois que o usuário mexeu no canvas, não refazemos o auto-fit. */
  const touchedRef = useRef(false);
  /** Tamanho do viewport — posiciona os menus fantasmas (overlay sem escala). */
  const [vp, setVp] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setVp((prev) =>
        prev.w === rect.width && prev.h === rect.height
          ? prev
          : { w: rect.width, h: rect.height },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const zoom = Math.min(
      Math.max(
        Math.min((rect.width - 32) / worldW, (rect.height - 32) / worldH, 1),
        ZOOM_MIN,
      ),
      ZOOM_MAX,
    );
    setView({
      zoom,
      x: (rect.width - worldW * zoom) / 2,
      y: (rect.height - worldH * zoom) / 2,
    });
  }, [worldW, worldH]);

  // Auto-fit no mount e quando nós entram/saem — até o usuário pan/zoomar.
  useLayoutEffect(() => {
    if (!touchedRef.current) fit();
  }, [fit]);

  // Zoom por scroll, centrado no cursor (listener manual: precisa de
  // preventDefault e o onWheel do React pode ser passivo).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Scroll dentro de um menu fantasma rola o menu — não é zoom do canvas.
      if (e.target instanceof Element && e.target.closest("[data-ghost-menu]")) return;
      e.preventDefault();
      touchedRef.current = true;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setView((v) => {
        const zoom = Math.min(
          Math.max(v.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), ZOOM_MIN),
          ZOOM_MAX,
        );
        const k = zoom / v.zoom;
        return { zoom, x: mx - k * (mx - v.x), y: my - k * (my - v.y) };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (fator: number) => {
    const el = viewportRef.current;
    if (!el) return;
    touchedRef.current = true;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    setView((v) => {
      const zoom = Math.min(Math.max(v.zoom * fator, ZOOM_MIN), ZOOM_MAX);
      const k = zoom / v.zoom;
      return { zoom, x: mx - k * (mx - v.x), y: my - k * (my - v.y) };
    });
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | SVGElement;
    if (!(target instanceof HTMLElement) || target.dataset.canvasBg === undefined) return;
    // Clique no fundo: fecha menu fantasma e deseleciona (estilo n8n)
    onGhostMenu(null);
    onSelect(null);
    touchedRef.current = true;
    panRef.current = { px: e.clientX, py: e.clientY, ox: view.x, oy: view.y };
    setPanning(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan) return;
    setView((v) => ({
      ...v,
      x: pan.ox + (e.clientX - pan.px),
      y: pan.oy + (e.clientY - pan.py),
    }));
  };

  const endPan = () => {
    panRef.current = null;
    setPanning(false);
  };

  /** Posição do menu fantasma no VIEWPORT (coordenadas de tela, sem escala):
   *  ancora abaixo do nó fantasma, clampa na horizontal e abre para CIMA
   *  quando não há espaço abaixo — nada do menu fica fora da tela. */
  const ghostMenuStyle = (
    anchor: { x: number; y: number },
    menuW: number,
  ): CSSProperties => {
    const left = Math.min(
      Math.max(view.x + anchor.x * view.zoom, GHOST_MENU_MARGIN),
      Math.max(GHOST_MENU_MARGIN, vp.w - menuW - GHOST_MENU_MARGIN),
    );
    const anchorTop = view.y + anchor.y * view.zoom;
    const topBelow = view.y + (anchor.y + GHOST_H) * view.zoom + GHOST_MENU_MARGIN;
    const spaceBelow = vp.h - topBelow - GHOST_MENU_MARGIN;
    const spaceAbove = anchorTop - GHOST_MENU_MARGIN * 2;
    if (spaceBelow >= GHOST_MENU_MAX_H || spaceBelow >= spaceAbove) {
      return { left, top: topBelow, maxHeight: Math.min(GHOST_MENU_MAX_H, spaceBelow) };
    }
    return {
      left,
      bottom: vp.h - anchorTop + GHOST_MENU_MARGIN,
      maxHeight: Math.min(GHOST_MENU_MAX_H, spaceAbove),
    };
  };

  return (
    <div
      ref={viewportRef}
      data-canvas-bg
      role="application"
      aria-label="Fluxo da automação — gatilho, condições e ações"
      className={cn(
        "relative h-full w-full touch-none select-none overflow-hidden bg-secondary/40",
        panning ? "cursor-grabbing" : "cursor-grab",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
    >
      {/* Mundo transformado (pan + zoom) */}
      <div
        data-canvas-bg
        className="absolute left-0 top-0"
        style={{
          width: layout.worldW,
          height: layout.worldH,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {/* Conexões bezier (estilo n8n) */}
        <svg
          aria-hidden
          className="pointer-events-none absolute left-0 top-0"
          width={layout.worldW}
          height={layout.worldH}
          viewBox={`0 0 ${layout.worldW} ${layout.worldH}`}
        >
          {edges.map((edge, i) => (
            <g key={i}>
              <path
                d={edge.path}
                fill="none"
                stroke={edge.active ? "var(--primary)" : "var(--border)"}
                strokeWidth={edge.active ? 2 : 1.5}
                strokeDasharray={edge.dashed ? "5 5" : undefined}
              />
              <circle cx={edge.from.x} cy={edge.from.y} r={3} fill="var(--primary)" />
              <circle cx={edge.to.x} cy={edge.to.y} r={3} fill="var(--primary)" />
            </g>
          ))}
        </svg>

        {/* Grupo de condições (AND) */}
        {layout.grupo && (
          <div
            aria-hidden
            className="absolute rounded-2xl border border-dashed border-primary/30 bg-primary/5"
            style={{
              left: layout.grupo.x,
              top: layout.grupo.y,
              width: layout.grupo.w,
              height: layout.grupo.h,
            }}
          >
            <p className="px-3 pt-1.5 text-[9px] font-semibold uppercase tracking-widest text-label-tertiary">
              Condições · todas (E)
            </p>
          </div>
        )}

        {/* Nó Gatilho */}
        <FlowNode
          x={layout.gatilho.x}
          y={layout.gatilho.y}
          icon={GatilhoIcon}
          eyebrow="Gatilho"
          titulo={gatilhoInfo.label}
          resumo={resumoGatilho(builder)}
          selected={selection?.kind === "gatilho"}
          ariaLabel={`Gatilho: ${gatilhoInfo.label} — editar`}
          onClick={() => onSelect({ kind: "gatilho" })}
        />

        {/* Nós de condição */}
        {builder.condicoes.map((cond, i) => {
          const pos = layout.condicoes[i];
          if (!pos) return null;
          return (
            <FlowNode
              key={`cond-${i}`}
              x={pos.x}
              y={pos.y}
              icon={Diamond}
              eyebrow={`Condição ${i + 1}`}
              titulo={resumoCondicao(cond)}
              resumo="Precisa ser verdadeira para as ações rodarem."
              selected={selection?.kind === "condicao" && selection.index === i}
              ariaLabel={`Condição ${i + 1}: ${resumoCondicao(cond)} — editar`}
              onClick={() => onSelect({ kind: "condicao", index: i })}
              onRemove={() => onRemoveCondicao(i)}
              removeLabel={`Remover condição ${i + 1}`}
            />
          );
        })}

        {/* Fantasma + Condição (só quando o gatilho suporta) */}
        {layout.ghostCondicao && (
          <GhostNode
            x={layout.ghostCondicao.x}
            y={layout.ghostCondicao.y}
            label="Condição"
            ariaLabel="Adicionar condição"
            expanded={ghostMenu === "condicao"}
            onClick={() => onGhostMenu(ghostMenu === "condicao" ? null : "condicao")}
          />
        )}

        {/* Nós de ação */}
        {builder.acoes.map((acao, i) => {
          const pos = layout.acoes[i];
          if (!pos) return null;
          return (
            <FlowNode
              key={`acao-${i}`}
              x={pos.x}
              y={pos.y}
              icon={ACAO_ICON[acao.tipo]}
              eyebrow={`Ação ${i + 1}`}
              titulo={ACAO_CATALOG[acao.tipo].label}
              resumo={resumoAcao(acao)}
              selected={selection?.kind === "acao" && selection.index === i}
              ariaLabel={`Ação ${i + 1}: ${ACAO_CATALOG[acao.tipo].label} — editar`}
              onClick={() => onSelect({ kind: "acao", index: i })}
              onRemove={() => onRemoveAcao(i)}
              removeLabel={`Remover ação ${i + 1}`}
            />
          );
        })}

        {/* Fantasma + Ação */}
        <GhostNode
          x={layout.ghostAcao.x}
          y={layout.ghostAcao.y}
          label="Ação"
          ariaLabel="Adicionar ação"
          expanded={ghostMenu === "acao"}
          onClick={() => onGhostMenu(ghostMenu === "acao" ? null : "acao")}
        />
      </div>

      {/* Menus fantasmas — overlay no viewport (sem escala do zoom), com
          clamp/flip e scroll interno: TODOS os itens sempre alcançáveis. */}
      {ghostMenu === "condicao" && layout.ghostCondicao && vp.h > 0 && (
        <Card
          data-ghost-menu
          variant="plain"
          padding="sm"
          className="absolute z-20 w-64 space-y-0.5 overflow-y-auto shadow-lg"
          style={ghostMenuStyle(layout.ghostCondicao, GHOST_MENU_W_CONDICAO)}
        >
          <p className="px-2 pb-1 text-[9px] font-semibold uppercase tracking-widest text-label-tertiary">
            Campo da condição
          </p>
          {camposDisponiveis.map((campo) => (
            <button
              key={campo.value}
              type="button"
              onClick={() => onAddCondicao(campo.value)}
              className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {campo.label}
            </button>
          ))}
        </Card>
      )}
      {ghostMenu === "acao" && vp.h > 0 && (
        <Card
          data-ghost-menu
          variant="plain"
          padding="sm"
          className="absolute z-20 w-72 space-y-0.5 overflow-y-auto shadow-lg"
          style={ghostMenuStyle(layout.ghostAcao, GHOST_MENU_W_ACAO)}
        >
          <p className="px-2 pb-1 text-[9px] font-semibold uppercase tracking-widest text-label-tertiary">
            Tipo de ação
          </p>
          {/* SEMPRE deriva do ACAO_CATALOG — mesma fonte da visão Formulário. */}
          {(Object.keys(ACAO_CATALOG) as AutomacaoAcaoTipo[]).map((tipo) => {
            const Icon = ACAO_ICON[tipo];
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => onAddAcao(tipo)}
                className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon aria-hidden className="h-3 w-3" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-foreground">
                    {ACAO_CATALOG[tipo].label}
                  </span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">
                    {ACAO_CATALOG[tipo].descricao}
                  </span>
                </span>
              </button>
            );
          })}
        </Card>
      )}

      {/* Controles de zoom */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
        <Button variant="ghost" size="sm" aria-label="Diminuir zoom" onClick={() => zoomBy(1 / 1.2)}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">
          {Math.round(view.zoom * 100)}%
        </span>
        <Button variant="ghost" size="sm" aria-label="Aumentar zoom" onClick={() => zoomBy(1.2)}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Ajustar fluxo à tela"
          onClick={() => {
            touchedRef.current = true;
            fit();
          }}
        >
          <Maximize className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Legenda mínima */}
      <p className="pointer-events-none absolute bottom-3 right-3 hidden max-w-sm text-right text-[11px] leading-relaxed text-muted-foreground sm:block">
        Gatilho → Condições (todas — E) → Ações · clique num nó para editar ·
        arraste o fundo para mover · scroll para zoom
      </p>
    </div>
  );
}
