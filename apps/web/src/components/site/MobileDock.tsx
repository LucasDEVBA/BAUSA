"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, type Transition } from "framer-motion";
import { ArrowRight, Compass, GraduationCap, House, SquarePlay, type LucideIcon } from "lucide-react";

import { DOCK_NAV, isActivePath, type NavKey } from "@/config/navigation";
import { useLanguage } from "@/i18n";
import { Link, usePathname } from "@/i18n/navigation";
import { DOCK_SCROLL, dockStateMachine, type DockScrollSample, type DockScrollState } from "@/lib/dock-state";
import { trackCtaClick } from "@/lib/tracking/events";

export const DESKTOP_QUERY = "(min-width: 1024px)";
// Celular deitado: a dock grande ocuparia ~16% da tela, então já nasce compacta
const SHORT_VIEWPORT_QUERY = "(max-height: 500px)";

const EDITABLE_SELECTOR = [
  'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"])',
  "textarea",
  "select",
  '[contenteditable]:not([contenteditable="false"])',
].join(", ");

/** Springs compartilhados por dock e header, para as duas barras andarem juntas. */
export const CHROME_TRANSITION = {
  compact: { type: "spring", visualDuration: 0.36, bounce: 0.12 },
  // Um leve respiro ao crescer, como o liquid glass do iOS 26
  expand: { type: "spring", visualDuration: 0.42, bounce: 0.22 },
  hide: { duration: 0.22, ease: [0.4, 0, 1, 1] },
  pill: { type: "spring", visualDuration: 0.32, bounce: 0.25 },
  instant: { duration: 0 },
} satisfies Record<string, Transition>;

// Percentual da própria altura: some por inteiro abaixo da borda, sombra incluída
const DOCK_HIDDEN_Y = "175%";

const DOCK_ICONS: Partial<Record<NavKey, LucideIcon>> = {
  home: House,
  metodo: Compass,
  historias: SquarePlay,
  escolas: GraduationCap,
};

function readScrollSample(): DockScrollSample {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const y = window.scrollY;
  return { y, progress: scrollable > 0 ? y / scrollable : 0 };
}

/**
 * "Rolou para baixo" segundo a máquina de dock-state. Dock e header usam
 * cada um a sua instância: mesma regra, mesma rolagem, mesmo resultado.
 */
export function useScrollCompact(): boolean {
  const { scrollY, scrollYProgress } = useScroll();
  const stateRef = useRef<DockScrollState | null>(null);
  const [compact, setCompact] = useState(false);

  // Refresh/bfcache no meio da página: ref e estado nascem juntos do mesmo objeto
  useEffect(() => {
    const initial = dockStateMachine.initial(readScrollSample());
    stateRef.current = initial;
    setCompact(initial.compact);
  }, []);

  // O useScroll grava scrollY ANTES do progresso: ouvir o progresso garante os
  // dois valores do mesmo frame (senão o "fim da página" chega um frame atrasado)
  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const sample = { y: scrollY.get(), progress };
    const next = dockStateMachine.next(stateRef.current ?? dockStateMachine.initial(sample), sample);
    stateRef.current = next;
    setCompact(next.compact);
  });

  return compact;
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function isKeyboardFocus(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    // Navegador sem :focus-visible: tratar como teclado mantém a barra visível (lado seguro)
    return true;
  }
}

/**
 * Foco de TECLADO dentro da barra. Toque não conta: no Chrome Android o link
 * tocado fica focado depois da navegação e travaria a dock expandida.
 */
export function useKeyboardFocusWithin() {
  const [focusWithin, setFocusWithin] = useState(false);

  const onFocus = useCallback((event: ReactFocusEvent<HTMLElement>) => {
    setFocusWithin(isKeyboardFocus(event.target));
  }, []);

  const onBlur = useCallback((event: ReactFocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !event.currentTarget.contains(next)) setFocusWithin(false);
  }, []);

  return { focusWithin, focusHandlers: { onFocus, onBlur } };
}

/** Campo de texto focado = teclado virtual aberto: a dock sai de cena. */
function useEditableFocus(): boolean {
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const isEditable = (target: EventTarget | null) => target instanceof Element && target.matches(EDITABLE_SELECTOR);
    const onFocusIn = (event: FocusEvent) => setFocused(isEditable(event.target));
    const onFocusOut = (event: FocusEvent) => setFocused(isEditable(event.relatedTarget));

    setFocused(isEditable(document.activeElement));
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return focused;
}

// WCAG 2.5.3: o nome acessível precisa conter o rótulo visível ("Apply" não
// está em "Start strategic assessment"), então o rótulo vai na frente quando falta
function ctaAccessibleName(visibleLabel: string, action: string): string {
  return action.toLocaleLowerCase().includes(visibleLabel.toLocaleLowerCase()) ? action : `${visibleLabel}, ${action}`;
}

/**
 * Dock de navegação mobile/tablet (<1024px), no estilo da tab bar do
 * Instagram no iOS 26: pílula de vidro flutuante, grande ao abrir a tela e
 * menor (escala 0,84 a partir do centro) ao rolar. Ativo pela rota.
 */
export default function MobileDock() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const reducedMotion = useReducedMotion() ?? false;
  const scrollCompact = useScrollCompact();
  const shortViewport = useMediaQuery(SHORT_VIEWPORT_QUERY);
  const fieldFocused = useEditableFocus();
  const { focusWithin, focusHandlers } = useKeyboardFocusWithin();

  const mode = dockStateMachine.dockMode({ scrollCompact, reducedMotion, focusWithin, shortViewport, fieldFocused });
  const compact = mode === "compact";
  const hidden = mode === "hidden";

  const activeIndex = DOCK_NAV.findIndex((item) => item.key !== "apply" && isActivePath(pathname, item.href));
  // Sem item ativo (Sobre, páginas legais) a pílula só apaga, sem voltar ao
  // primeiro item: ao reaparecer ela desliza do último lugar onde esteve
  const [pillIndex, setPillIndex] = useState(Math.max(activeIndex, 0));
  if (activeIndex >= 0 && activeIndex !== pillIndex) setPillIndex(activeIndex);

  const scrollToTop = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };

  const barTransition = reducedMotion
    ? CHROME_TRANSITION.instant
    : hidden
      ? CHROME_TRANSITION.hide
      : compact
        ? CHROME_TRANSITION.compact
        : CHROME_TRANSITION.expand;

  return (
    <div className="ba-dock-shell lg:hidden print:hidden" inert={hidden}>
      <motion.nav
        aria-label={t("header.dockLabel")}
        className="ba-glass ba-dock"
        data-compact={compact || undefined}
        initial={false}
        animate={{
          scale: compact ? DOCK_SCROLL.compactScale : 1,
          y: hidden ? DOCK_HIDDEN_Y : "0%",
          opacity: hidden ? 0 : 1,
        }}
        transition={barTransition}
        {...focusHandlers}
      >
        <div className="relative h-full">
          {/* O trilho tem a largura de UMA coluna e anda 100% dela por item; a
              pílula dentro dele é que vaza 5px para cada lado */}
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-[6px] left-0 w-1/5"
            initial={false}
            animate={{ x: `${pillIndex * 100}%`, opacity: activeIndex >= 0 ? 1 : 0 }}
            transition={reducedMotion ? CHROME_TRANSITION.instant : CHROME_TRANSITION.pill}
          >
            <span className="ba-dock-pill" />
          </motion.span>

          <ul className="relative grid h-full grid-cols-5">
            {DOCK_NAV.map((item, index) => {
              const label = t(item.labelKey);

              if (item.key === "apply") {
                return (
                  <li key={item.key} className="min-w-0">
                    <Link
                      href={item.href}
                      onClick={() => trackCtaClick("dock")}
                      aria-label={ctaAccessibleName(label, t("landing.hero.cta"))}
                      className="ba-dock-link ba-dock-cta"
                    >
                      <span className="ba-dock-orb" aria-hidden="true">
                        <ArrowRight strokeWidth={2.4} />
                      </span>
                      <span className="ba-dock-label">{label}</span>
                    </Link>
                  </li>
                );
              }

              const Icon = DOCK_ICONS[item.key];
              const active = index === activeIndex;
              return (
                <li key={item.key} className="min-w-0">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={active ? scrollToTop : undefined}
                    className="ba-dock-link"
                  >
                    <span className="ba-dock-icon" aria-hidden="true">
                      {Icon && <Icon strokeWidth={active ? 2.4 : 1.9} />}
                    </span>
                    <span className="ba-dock-label">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </motion.nav>
    </div>
  );
}
