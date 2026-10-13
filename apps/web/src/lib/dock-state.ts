/**
 * Máquina de estados da navegação mobile (dock no rodapé e pílula do topo).
 * Regra do iOS 26 / Instagram: grande ao abrir a tela, menor ao rolar para
 * baixo, de volta numa subida intencional, no topo e no fim da página.
 *
 * Os trechos entre os marcadores "dock-state:*" são JavaScript puro de
 * propósito: o guard tests/web-dock-state.test.js roda no Node 20 do CI, sem
 * TypeScript, e avalia ESTE código (não uma cópia que poderia divergir). Os
 * tipos entram por contexto na atribuição, fora dos marcadores. Nada de
 * anotação de tipo, `as` ou `!` dentro deles: o guard quebra com SyntaxError.
 */

export interface DockScrollConfig {
  /** Até aqui (inclui o overscroll negativo do iOS) a navegação fica expandida. */
  topExpandedPx: number;
  /** Só compacta depois desta altura: um toque leve no topo não muda nada. */
  compactAfterPx: number;
  /** Descida acumulada mínima para compactar: ignora tremida e resto de momentum. */
  downSlopPx: number;
  /** Subida acumulada mínima para reexpandir: o bounce do iOS não faz piscar. */
  upReexpandPx: number;
  /** Fração rolada a partir da qual a página "acabou": expande para navegar do rodapé. */
  endProgress: number;
  /** Escala da dock compacta, medida no Instagram (0,834 a 0,847). */
  compactScale: number;
}

export interface DockScrollState {
  compact: boolean;
  /** Distância acumulada no sentido atual: positiva descendo, negativa subindo. */
  travel: number;
  /** Última posição vista, base do próximo delta. */
  y: number;
}

export interface DockScrollSample {
  y: number;
  /** scrollY / (altura rolável). */
  progress: number;
}

export interface DockModeInput {
  scrollCompact: boolean;
  reducedMotion: boolean;
  /** Foco de teclado dentro da dock: nunca encolher o que está sendo operado. */
  focusWithin: boolean;
  /** Celular deitado (altura baixa): a dock grande comeria a tela. */
  shortViewport: boolean;
  /** Campo de texto focado: o teclado virtual está aberto. */
  fieldFocused: boolean;
}

export type DockMode = "expanded" | "compact" | "hidden";

export interface HeaderModeInput {
  scrollCompact: boolean;
  reducedMotion: boolean;
  focusWithin: boolean;
  /** No desktop a pílula do topo nunca some. */
  desktop: boolean;
}

export type HeaderMode = "shown" | "hidden";

interface DockStateMachine {
  initial: (sample: DockScrollSample) => DockScrollState;
  next: (prev: DockScrollState, sample: DockScrollSample) => DockScrollState;
  dockMode: (input: DockModeInput) => DockMode;
  headerMode: (input: HeaderModeInput) => HeaderMode;
}

export const DOCK_SCROLL: Readonly<DockScrollConfig> = Object.freeze(
  // dock-state:config-start
  {
    topExpandedPx: 24,
    compactAfterPx: 80,
    downSlopPx: 12,
    upReexpandPx: 48,
    endProgress: 0.985,
    compactScale: 0.84,
  }
  // dock-state:config-end
);

export const dockStateMachine: DockStateMachine = (
  // dock-state:core-start
  {
    // Refresh ou volta do bfcache no meio da página: já nasce compacta, e o
    // chamador grava este MESMO objeto na ref e no estado (senão o primeiro
    // delta pequeno reexpande sozinho).
    initial(sample) {
      const resting = sample.y <= DOCK_SCROLL.topExpandedPx || sample.progress >= DOCK_SCROLL.endProgress;
      return { compact: !resting && sample.y > DOCK_SCROLL.compactAfterPx, travel: 0, y: sample.y };
    },

    next(prev, sample) {
      if (sample.y <= DOCK_SCROLL.topExpandedPx || sample.progress >= DOCK_SCROLL.endProgress) {
        return { compact: false, travel: 0, y: sample.y };
      }
      const delta = sample.y - prev.y;
      if (delta === 0) return prev;

      // Trocar de sentido zera o acumulado: só conta a intenção atual
      const travel = Math.sign(delta) === Math.sign(prev.travel) ? prev.travel + delta : delta;
      if (travel >= DOCK_SCROLL.downSlopPx && sample.y > DOCK_SCROLL.compactAfterPx) {
        return { compact: true, travel, y: sample.y };
      }
      if (travel <= -DOCK_SCROLL.upReexpandPx) {
        return { compact: false, travel, y: sample.y };
      }
      return { compact: prev.compact, travel, y: sample.y };
    },

    dockMode(input) {
      if (input.fieldFocused) return "hidden";
      if (input.reducedMotion || input.focusWithin) return "expanded";
      if (input.shortViewport || input.scrollCompact) return "compact";
      return "expanded";
    },

    headerMode(input) {
      if (input.desktop || input.reducedMotion || input.focusWithin) return "shown";
      return input.scrollCompact ? "hidden" : "shown";
    },
  }
  // dock-state:core-end
);
