"use client";

import { useState } from "react";
import { Eye, EyeOff, Upload } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import type { ProviderField } from "./api";

interface Props {
  field: ProviderField;
  value: unknown;
  file: File | null;
  onChange: (key: string, value: unknown) => void;
  onFileChange: (key: string, file: File | null) => void;
}

export function ProviderFieldInput({
  field,
  value,
  file,
  onChange,
  onFileChange,
}: Props) {
  const [showSecret, setShowSecret] = useState(false);

  if (field.type === "boolean") {
    const checked = value === true || value === "true";
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(field.key, !checked)}
        className="flex h-11 items-center gap-2.5"
      >
        {/* Kit toggle */}
        <span
          className={cn(
            "relative h-[22px] w-9 flex-none rounded-full shadow-inner transition",
            checked ? "bg-accent" : "bg-line2",
          )}
        >
          <span
            className={cn(
              "absolute left-[3px] top-[3px] size-4 rounded-full shadow transition",
              checked ? "translate-x-[14px] bg-on-accent" : "bg-white",
            )}
          />
        </span>
        <span className="text-[13px] text-mut2">
          {checked ? "Enabled" : "Disabled"}
        </span>
      </button>
    );
  }

  if (field.type === "select" && field.options && field.options.length > 0) {
    return (
      <Select
        value={value ?? field.default ?? ""}
        onValueChange={(val: string) => val && onChange(field.key, val)}
      >
        <SelectTrigger className="w-full text-[13.5px] data-[size=default]:h-11">
          <SelectValue placeholder={field.placeholder || "Select an option"} />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "file") {
    return (
      <label className="flex h-11 w-full cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line2 bg-field px-3.5 text-[13px] text-mut2 transition hover:border-accent hover:text-fg">
        <Upload className="size-4 shrink-0" strokeWidth={1.7} />
        <span className="truncate">{file ? file.name : "Choose file"}</span>
        <input
          type="file"
          className="hidden"
          onChange={(e) => onFileChange(field.key, e.target.files?.[0] || null)}
        />
      </label>
    );
  }

  const isPassword = field.type === "password";

  return (
    <div className="relative">
      <Input
        type={
          isPassword && !showSecret
            ? "password"
            : field.type === "number"
              ? "number"
              : "text"
        }
        placeholder={field.placeholder || field.default || ""}
        value={String(value ?? field.default ?? "")}
        onChange={(e) => onChange(field.key, e.target.value)}
        autoComplete="off"
        className={cn(
          (isPassword || field.secret) && "font-mono text-[13px]",
          isPassword && "pr-10",
        )}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShowSecret((s) => !s)}
          aria-label={showSecret ? "Hide secret" : "Show secret"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-mut transition hover:text-fg"
        >
          {showSecret ? (
            <EyeOff className="size-4" strokeWidth={1.7} />
          ) : (
            <Eye className="size-4" strokeWidth={1.7} />
          )}
        </button>
      )}
    </div>
  );
}
