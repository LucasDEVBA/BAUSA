import { Inter, Instrument_Serif, Plus_Jakarta_Sans, Sora } from "next/font/google";

export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Identidade "Premium Glass": Sora nos títulos, Plus Jakarta no texto e
// Instrument Serif itálico só como acento de uma palavra por título.
export const sora = Sora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sora",
});

export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  display: "swap",
  variable: "--font-instrument",
});

export const fontVariables = [inter.variable, sora.variable, jakarta.variable, instrumentSerif.variable].join(" ");
