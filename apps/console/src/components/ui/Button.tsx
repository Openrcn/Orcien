import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const variantClasses = {
  // green gradient fill + light border + inset highlight (kit: btn-pri)
  primary: "btn-pri border hover:brightness-110",
  // gradient border on card fill (kit: gb)
  secondary:
    "gb text-fg shadow-[inset_0_1px_0_var(--hi)] hover:brightness-110",
  outline: "border border-line2 text-fg hover:bg-fg/5",
  ghost: "text-mut2 hover:bg-fg/5 hover:text-fg",
  danger: "border border-bad/45 text-bad hover:bg-bad/10",
};

const sizeClasses = {
  sm: "h-8 px-3.5 text-[13px]",
  md: "h-10 px-5 text-sm",
  lg: "h-11 px-6 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </button>
  );
}
