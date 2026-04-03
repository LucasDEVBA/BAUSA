"use client";

import { forwardRef, useState, useMemo, useRef, useEffect } from "react";
import PhoneInput, { type Country, getCountryCallingCode } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

// ─── Flag emoji a partir do código ISO ────────────────────────────
function toFlagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
    .join("");
}

// ─── Tipos internos ───────────────────────────────────────────────
interface PhoneCountryOption {
  value: Country | undefined;
  label: string;
  divider?: boolean;
}

interface CustomCountrySelectProps {
  value?: Country;
  onChange: (value?: Country) => void;
  options: PhoneCountryOption[];
  disabled?: boolean;
  "aria-label"?: string;
}

// ─── Seletor de país customizado (Popover + busca + sort DDI) ─────
function CustomCountrySelect({
  value,
  onChange,
  options,
  disabled,
}: CustomCountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Foca busca ao abrir; limpa ao fechar
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
    setSearch("");
  }, [open]);

  // Lista enriquecida e ordenada por DDI uma única vez
  const enriched = useMemo(() => {
    return options
      .filter((o) => o.value != null && !o.divider)
      .map((o) => {
        const dial = (() => {
          try { return `+${getCountryCallingCode(o.value!)}`; }
          catch { return ""; }
        })();
        return {
          value: o.value!,
          label: o.label,
          flag: toFlagEmoji(o.value!),
          dial,
          dialNum: parseInt(dial.replace("+", ""), 10) || 9999,
        };
      })
      .sort((a, b) => a.dialNum - b.dialNum || a.label.localeCompare(b.label));
  }, [options]);

  // Filtra por nome ou DDI conforme busca
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.dial.replace("+", "").startsWith(q.replace("+", "")),
    );
  }, [enriched, search]);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      {/* ── Trigger ── */}
      <PopoverPrimitive.Trigger
        type="button"
        disabled={disabled}
        aria-label="Selecionar país"
        className={cn(
          "flex items-center gap-1 px-1 rounded-md",
          "bg-transparent focus:ring-0 focus:outline-none border-0",
          "text-white hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer",
          "py-3.5 sm:py-4 min-h-[44px] flex-shrink-0",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        )}
      >
        <span className="text-xl leading-none">
          {value ? toFlagEmoji(value) : "🌎"}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-white/50 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </PopoverPrimitive.Trigger>

      {/* ── Dropdown ── */}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align="start"
          sideOffset={6}
          // Evita que o focus vá para o search antes do portal montar
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            "z-[9999]",
            // Nunca ultrapassa a viewport em mobile
            "w-[min(320px,calc(100vw-24px))]",
            "overflow-hidden rounded-xl border border-white/15",
            "bg-[hsl(222,70%,13%)] text-white shadow-2xl shadow-black/60",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2",
          )}
        >
          {/* Barra de busca */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
            <Search className="h-4 w-4 text-white/40 flex-shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="País ou +DDI…"
              // font-size >= 16px evita zoom automático no iOS
              className="flex-1 bg-transparent text-white text-[16px] placeholder:text-white/35 outline-none border-0"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-white/40 hover:text-white transition-colors p-0.5 rounded"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Lista de países */}
          <div
            role="listbox"
            aria-label="Países"
            className="overflow-y-auto max-h-[min(224px,55vh)] p-1.5"
          >
            {filtered.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-6">
                Nenhum resultado
              </p>
            ) : (
              filtered.map((country) => (
                <button
                  key={country.value}
                  type="button"
                  role="option"
                  aria-selected={country.value === value}
                  onClick={() => {
                    onChange(country.value as Country);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 rounded-lg",
                    // min 44px — touch target padrão iOS/Android
                    "min-h-[44px] text-left text-[15px] cursor-pointer outline-none",
                    "transition-colors duration-100",
                    country.value === value
                      ? "bg-white/12 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white active:bg-white/15",
                  )}
                >
                  {/* Check indicator */}
                  <span className="w-4 flex-shrink-0 flex items-center justify-center">
                    {country.value === value && (
                      <Check className="h-3.5 w-3.5 text-[hsl(var(--burgundy-glow))]" />
                    )}
                  </span>
                  {/* Bandeira */}
                  <span className="text-xl leading-none flex-shrink-0">
                    {country.flag}
                  </span>
                  {/* Nome */}
                  <span className="flex-1 truncate leading-snug">
                    {country.label}
                  </span>
                  {/* DDI */}
                  {country.dial && (
                    <span className="text-xs font-mono text-white/45 flex-shrink-0 ml-auto">
                      {country.dial}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// ─── Input nativo estilizado ──────────────────────────────────────
const DarkInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex-1 min-w-0 bg-transparent border-0 py-3.5 sm:py-4",
      "text-[16px] sm:text-lg text-white placeholder:text-white/45",
      "focus:ring-0 focus:outline-none",
      className,
    )}
    {...props}
  />
));
DarkInput.displayName = "DarkInput";

// ─── Componente principal ─────────────────────────────────────────
interface FormPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: Country;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const FormPhoneInput = ({
  value,
  onChange,
  defaultCountry = "BR",
  placeholder,
  className,
  disabled,
}: FormPhoneInputProps) => {
  return (
    <div
      data-phone-input
      className={cn(
        "flex items-center border-b-2 border-white/30 focus-within:border-white transition-all duration-300 px-1",
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
    >
      <PhoneInput
        international
        defaultCountry={defaultCountry}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        placeholder={placeholder}
        inputComponent={DarkInput}
        countrySelectComponent={CustomCountrySelect}
        className="flex items-center w-full gap-0"
        disabled={disabled}
      />
    </div>
  );
};

export default FormPhoneInput;
