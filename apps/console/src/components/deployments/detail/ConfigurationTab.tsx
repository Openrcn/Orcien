/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { Braces, LayoutList } from "lucide-react";
import { SpecViewer } from "./SpecViewer";
import { DetailCard } from "./DetailCard";

function highlightJSON(jsonString: string) {
  if (!jsonString) return null;
  const regex =
    /(\"(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*\"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(jsonString)) !== null) {
    const textBefore = jsonString.slice(lastIndex, match.index);
    if (textBefore) parts.push(textBefore);

    const token = match[0];
    if (/^"/.test(token)) {
      if (/:$/.test(token)) {
        parts.push(
          <span key={match.index} className="text-sky-400 font-medium">
            {token.slice(0, -1)}
          </span>,
        );
        parts.push(":");
      } else {
        parts.push(
          <span key={match.index} className="text-emerald-300">
            {token}
          </span>,
        );
      }
    } else if (/true|false/.test(token)) {
      parts.push(
        <span key={match.index} className="text-amber-400 font-semibold">
          {token}
        </span>,
      );
    } else if (/null/.test(token)) {
      parts.push(
        <span key={match.index} className="text-rose-400 italic">
          {token}
        </span>,
      );
    } else {
      parts.push(
        <span key={match.index} className="text-purple-300 font-medium">
          {token}
        </span>,
      );
    }

    lastIndex = regex.lastIndex;
  }

  const textAfter = jsonString.slice(lastIndex);
  if (textAfter) parts.push(textAfter);

  return parts;
}

export function ConfigurationTab({ config }: { config: any }) {
  const pretty = config ? JSON.stringify(config, null, 2) : "";

  return (
    <div className="space-y-5">
      {config && (
        <DetailCard
          title="Spec details"
          subtitle="Parsed deployment specification"
          icon={<LayoutList className="size-[15px]" strokeWidth={1.7} />}
        >
          <SpecViewer config={config} />
        </DetailCard>
      )}

      <DetailCard
        title="Raw JSON"
        subtitle="Full configuration payload"
        icon={<Braces className="size-[15px]" strokeWidth={1.7} />}
        action={
          pretty ? (
            <CopyButton
              value={pretty}
              size={14}
              title="Copy configuration JSON"
            />
          ) : undefined
        }
      >
        {pretty ? (
          <div className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed">
            {pretty.split("\n").map((line, i) => (
              <div
                key={i}
                className="flex gap-3 border-b border-line/30 py-[3px] last:border-b-0"
              >
                <span className="w-6 shrink-0 select-none text-right text-mut2 opacity-40">
                  {i + 1}
                </span>
                <code className="min-w-0 flex-1 whitespace-pre-wrap break-all">
                  {highlightJSON(line)}
                </code>
              </div>
            ))}
          </div>
        ) : (
          <div className="m-3 rounded-xl border border-dashed border-line2 bg-field p-8 text-center text-[12px] text-mut2">
            No raw configuration specification stored for this deployment.
          </div>
        )}
      </DetailCard>
    </div>
  );
}
