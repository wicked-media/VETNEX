import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 focus-visible:outline-primary",
  secondary:
    "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 focus-visible:outline-secondary",
  outline:
    "border border-border bg-card text-foreground shadow-xs hover:bg-muted focus-visible:outline-primary",
  ghost: "text-foreground hover:bg-muted focus-visible:outline-primary",
  danger:
    "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:outline-destructive",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-md px-3 text-[13px]",
  md: "h-9.5 gap-2 rounded-md px-4 text-sm",
  lg: "h-11 gap-2 rounded-md px-6 text-sm",
  icon: "h-9 w-9 rounded-md",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  leadingIcon,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:pointer-events-none disabled:opacity-55",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        leadingIcon
      )}
      {children}
    </button>
  );
}
