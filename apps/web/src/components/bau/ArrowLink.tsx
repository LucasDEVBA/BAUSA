import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * CTA secundário (BAU-02 §2.5): texto + seta, sem caixa, com hairline azul
 * que desliza no hover. É o link de continuidade da narrativa — sempre aponta
 * para a próxima página do percurso, nunca para o formulário.
 *
 * Server Component: a interação é 100% CSS.
 */
export function ArrowLink({
  href,
  children,
  className,
  tone = "dark",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative inline-flex min-h-[44px] items-center gap-2 text-[15px]",
        tone === "dark" ? "text-bau-ivory" : "text-bau-navy-deep",
        className,
      )}
    >
      <span>{children}</span>
      <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
        →
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-1 h-px origin-left scale-x-0 bg-bau-blue transition-transform duration-200 group-hover:scale-x-100"
      />
    </Link>
  );
}
