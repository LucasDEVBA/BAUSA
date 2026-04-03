"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Lightweight scroll-reveal hook using IntersectionObserver.
 * 
 * - Elements are ALWAYS visible (min opacity ~0.92) — no content hiding.
 * - Animation is purely cosmetic: subtle translateY + opacity polish.
 * - Respects `prefers-reduced-motion` automatically.
 * - Uses GPU-accelerated properties only (transform, opacity).
 * - Fires once per element — no re-triggering.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
    options?: {
        threshold?: number;
        rootMargin?: string;
    }
) {
    const ref = useRef<T>(null);
    const [isRevealed, setIsRevealed] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        // Respect reduced motion preference
        const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (prefersReduced) {
            setIsRevealed(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsRevealed(true);
                    observer.unobserve(el);
                }
            },
            {
                threshold: options?.threshold ?? 0.1,
                rootMargin: options?.rootMargin ?? "0px 0px -40px 0px",
            }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [options?.threshold, options?.rootMargin]);

    return { ref, isRevealed };
}

/**
 * CSS class helper for scroll-reveal elements.
 * Apply to className for automatic reveal styling.
 * 
 * Usage:
 *   const { ref, isRevealed } = useScrollReveal();
 *   <div ref={ref} className={`${revealClass(isRevealed)} ...`}>
 */
export const revealClass = (isRevealed: boolean, variant: "up" | "left" | "right" | "scale" = "up") => {
    const base = "scroll-reveal";
    const variantClass = `scroll-reveal--${variant}`;
    return `${base} ${variantClass}${isRevealed ? " scroll-revealed" : ""}`;
};
