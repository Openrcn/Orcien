import { cn } from "cn";

/* Kit class strings shared by the providers list + connect wizard */
export const K = {
  pill: "inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card px-2 text-[11px] font-medium text-mut2",
  ok: "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border border-ok/25 bg-ok/10 px-[9px] text-[11.5px] text-ok",
  warn: "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border border-warn/25 bg-warn/10 px-[9px] text-[11.5px] text-warn",
  off: "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card px-[9px] text-[11.5px] text-mut2",
  ib: "inline-grid size-7 place-items-center rounded-[9px] text-mut2 transition hover:bg-fg/5 hover:text-fg disabled:opacity-45",
  lbl: "text-[12.5px] font-medium text-mut2",
  dbx: "rounded-2xl border border-line bg-band px-1.5 pb-1.5 [box-shadow:var(--sh)]",
  inner: "overflow-hidden rounded-xl border border-line bg-card",
  kv: "flex items-center gap-2.5 border-b border-line px-4 py-[11px] text-[13.5px] last:border-0",
};

export function StatusPill({ verified }: { verified: boolean }) {
  return (
    <span className={verified ? K.ok : K.warn}>
      <i className="size-1.5 rounded-full bg-current" />
      {verified ? "Connected" : "Needs attention"}
    </span>
  );
}

/* Double-border card: header on the band, rows in the inner card,
   optional footer (buttons) inside the inner card. */
export function AsideCard({
  title,
  right,
  footer,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className={cn("mb-4", K.dbx)}>
      <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {right && <span className="ml-auto">{right}</span>}
      </div>
      {(children || footer) && (
        <div className={K.inner}>
          {children}
          {footer && (
            <div className="grid gap-2 border-t border-line p-3.5">{footer}</div>
          )}
        </div>
      )}
    </section>
  );
}
