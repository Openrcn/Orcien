import type { ReactNode } from "react";
import { cn } from "cn";
import { K } from "@/components/providers/kit";

type DetailCardProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
};

/**
 * Double-border kit card: title band on top, content in the inner surface.
 * Used by the deployment / node detail sections for consistent separation.
 */
export function DetailCard({
  title,
  subtitle,
  icon,
  action,
  children,
  className,
  bodyClassName,
}: DetailCardProps) {
  return (
    <section className={cn(K.dbx, className)}>
      <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
        {icon && (
          <span className="grid size-7 shrink-0 place-items-center rounded-[9px] border border-line bg-card text-mut2">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold tracking-[-.01em]">
            {title}
          </h3>
          {subtitle && <p className="text-[11.5px] text-mut">{subtitle}</p>}
        </div>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>
      <div className={cn(K.inner, bodyClassName)}>{children}</div>
    </section>
  );
}
