import { IBM_Plex_Mono, Inter, Libre_Caslon_Display, Libre_Caslon_Text } from "next/font/google";

// `next/font` só aceita argumentos literais (é analisado estaticamente no
// build) — os subsets NÃO podem ser extraídos para uma constante compartilhada.
// `latin-ext` cobre os acentos do português (ã, ç, õ, é) sem cair no fallback
// do sistema em glifos de borda.

export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
});

/**
 * Display da marca — H1, H2 e frases monumentais.
 *
 * Libre Caslon Display só existe em weight 400: elegância vem do tamanho, nunca
 * do peso. Aplicar `font-bold` aqui produz synthetic bold — os componentes de
 * `src/components/bau/` travam o peso por isso.
 */
export const caslonDisplay = Libre_Caslon_Display({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
  variable: "--font-caslon-display",
});

/** Caslon de texto — blocos editoriais longos e o itálico das assinaturas. */
export const caslonText = Libre_Caslon_Text({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-caslon-text",
});

/** Utilitária — eyebrows, labels, dados e o timestamp do frame REC. */
export const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const fontVariables = [
  inter.variable,
  caslonDisplay.variable,
  caslonText.variable,
  plexMono.variable,
].join(" ");
