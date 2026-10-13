import Image from "next/image";

import { getLogoZoom, getMonogram } from "@/content/escolas";
import type { School } from "@/content/types";

type MarkSize = "sm" | "md";

interface SchoolMarkProps {
  school: School;
  size?: MarkSize;
  className?: string;
}

const PLATE_CLASS: Record<MarkSize, string> = {
  sm: "h-[34px] w-[54px] rounded-[10px] p-1",
  md: "h-14 w-[92px] rounded-2xl p-1.5",
};

const MONOGRAM_CLASS: Record<MarkSize, string> = {
  sm: "text-[12px]",
  md: "text-[21px]",
};

/**
 * Placa branca com o logo da escola (ou a sigla, quando não há logo no projeto).
 * Formato retangular: os logos variam de brasão quadrado a marca horizontal, e a placa
 * acomoda os dois sem deixar o horizontal ilegível. Decorativa: o nome vem ao lado.
 */
export default function SchoolMark({ school, size = "md", className = "" }: SchoolMarkProps) {
  const zoom = getLogoZoom(school.slug);

  return (
    <span
      aria-hidden="true"
      className={`relative grid flex-none place-items-center overflow-hidden bg-white shadow-[inset_0_0_0_1px_rgba(31,63,163,0.08),0_6px_16px_-8px_rgba(15,35,87,0.35)] ${PLATE_CLASS[size]} ${className}`}
    >
      {school.logo ? (
        <span className="relative block h-full w-full">
          <Image
            src={school.logo}
            alt=""
            fill
            sizes={size === "sm" ? "54px" : "92px"}
            className="object-contain"
            style={zoom === 1 ? undefined : { transform: `scale(${zoom})` }}
          />
        </span>
      ) : (
        <span
          className={`ba-grad-text font-[family-name:var(--ba-display)] font-bold leading-none tracking-[-0.04em] ${MONOGRAM_CLASS[size]}`}
        >
          {getMonogram(school)}
        </span>
      )}
    </span>
  );
}
