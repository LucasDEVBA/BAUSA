import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ChannelAction — ação colorida por canal (padrão da tela favorita).
 * WhatsApp = verde · E-mail/ligação = azul BAU · alerta = vermelho.
 * `asChild` p/ renderizar como <a> (mailto/wa.me) preservando o href do caller.
 */
export type Channel = "whatsapp" | "email" | "call" | "danger" | "neutral";

const CHANNEL: Record<Channel, string> = {
  whatsapp: "border-sys-green/25 bg-sys-green/12 text-sys-green hover:bg-sys-green/20",
  email: "border-primary/20 bg-primary/10 text-primary hover:bg-primary/20",
  call: "border-sys-blue/20 bg-sys-blue/12 text-sys-blue hover:bg-sys-blue/20",
  danger: "border-sys-red/20 bg-sys-red/12 text-sys-red hover:bg-sys-red/20",
  neutral: "border-border bg-secondary text-foreground hover:bg-accent",
};

export interface ChannelActionProps
  extends React.HTMLAttributes<HTMLElement> {
  channel: Channel;
  icon?: LucideIcon;
  asChild?: boolean;
}

export const ChannelAction = forwardRef<HTMLElement, ChannelActionProps>(
  function ChannelAction({ channel, icon: Icon, asChild = false, className, children, ...props }, ref) {
    const Comp = (asChild ? Slot : "button") as "button";
    return (
      <Comp
        ref={ref as React.Ref<HTMLButtonElement>}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background [&_svg]:size-3.5",
          CHANNEL[channel],
          className,
        )}
        {...props}
      >
        {Icon && <Icon aria-hidden />}
        {children}
      </Comp>
    );
  },
);
