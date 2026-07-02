import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface ScrollListProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Reserva calha p/ o scrollbar fino colar na borda do card sem cortar o conteúdo. Default: true. */
  gutter?: boolean;
}

/**
 * Área de lista com rolagem vertical dentro de um card de altura fixa.
 *
 * O card pai deve ser `flex flex-col` com altura definida (ex.: `h-[24rem]`);
 * o cabeçalho fica `shrink-0` e este `ScrollList` ocupa o espaço restante,
 * rolando internamente quando a lista excede a altura do card.
 */
export const ScrollList = forwardRef<HTMLDivElement, ScrollListProps>(
  ({ className, gutter = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "crm-scroll min-h-0 flex-1 overflow-y-auto",
        gutter && "-mr-1.5 pr-1.5",
        className,
      )}
      {...props}
    />
  ),
);
ScrollList.displayName = "ScrollList";
