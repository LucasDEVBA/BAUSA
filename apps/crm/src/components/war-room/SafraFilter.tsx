"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface SafraFilterProps {
  safras: string[];
  className?: string;
}

export function SafraFilter({ safras, className }: SafraFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSafra = searchParams.get("safra") || "";

  const handleChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("safra", value);
      } else {
        params.delete("safra");
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Filter className="h-4 w-4 text-zinc-500" />
      <select
        value={currentSafra}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-1.5 text-sm text-zinc-300 outline-none transition-colors hover:border-zinc-600 focus:border-indigo-500"
      >
        <option value="">Todas as Safras</option>
        {safras.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
