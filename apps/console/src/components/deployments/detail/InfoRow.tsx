import type { ReactNode } from "react";
import { CopyButton } from "@/components/ui/CopyButton";

type InfoRowProps = {
  label: string;
  value: ReactNode;
  monospace?: boolean;
  highlight?: boolean;
  copyable?: boolean;
  copyValue?: string;
  grow?: boolean;
};

export function InfoRow({
  label,
  value,
  monospace = false,
  highlight = false,
  copyable = false,
  copyValue,
  grow = false,
}: InfoRowProps) {
  const textToCopy =
    copyValue ?? (typeof value === "string" ? value : undefined);

  return (
    <div
      className={`flex items-center gap-4 border-b border-line px-4 py-[11px] text-[13.5px] last:border-b-0 ${grow ? "flex-1" : ""}`}
    >
      <div className="w-40 shrink-0 text-[12.5px] font-medium text-mut2">
        {label}
      </div>
      <div
        className={[
          "flex min-w-0 flex-1 items-center justify-between gap-2",
          highlight ? "font-semibold text-fg" : "text-fg",
          monospace ? "font-mono" : "",
        ].join(" ")}
      >
        <span className="truncate">{value}</span>
        {(copyable || textToCopy) && textToCopy && (
          <CopyButton value={textToCopy} size={13} />
        )}
      </div>
    </div>
  );
}
