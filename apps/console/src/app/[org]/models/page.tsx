"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  FileText,
  Boxes,
  ListOrdered,
  Eye,
  GitBranch,
  Image as ImageIcon,
  AudioLines,
  Video,
  type LucideIcon,
} from "lucide-react";
import { ModelCard } from "@/components/models/ModelCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { useOrgHref } from "@/lib/org";
import {
  CURATED_MODELS,
  CURATED_PROVIDERS,
  MODEL_CATEGORIES,
} from "@/data/curated-models";

const CATEGORY_ITEMS = [
  { label: "All types", value: "all" },
  ...MODEL_CATEGORIES.map((c) => ({ label: c.label, value: c.id })),
];

const PROVIDER_ITEMS = [
  { label: "All providers", value: "all" },
  ...CURATED_PROVIDERS.map((p) => ({ label: p, value: p })),
];

const SIZE_ITEMS = [
  { label: "All sizes", value: "all" },
  { label: "< 4B", value: "small" },
  { label: "4B - 13B", value: "mid" },
  { label: "> 13B", value: "large" },
];

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  llm: FileText,
  embedding: Boxes,
  reranker: ListOrdered,
  vision: Eye,
  decision: GitBranch,
  image: ImageIcon,
  audio: AudioLines,
  video: Video,
};

export default function AIModelsPage() {
  const router = useRouter();
  const orgHref = useOrgHref();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [provider, setProvider] = useState("all");
  const [size, setSize] = useState("all");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return CURATED_MODELS.filter((m) => {
      if (category !== "all" && m.category !== category) return false;
      if (provider !== "all" && m.provider !== provider) return false;
      if (size !== "all") {
        if (size === "small" && !(m.parameters < 4)) return false;
        if (size === "mid" && !(m.parameters >= 4 && m.parameters <= 13))
          return false;
        if (size === "large" && !(m.parameters > 13)) return false;
      }
      if (!q) return true;
      return (
        m.displayName.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q)) ||
        m.pipeline.toLowerCase().includes(q)
      );
    });
  }, [query, category, provider, size]);

  const sections = useMemo(
    () =>
      MODEL_CATEGORIES.map((c) => ({
        ...c,
        models: filtered.filter((m) => m.category === c.id),
      })).filter((s) => s.models.length > 0),
    [filtered],
  );

  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setProvider("all");
    setSize("all");
  };

  const handleDeploy = (
    modelId: string,
    runtime: string,
    modality: string,
    image: string,
  ) => {
    const params = new URLSearchParams({
      model: modelId,
      runtime,
      task: modality,
      ...(image ? { image } : {}),
      from: "catalog",
    });
    router.push(orgHref(`/models/deploy?${params.toString()}`));
  };

  return (
    <div className="mx-auto w-full max-w-[1360px]">
      {/* Page header */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-.03em]">
              AI models
            </h1>
            <span className="rounded-full border border-line bg-card px-[9px] py-px text-[11px] font-medium text-mut2">
              {CURATED_MODELS.length} models
            </span>
          </div>
          <p className="mt-1.5 text-[13.5px] text-mut2">
            Pick a model from the catalog, choose a size, and deploy it in one
            click.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(orgHref("/models/deploy"))}
          className="gb inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[13px] text-fg shadow-[inset_0_1px_0_var(--hi)] transition hover:brightness-110 active:translate-y-px"
        >
          <Plus className="size-4" strokeWidth={1.7} />
          Deploy custom model
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2.5 py-3">
        <label className="gb-f flex h-9 w-full max-w-xs items-center gap-2 rounded-xl pl-3 pr-2.5 text-mut sm:w-80">
          <Search className="size-4 flex-none" strokeWidth={1.7} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models, publishers or tasks"
            className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-mut"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Select
            value={category}
            items={CATEGORY_ITEMS}
            onValueChange={(val: string | null) => val && setCategory(val)}
          >
            <SelectTrigger>
              <span className="text-[12.5px] text-mut">Type</span>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {MODEL_CATEGORIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={provider}
            items={PROVIDER_ITEMS}
            onValueChange={(val: string | null) => val && setProvider(val)}
          >
            <SelectTrigger>
              <span className="text-[12.5px] text-mut">Provider</span>
              <SelectValue placeholder="All providers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All providers</SelectItem>
              {CURATED_PROVIDERS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={size}
            items={SIZE_ITEMS}
            onValueChange={(val: string | null) => val && setSize(val)}
          >
            <SelectTrigger>
              <span className="text-[12.5px] text-mut">Size</span>
              <SelectValue placeholder="All sizes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sizes</SelectItem>
              <SelectItem value="small">&lt; 4B</SelectItem>
              <SelectItem value="mid">4B - 13B</SelectItem>
              <SelectItem value="large">&gt; 13B</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sections */}
      {filtered.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line2 px-5 py-10 text-center">
          <b>No models match your filters</b>
          <span className="text-mut">
            Try a different search or clear the filters.
          </span>
          <button
            type="button"
            onClick={clearFilters}
            className="gb mt-1 inline-flex h-8 items-center rounded-full px-3.5 text-[13px] transition hover:brightness-110"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div>
          {sections.map((section) => {
            const Icon = CATEGORY_ICONS[section.id] ?? FileText;
            return (
              <section key={section.id} className="mb-2 mt-[22px]">
                <div className="mb-3 flex flex-wrap items-center gap-2.5">
                  <span className="grid size-[30px] flex-none place-items-center rounded-[9px] border border-line bg-band text-mut2">
                    <Icon className="size-[15px]" strokeWidth={1.7} />
                  </span>
                  <h2 className="text-[17px] font-semibold tracking-[-.015em]">
                    {section.label}
                  </h2>
                  <span className="rounded-full border border-line bg-card px-[9px] py-px text-[11px] font-medium text-mut2">
                    {section.models.length}
                  </span>
                  <span className="text-[13px] text-mut">
                    {section.description}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {section.models.map((m) => (
                    <ModelCard
                      key={m.modelId}
                      model={m}
                      onDeploy={(modelId) =>
                        handleDeploy(modelId, m.runtime, m.modality, m.image)
                      }
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
