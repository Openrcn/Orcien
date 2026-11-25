"use client";

import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { cn } from "cn";
import { ModelCard, ModelItem } from "./ModelCard";
import { ModelDetailCard } from "./ModelDetailCard";
import { ModelDetails } from "./model-types";
import { K } from "@/components/providers/kit";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

export interface RuntimeTask {
  id: string;
  name: string;
  description?: string;
}

export interface RuntimeCapabilityFacet {
  id: string;
  name: string;
  description?: string;
}

export interface RuntimeCapability {
  id: string;
  name: string;
  model_source?: string;
  tasks: RuntimeTask[];
  capabilities?: RuntimeCapabilityFacet[];
}

interface ModelSearchPanelProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  searchResults: ModelItem[];
  selectedModel: string;
  onSelectModel: (id: string) => void;
  modality: string;
  onModalityChange: (val: string) => void;
  runtime: string;
  onRuntimeChange: (val: string) => void;
  modalities: RuntimeTask[];
  runtimes: RuntimeCapability[];
  isLoadingCapabilities: boolean;
  capabilities: string[];
  onToggleCapability: (id: string) => void;
  modelDetails: ModelDetails | null;
  requiredVram: number;
  hfToken: string;
  onHfTokenChange: (token: string) => void;
}

/* Step 1 — Find a model: filters card + stacked model rows with inline expansion */
export function ModelSearchPanel({
  searchQuery,
  onSearchChange,
  onSearch,
  isSearching,
  searchResults,
  selectedModel,
  onSelectModel,
  modality,
  onModalityChange,
  runtime,
  onRuntimeChange,
  modalities,
  runtimes,
  isLoadingCapabilities,
  capabilities,
  onToggleCapability,
  modelDetails,
  requiredVram,
  hfToken,
  onHfTokenChange,
}: ModelSearchPanelProps) {
  const [sortBy, setSortBy] = useState("trending");

  const supportedRuntimes = useMemo(
    () => runtimes.filter((r) => r.tasks.some((t) => t.id === modality)),
    [runtimes, modality],
  );

  const selectedRuntime = useMemo(
    () => runtimes.find((r) => r.id === runtime),
    [runtimes, runtime],
  );

  const visibleModalities = selectedRuntime?.tasks ?? modalities;

  const handleRuntimeSelect = (val: string) => {
    onRuntimeChange(val);
    const next = runtimes.find((r) => r.id === val);
    if (next && !next.tasks.some((t) => t.id === modality) && next.tasks[0]) {
      onModalityChange(next.tasks[0].id);
    }
  };

  const handleModalitySelect = (val: string) => {
    onModalityChange(val);
    const available = runtimes.filter((r) => r.tasks.some((t) => t.id === val));
    if (!available.some((r) => r.id === runtime) && available[0]) {
      onRuntimeChange(available[0].id);
    }
  };

  const sortedModels = useMemo(() => {
    const list = [...searchResults];
    if (sortBy === "downloads") {
      list.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
    } else if (sortBy === "likes") {
      list.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    }
    return list;
  }, [searchResults, sortBy]);

  const selectedTaskLabel = modalities.find((t) => t.id === modality)?.name;
  const modelSource =
    selectedRuntime?.model_source ?? (runtime === "ollama" ? "ollama" : "huggingface");
  const isOllama = modelSource === "ollama";

  return (
    <div className="space-y-5">
      <section className={K.dbx}>
        {/* Header */}
        <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
          <h3 className="text-[15px] font-semibold tracking-[-.01em]">
            Find a model
          </h3>
          <span className={cn(K.pill, "ml-auto")}>
            {isOllama ? "Ollama Registry" : "Hugging Face Hub"}
          </span>
        </div>

        <div className={K.inner}>
          {/* Filters */}
          <div className="grid gap-3 border-b border-line p-3.5">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-mut" />
              <Input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                placeholder={
                  isOllama
                    ? "Enter exact Ollama model name, e.g. llama3.2, qwen2.5:7b, nomic-embed-text"
                    : "Search models, e.g. llama, qwen, embedding"
                }
                className="pl-10 pr-9"
              />
              {isSearching && (
                <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-mut" />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={modality}
                onValueChange={(val: string | null) =>
                  val && handleModalitySelect(val)
                }
              >
                <SelectTrigger className="min-w-[170px] text-[13px] data-[size=default]:h-11">
                  <SelectValue placeholder="Modality" />
                </SelectTrigger>
                <SelectContent>
                  {visibleModalities.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={runtime}
                onValueChange={(val: string | null) =>
                  val && handleRuntimeSelect(val)
                }
              >
                <SelectTrigger className="min-w-[150px] text-[13px] data-[size=default]:h-11">
                  <SelectValue placeholder="Runtime" />
                </SelectTrigger>
                <SelectContent>
                  {supportedRuntimes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="ml-auto">
                <Select
                  value={sortBy}
                  onValueChange={(val: string | null) => val && setSortBy(val)}
                >
                  <SelectTrigger className="min-w-[150px] text-[13px] data-[size=default]:h-11">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trending">Trending</SelectItem>
                    <SelectItem value="downloads">Most downloaded</SelectItem>
                    <SelectItem value="likes">Most liked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Runtime capability facets (backend driven) */}
            {selectedRuntime?.capabilities &&
              selectedRuntime.capabilities.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-mut">Capabilities:</span>
                  {selectedRuntime.capabilities.map((cap) => {
                    const active = capabilities.includes(cap.id);
                    return (
                      <button
                        key={cap.id}
                        type="button"
                        title={cap.description}
                        onClick={() => onToggleCapability(cap.id)}
                        className={cn(
                          K.pill,
                          "transition",
                          active
                            ? "border-accent/40 bg-accent/10 text-accent-t"
                            : "hover:text-fg",
                        )}
                      >
                        {cap.name}
                      </button>
                    );
                  })}
                </div>
              )}
          </div>

          {/* Model rows */}
          <div className="max-h-[1040px] overflow-y-auto">
            {sortedModels.length === 0 ? (
              <div className="grid justify-items-center gap-2 px-6 py-14 text-center">
                <Search className="size-5 text-mut" strokeWidth={1.7} />
                <b className="text-[13px] font-medium text-mut2">
                  {isLoadingCapabilities
                    ? "Loading runtimes…"
                    : isSearching
                      ? "Searching…"
                      : searchResults.length === 0
                        ? "No models to show yet"
                        : "No models match your search"}
                </b>
                <span className="text-[12px] text-mut">
                  {isLoadingCapabilities
                    ? "Fetching runtime capabilities from the backend."
                    : !runtime || !modality
                      ? "Select a modality and runtime to view models."
                      : isOllama
                        ? "Enter an exact Ollama model name (e.g. llama3.2 or qwen2.5:7b) or clear the search to browse curated picks."
                        : searchResults.length === 0
                          ? "Search by name to find models on the Hub."
                          : "Try a different query or clear capabilities."}
                </span>
              </div>
            ) : (
              sortedModels.map((model) => {
                const isSelected = selectedModel === model.id;
                return (
                  <div
                    key={model.id}
                    className={cn(
                      isSelected
                        ? "border border-accent-t/30"
                        : "border-b border-line last:border-0",
                    )}
                  >
                    <ModelCard
                      model={model}
                      selected={isSelected}
                      onClick={() => onSelectModel(model.id)}
                    />
                    {isSelected && (
                      <div className="border-t border-accent-t/15 bg-band/40 px-4 py-4">
                        <ModelDetailCard
                          modelId={selectedModel}
                          modelSource={modelSource}
                          modelDetails={modelDetails}
                          taskLabel={selectedTaskLabel}
                          requiredVram={requiredVram}
                          hfToken={hfToken}
                          onHfTokenChange={onHfTokenChange}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}