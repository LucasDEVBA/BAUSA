"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { trackCtaClick } from "@/lib/tracking/events";

type CtaSource = Parameters<typeof trackCtaClick>[0];
type CtaVariant = "primary" | "ghost" | "light";

interface BrandCtaProps {
  children: ReactNode;
  href?: string;
  source?: CtaSource;
  variant?: CtaVariant;
  className?: string;
}

const VARIANT_CLASS: Record<CtaVariant, string> = {
  primary: "ba-btn-primary",
  ghost: "ba-btn-ghost",
  light: "ba-btn-light",
};

/** Botão da identidade. Âncoras (#...) viram <a>; rotas usam o Link com idioma. */
export default function BrandCta({ children, href = "/forms", source, variant = "primary", className = "" }: BrandCtaProps) {
  const classes = `ba-btn ${VARIANT_CLASS[variant]} ${className}`;
  const content =
    variant === "primary" ? (
      <>
        {children}
        <span className="ba-arrow" aria-hidden="true">
          <ArrowRight />
        </span>
      </>
    ) : variant === "light" ? (
      <>
        {children}
        <ArrowRight aria-hidden="true" />
      </>
    ) : (
      children
    );

  if (href.startsWith("#")) {
    return (
      <a href={href} className={classes}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} onClick={source ? () => trackCtaClick(source) : undefined}>
      {content}
    </Link>
  );
}
