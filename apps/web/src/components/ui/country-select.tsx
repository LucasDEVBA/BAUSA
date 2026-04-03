import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export interface Country {
  code: string;
  name: string;
  flag: string;
  dial: string;
}

// Ordenado por DDI numérico crescente (+1 → +598)
export const COUNTRIES: Country[] = [
  { code: "US",    name: "Estados Unidos", flag: "🇺🇸", dial: "+1"   },
  { code: "ES",    name: "Espanha",        flag: "🇪🇸", dial: "+34"  },
  { code: "GB",    name: "Reino Unido",    flag: "🇬🇧", dial: "+44"  },
  { code: "PE",    name: "Peru",           flag: "🇵🇪", dial: "+51"  },
  { code: "MX",    name: "México",         flag: "🇲🇽", dial: "+52"  },
  { code: "AR",    name: "Argentina",      flag: "🇦🇷", dial: "+54"  },
  { code: "BR",    name: "Brasil",         flag: "🇧🇷", dial: "+55"  },
  { code: "CL",    name: "Chile",          flag: "🇨🇱", dial: "+56"  },
  { code: "CO",    name: "Colômbia",       flag: "🇨🇴", dial: "+57"  },
  { code: "PT",    name: "Portugal",       flag: "🇵🇹", dial: "+351" },
  { code: "PY",    name: "Paraguai",       flag: "🇵🇾", dial: "+595" },
  { code: "UY",    name: "Uruguai",        flag: "🇺🇾", dial: "+598" },
  { code: "OTHER", name: "Outro país",     flag: "🌎",  dial: ""     },
];

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CountrySelect({ value, onChange, className }: CountrySelectProps) {
  const BR = COUNTRIES.find((c) => c.code === "BR")!;
  const selected = COUNTRIES.find((c) => c.code === value) ?? BR;

  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange}>
      {/* ── Trigger ── */}
      <SelectPrimitive.Trigger
        className={cn(
          "w-full flex items-center justify-between gap-2",
          "bg-transparent border-0 border-b-2 border-white/30",
          "data-[state=open]:border-white focus:border-white",
          "focus:ring-0 focus:outline-none rounded-none",
          "px-1 py-3.5 sm:py-4 text-[16px] sm:text-lg text-white",
          "transition-all duration-300 cursor-pointer min-h-[44px]",
          className,
        )}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="text-xl leading-none flex-shrink-0">{selected.flag}</span>
          <span className="truncate">{selected.name}</span>
        </div>
        <ChevronDown className="h-4 w-4 text-white/50 flex-shrink-0" />
      </SelectPrimitive.Trigger>

      {/* ── Dropdown ── */}
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "z-[9999] w-[var(--radix-select-trigger-width)]",
            "overflow-hidden rounded-xl border border-white/15",
            "bg-[hsl(222,70%,13%)] text-white shadow-2xl shadow-black/50",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2",
          )}
        >
          <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1.5 text-white/40 hover:text-white">
            <ChevronDown className="h-4 w-4 rotate-180" />
          </SelectPrimitive.ScrollUpButton>

          <SelectPrimitive.Viewport className="p-1.5 max-h-64 overflow-y-auto">
            {COUNTRIES.map((country) => (
              <SelectPrimitive.Item
                key={country.code}
                value={country.code}
                className={cn(
                  "relative flex items-center gap-3 px-2.5 rounded-lg",
                  // min 44px — touch target padrão iOS/Android
                  "min-h-[44px] cursor-pointer select-none outline-none",
                  "text-[15px] text-white/80 transition-colors duration-100",
                  "data-[highlighted]:bg-white/10 data-[highlighted]:text-white",
                  "data-[state=checked]:text-white",
                )}
              >
                {/* Check indicator */}
                <span className="w-4 flex-shrink-0 flex items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-3.5 w-3.5 text-[hsl(var(--burgundy-glow))]" />
                  </SelectPrimitive.ItemIndicator>
                </span>

                {/* Bandeira */}
                <span className="text-xl leading-none flex-shrink-0">{country.flag}</span>

                {/* Nome */}
                <SelectPrimitive.ItemText asChild>
                  <span className="flex-1 leading-snug">{country.name}</span>
                </SelectPrimitive.ItemText>

                {/* DDI */}
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>

          <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1.5 text-white/40 hover:text-white">
            <ChevronDown className="h-4 w-4" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
