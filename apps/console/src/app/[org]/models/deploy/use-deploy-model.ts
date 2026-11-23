"use client";
import { apiFetch } from "@/lib/api";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfigOption } from "@/components/deploy-model/AdvancedConfigSection";
import { ModelItem } from "@/components/deploy-model/ModelCard";
import {
  ModelDetails,
  ModelSearchApiResult,
} from "@/components/deploy-model/model-types";
import {
  RuntimeCapability,
  RuntimeTask,
} from "@/components/deploy-model/ModelSearchPanel";
import { useOrgHref } from "@/lib/org";
import {
  mapInstance,
  ComputeInstance,
} from "@/components/create/instance-utils";

interface DeployModelData {
  name: string;
  modality: string;
  runtime: string;
  replicas: number;
  provider: string;
  provider_connection_id: string;
  provider_connection_name: string;
  model: string;
  image: string;
  instance: ComputeInstance | null;
  hf_token: string;
  strategy: string;
  timeout_minutes: number;
  api_key: string;
  volume_size_gb: number;
  provider_config: Record<string, string>;
  advanced_config: Record<string, string>;
}

/* Curated vLLM text-generation suggestions — shown on first load so Step 1
   is never an empty white wall. Kept in sync with HF popularity; each
   entry renders as a normal ModelItem so downstream selection logic just
   works. Strings/numbers deliberately mirror the /models/search payload. */
const CURATED_VLLM_IDS: Array<{
  id: string;
  author: string;
  downloads: number;
  likes: number;
  parameters: number;
  pipelineTag: string;
  tags: string[];
}> = [
  { id: "meta-llama/Meta-Llama-3-8B-Instruct", author: "meta-llama", downloads: 2840000, likes: 4820, parameters: 8, pipelineTag: "text-generation", tags: ["llama", "instruct"] },
  { id: "meta-llama/Meta-Llama-3.1-8B-Instruct", author: "meta-llama", downloads: 2190000, likes: 3950, parameters: 8, pipelineTag: "text-generation", tags: ["llama-3.1", "instruct"] },
  { id: "Qwen/Qwen2.5-7B-Instruct", author: "Qwen", downloads: 1680000, likes: 3120, parameters: 7, pipelineTag: "text-generation", tags: ["qwen2", "instruct"] },
  { id: "Qwen/Qwen2-7B-Instruct", author: "Qwen", downloads: 1420000, likes: 2890, parameters: 7, pipelineTag: "text-generation", tags: ["qwen2", "instruct"] },
  { id: "mistralai/Mistral-7B-Instruct-v0.2", author: "mistralai", downloads: 1350000, likes: 2670, parameters: 7, pipelineTag: "text-generation", tags: ["mistral", "instruct"] },
  { id: "google/gemma-2-9b-it", author: "google", downloads: 980000, likes: 2210, parameters: 9, pipelineTag: "text-generation", tags: ["gemma2", "instruct"] },
  { id: "microsoft/Phi-3-mini-4k-instruct", author: "microsoft", downloads: 1120000, likes: 1980, parameters: 3.8, pipelineTag: "text-generation", tags: ["phi-3", "instruct"] },
  { id: "01-ai/Yi-1.5-9B-Chat", author: "01-ai", downloads: 740000, likes: 1640, parameters: 9, pipelineTag: "text-generation", tags: ["yi", "chat"] },
  { id: "NousResearch/Hermes-2-Pro-Llama-3-8B", author: "NousResearch", downloads: 690000, likes: 1520, parameters: 8, pipelineTag: "text-generation", tags: ["llama-3", "function-calling"] },
  { id: "deepseek-ai/deepseek-llm-7b-chat", author: "deepseek-ai", downloads: 620000, likes: 1370, parameters: 7, pipelineTag: "text-generation", tags: ["deepseek", "chat"] },
  { id: "upstage/SOLAR-10.7B-Instruct-v1.0", author: "upstage", downloads: 540000, likes: 1210, parameters: 10.7, pipelineTag: "text-generation", tags: ["solar", "instruct"] },
];

function buildCuratedVllmItems(): ModelItem[] {
  return CURATED_VLLM_IDS.map((r) => ({
    id: r.id,
    name: r.id.split("/").pop() || r.id,
    org: r.author,
    downloads: r.downloads,
    likes: r.likes,
    parameters: r.parameters,
    vram: `~${Math.ceil(estimateSearchVram(r.id, r.parameters))} GB`,
    tags: r.tags,
    pipelineTag: r.pipelineTag,
  }));
}

function applyDetectedParsers(
  config: Record<string, string>,
  modality: string,
  modelDetails: ModelDetails | null,
  schema: ConfigOption[],
): Record<string, string> {
  if (
    !["text-generation", "multimodal"].includes(modality) ||
    !modelDetails ||
    schema.length === 0
  ) {
    return config;
  }
  const metadata = modelDetails.metadata || {};
  const detected = {
    tool_parser:
      metadata.tool_parser ?? modelDetails.recommended_tool_parser ?? "",
    reasoning_parser:
      metadata.reasoning_parser ??
      modelDetails.recommended_reasoning_parser ??
      "",
  };
  const nextConfig = { ...config };
  for (const key of ["tool_parser", "reasoning_parser"] as const) {
    const option = schema.find((opt) => opt.key === key);
    const value = detected[key];
    if (!option?.options?.includes(value)) continue;
    const current = nextConfig[key];
    if (!current || current === option.default) {
      nextConfig[key] = value;
    }
  }
  return nextConfig;
}

/** Bytes per param guessed from quantization hints in the model id. */
function bytesPerParamFromId(modelId: string): number {
  const idL = modelId.toLowerCase();
  if (
    idL.includes("fp8") ||
    idL.includes("int8") ||
    idL.includes("8bit") ||
    idL.includes("q8")
  )
    return 1;
  else if (
    idL.includes("awq") ||
    idL.includes("gptq") ||
    idL.includes("int4") ||
    idL.includes("4bit") ||
    idL.includes("q4")
  )
    return 0.5;
  else if (idL.includes("fp32")) return 4;
  return 2;
}


function estimateSearchVram(modelId: string, paramsB: number): number {
  const overhead = paramsB > 50 ? 8 : paramsB > 20 ? 4 : 2;
  return paramsB * bytesPerParamFromId(modelId) + overhead;
}

function estimateVramNeeded(
  modelId: string,
  modelDetails?: ModelDetails | null,
): number {
  let paramsB = 0;
  let regexParams = 0;
  const match = modelId.match(/(\d+(?:\.\d+)?)b/i);
  if (match) regexParams = parseFloat(match[1]);

  if (modelDetails?.safetensors?.total) {
    paramsB = modelDetails.safetensors.total / 1e9;
    if (regexParams > 0 && paramsB < regexParams * 0.5) paramsB = regexParams;
  } else if (
    typeof modelDetails?.parameters === "number" &&
    modelDetails.parameters > 0
  ) {
    paramsB = modelDetails.parameters;
  } else {
    paramsB = regexParams > 0 ? regexParams : 8;
  }

  let bytesPerParam = 2;
  const quantConfig = modelDetails?.config?.quantization_config;
  if (quantConfig) {
    let bits = quantConfig.bits || quantConfig.weight_bits;
    if (!bits && quantConfig.config_groups?.group_0?.weights?.num_bits)
      bits = quantConfig.config_groups.group_0.weights.num_bits;
    if (bits === 4) bytesPerParam = 0.5;
    else if (bits === 8) bytesPerParam = 1;
    else if (["awq", "gptq", "exl2"].includes(quantConfig.quant_method ?? ""))
      bytesPerParam = modelId.toLowerCase().includes("8bit") ? 1 : 0.5;
  } else if (modelDetails?.config?.torch_dtype) {
    const dtype = modelDetails.config.torch_dtype.toLowerCase();
    if (dtype.includes("int8") || dtype.includes("fp8")) bytesPerParam = 1;
    else if (dtype.includes("float32")) bytesPerParam = 4;
  } else if (modelDetails?.quantization) {
    const q = modelDetails.quantization.toLowerCase();
    if (q.includes("fp16")) bytesPerParam = 2;
    else if (q.includes("q8")) bytesPerParam = 1;
    else if (q.includes("q6")) bytesPerParam = 0.75;
    else if (q.includes("q5")) bytesPerParam = 0.625;
    else if (q.includes("q4")) bytesPerParam = 0.5;
    else if (q.includes("q3")) bytesPerParam = 0.375;
    else if (q.includes("q2")) bytesPerParam = 0.25;
  } else {
    bytesPerParam = bytesPerParamFromId(modelId);
  }

  let overhead = paramsB > 50 ? 8 : paramsB > 20 ? 4 : 2;
  if (modelDetails?.quantization) overhead += 1;
  return paramsB * bytesPerParam + overhead;
}

export function useDeployModel() {
  const router = useRouter();
  const orgHref = useOrgHref();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [isPreselected, setIsPreselected] = useState(false);

  const [data, setData] = useState<DeployModelData>({
    name: "",
    modality: "",
    runtime: "",
    replicas: 1,
    provider: "",
    provider_connection_id: "",
    provider_connection_name: "",
    model: "",
    image: "",
    instance: null,
    hf_token: "",
    strategy: "EXTEND",
    timeout_minutes: 60,
    api_key: "",
    volume_size_gb: 50,
    provider_config: {},
    advanced_config: {},
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ModelItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [imageFromCatalog, setImageFromCatalog] = useState(false);
  
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [runtimes, setRuntimes] = useState<RuntimeCapability[]>([]);
  const [modalities, setModalities] = useState<RuntimeTask[]>([]);
  const [isLoadingCapabilities, setIsLoadingCapabilities] = useState(true);
  const [instances, setInstances] = useState<ComputeInstance[]>([]);
  const [modelDetails, setModelDetails] = useState<ModelDetails | null>(null);
  const [advancedSchema, setAdvancedSchema] = useState<ConfigOption[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);

  // Load runtime & modality capabilities from the backend registry (single source of truth)
  // If the page was opened from the curated catalog (?model=&runtime=&task=&image=),
  // preselect everything and jump straight to step 2 (Select Compute).
  useEffect(() => {
    const preselectedModel = searchParams.get("model") || "";
    const preselectedRuntime = searchParams.get("runtime") || "";
    const preselectedTask =
      searchParams.get("task") || searchParams.get("modality") || "";
    const preselectedImage = searchParams.get("image") || "";
    const fromCatalog =
      searchParams.get("from") === "catalog" || !!preselectedModel;

    apiFetch("/api/v1/runtimes")
      .then((r) => r.json())
      .then((json) => {
        const caps: RuntimeCapability[] = Array.isArray(json.runtimes)
          ? json.runtimes
          : [];
        const tasks: RuntimeTask[] = Array.isArray(json.tasks)
          ? json.tasks
          : [];
        setRuntimes(caps);
        setModalities(tasks);
        // Prefer vLLM + text-generation so Step 1 is never empty.
        const preferredIsolated = (list: RuntimeTask[]): string => {
          const preferred = list.find((t) => t.id === "text-generation");
          return preferred?.id ?? list[0]?.id ?? "";
        };
        let chosenRuntime = "";
        let chosenModality = "";
        setData((d) => {
          if (fromCatalog && preselectedModel) {
            const modality = tasks.some((t) => t.id === preselectedTask)
              ? preselectedTask
              : tasks.some((t) => t.id === d.modality)
                ? d.modality
                : preferredIsolated(tasks);
            const runtimeIds = caps
              .filter((c) => c.tasks.some((t) => t.id === modality))
              .map((c) => c.id);
            const runtime = preselectedRuntime && runtimeIds.includes(preselectedRuntime)
              ? preselectedRuntime
              : runtimeIds.includes(d.runtime)
                ? d.runtime
                : runtimeIds.includes("vllm")
                  ? "vllm"
                  : (runtimeIds[0] ?? "");
            chosenRuntime = runtime;
            chosenModality = modality;
            return {
              ...d,
              model: preselectedModel,
              modality,
              runtime,
              image: preselectedImage,
              advanced_config: {
                ...d.advanced_config,
                ...(preselectedImage ? { image: preselectedImage } : {}),
              },
            };
          }
          const modality = tasks.some((t) => t.id === d.modality)
            ? d.modality
            : preferredIsolated(tasks);
          const runtimeIds = caps
            .filter((c) => c.tasks.some((t) => t.id === modality))
            .map((c) => c.id);
          const runtime = runtimeIds.includes(d.runtime)
            ? d.runtime
            : runtimeIds.includes("vllm")
              ? "vllm"
              : (runtimeIds[0] ?? "");
          chosenRuntime = runtime;
          chosenModality = modality;
          return { ...d, modality, runtime };
        });
        // Default catalogue: vLLM text-generation gets ~11 featured models so the
        // drawer never renders as a blank empty state.
        if (!fromCatalog) {
          if (chosenRuntime === "vllm" && chosenModality === "text-generation") {
            setSearchResults(buildCuratedVllmItems());
          }
        }
        if (fromCatalog && preselectedModel) {
          setIsPreselected(true);
          setStep(2);
          if (preselectedImage) setImageFromCatalog(true);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingCapabilities(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load runtime schema
  useEffect(() => {
    if (!data.runtime || !data.modality) return;
    fetch(
      `/api/v1/runtimes/schema?runtime=${data.runtime}&task=${encodeURIComponent(data.modality)}`,
    )
      .then((r) => r.json())
      .then((json) => {
        if (json.schema) {
          const schema = json.schema as ConfigOption[];
          setAdvancedSchema(schema);
          const defaults: Record<string, string> = {};
          schema.forEach((opt) => {
            defaults[opt.key] = opt.default;
          });
          setData((d) => ({
            ...d,
            advanced_config: { ...defaults, ...d.advanced_config },
          }));
        }
      })
      .catch(console.error);
  }, [data.runtime, data.modality]);

  // Load model details
  useEffect(() => {
    if (!data.model || !data.runtime) return;
    fetch(
      `/api/v1/models/details?runtime=${data.runtime}&task=${encodeURIComponent(data.modality)}&model=${encodeURIComponent(data.model)}`,
    )
      .then((r) => r.json())
      .then((json) => {
        if (json.details) {
          setModelDetails(json.details as ModelDetails);
        }
      })
      .catch(console.error);
  }, [data.model, data.runtime, data.modality]);

  // Load instance types for active provider — guarded against stale
  // resolves so rapid Nosana ↔ Local switches never leave Local GPUs
  // visible while Nosana is selected.
  useEffect(() => {
    const requested = data.provider;
    if (!requested) {
      setInstances([]);
      return;
    }
    let cancelled = false;
    apiFetch(`/api/v1/instances?provider=${encodeURIComponent(requested)}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (requested !== data.provider) return;
        if (json.instances && Array.isArray(json.instances)) {
          setInstances(json.instances.map(mapInstance));
        } else {
          setInstances([]);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setInstances([]);
      });
    return () => {
      cancelled = true;
    };
  }, [data.provider]);

  const advancedConfig = useMemo(
    () =>
      applyDetectedParsers(
        data.advanced_config,
        data.modality,
        modelDetails,
        advancedSchema,
      ),
    [data.advanced_config, data.modality, modelDetails, advancedSchema],
  );

  const handleSearch = async () => {
    if (!searchQuery || !data.runtime || !data.modality) return;
    setIsSearching(true);
    try {
      const caps =
        capabilities.length > 0
          ? `&capabilities=${encodeURIComponent(capabilities.join(","))}`
          : "";
      const res = await fetch(
        `/api/v1/models/search?runtime=${data.runtime}&task=${encodeURIComponent(data.modality)}&q=${encodeURIComponent(searchQuery)}${caps}`,
      );
      const json = await res.json();
      if (json.results) {
        setSearchResults(
          (json.results as ModelSearchApiResult[]).map((r) => {
            const params =
              typeof r.Parameters === "number" && r.Parameters > 0
                ? r.Parameters
                : undefined;
            return {
              id: r.ID,
              name: r.ID.split("/").pop() || r.ID,
              org: r.Author || r.ID.split("/")[0] || "model",
              downloads: r.Downloads,
              likes: r.Likes,
              parameters: params,
              vram: params
                ? `~${Math.ceil(estimateSearchVram(r.ID, params))} GB`
                : undefined,
              tags: Array.isArray(r.Tags) ? r.Tags : [],
              pipelineTag: r.PipelineTag,
            };
          }),
        );
      } else {
        setSearchResults([]);
      }
    } catch (e) {
      console.error(e);
      setSearchResults([]);
    }
    setIsSearching(false);
  };

  const handleModalityChange = (val: string) => {
    setSearchQuery("");
    setSearchResults([]);
    setModelDetails(null);
    setCapabilities([]);
    // Drop any image override: it belongs to the previous runtime and must
    // never leak into another runtime.
    setImageFromCatalog(false);
    setData((d) => {
      const runtimeIds = runtimes
        .filter((c) => c.tasks.some((t) => t.id === val))
        .map((c) => c.id);
      const runtime = runtimeIds.includes(d.runtime)
        ? d.runtime
        : (runtimeIds[0] ?? "");
      return { ...d, modality: val, runtime, model: "", image: "", advanced_config: {} };
    });
  };

  const handleRuntimeChange = (val: string) => {
    setSearchResults([]);
    setModelDetails(null);
    setCapabilities([]);
    setImageFromCatalog(false);
    setData((d) => ({ ...d, runtime: val, model: "", image: "", advanced_config: {} }));
  };

  // Switching models drops a *catalog* image override (it belongs to the
  // card you came from); a manually typed step-3 override is kept.
  const handleSelectModel = (id: string) => {
    if (data.model === id) return;
    setModelDetails(null);
    if (imageFromCatalog) {
      setImageFromCatalog(false);
      setData((d) => ({ ...d, model: id, image: "" }));
    } else {
      setData((d) => ({ ...d, model: id }));
    }
  };

  // Manual step-3 image override: owned by the user, never auto-cleared on
  // model switches (only runtime/modality switches invalidate it).
  const handleImageChange = (val: string) => {
    setImageFromCatalog(false);
    setData((d) => ({ ...d, image: val }));
  };

  const toggleCapability = (id: string) => {
    setCapabilities((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
    setSearchResults([]);
    setModelDetails(null);
    setData((d) => ({ ...d, model: "" }));
  };

  const handleDeploy = async () => {
    if (!data.name || !data.model || !data.instance || !data.provider_connection_id) return;
    setIsDeploying(true);
    try {
      const res = await apiFetch("/api/v1/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          provider_id: data.provider,
          provider_connection_id: data.provider_connection_id,
          instance_type_id: data.instance.id,
          instance_name: data.instance.name,
          runtime_id: data.runtime,
          task: data.modality,
          model_id: data.model,
          replicas: data.replicas,
          hf_token: data.hf_token,
          timeout_minutes: data.timeout_minutes,
          strategy: data.strategy,
          volume_size_gb: data.volume_size_gb,
          provider_config: data.provider_config,
          advanced_config: {
            ...advancedConfig,
            ...(data.api_key ? { api_key: data.api_key } : {}),
            ...(data.image ? { image: data.image } : {}),
          },
        }),
      });
      const json = await res.json();
      if (res.ok && json.deployment_id) {
        if (json.warning) alert(json.warning);
        router.push(orgHref("/deployments"));
      } else {
        alert(json.error || "Failed to deploy model");
      }
    } catch {
      alert("Error deploying model");
    }
    setIsDeploying(false);
  };

  const requiredVram = data.model
    ? estimateVramNeeded(data.model, modelDetails)
    : 16;
  const taskLabel = modalities.find((t) => t.id === data.modality)?.name;

  const deployPayload = useMemo(
    () => ({
      name: data.name || "(unnamed)",
      provider_id: data.provider || null,
      provider_connection_id: data.provider_connection_id || null,
      instance_type_id: data.instance?.id ?? null,
      instance_name: data.instance?.name ?? null,
      runtime_id: data.runtime,
      task: data.modality,
      model_id: data.model || null,
      replicas: data.replicas,
      hf_token: data.hf_token ? "••••••••" : null,
      timeout_minutes: data.timeout_minutes,
      strategy: data.strategy,
      volume_size_gb: data.volume_size_gb,
      provider_config: data.provider_config,
      advanced_config: {
        ...advancedConfig,
        ...(data.api_key ? { api_key: "••••••••" } : {}),
        ...(data.image ? { image: data.image } : {}),
      },
    }),
    [data, advancedConfig],
  );

  const deployPayloadJson = useMemo(
    () => JSON.stringify(deployPayload, null, 2),
    [deployPayload],
  );

  // Restore curated suggestions whenever the user lands back on the ideal
  // default combo and the list was emptied (capability toggle, etc.).
  useEffect(() => {
    if (
      !isLoadingCapabilities &&
      data.runtime === "vllm" &&
      data.modality === "text-generation" &&
      searchResults.length === 0 &&
      !isSearching &&
      !searchQuery
    ) {
      setSearchResults(buildCuratedVllmItems());
    }
  }, [data.runtime, data.modality, isLoadingCapabilities, searchResults.length, isSearching, searchQuery]);

  const canNext =
    step === 1
      ? !!data.model && (!modelDetails?.gated || !!data.hf_token)
      : step === 2
        ? !!data.instance && !!data.provider_connection_id
        : step === 3
          ? !!data.runtime
          : step === 4
            ? !!data.name
            : !!data.name &&
              !!data.model &&
              !!data.instance &&
              !!data.provider_connection_id;

  const nextStep = () => setStep((s) => Math.min(5, s + 1));
  const prevStep = () => setStep((s) => Math.max(1, s - 1));

  const updateData = (updates: Partial<DeployModelData>) => {
    setData((d) => ({ ...d, ...updates }));
  };

  return {
    router,
    step,
    setStep,
    isPreselected,
    data,
    updateData,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    runtimes,
    modalities,
    capabilities,
    toggleCapability,
    isLoadingCapabilities,
    instances,
    modelDetails,
    advancedSchema,
    advancedConfig,
    showAdvanced,
    setShowAdvanced,
    isDeploying,
    handleSearch,
    handleModalityChange,
    handleRuntimeChange,
    handleSelectModel,
    handleImageChange,
    handleDeploy,
    requiredVram,
    taskLabel,
    canNext,
    nextStep,
    prevStep,
    deployPayload,
    deployPayloadJson,
  };
}
