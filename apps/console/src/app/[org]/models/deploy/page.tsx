"use client";

import { Suspense } from "react";

import { StepIndicator } from "@/components/deploy-model/StepIndicator";
import { ModelSearchPanel } from "@/components/deploy-model/ModelSearchPanel";
import { ComputeSection } from "@/components/deploy-model/ComputeSection";
import { EngineSection } from "@/components/deploy-model/EngineSection";
import { DeployConfigSection } from "@/components/deploy-model/DeployConfigSection";
import { ReviewSection } from "@/components/deploy-model/ReviewSection";
import { DeploySummary } from "@/components/deploy-model/DeploySummary";
import { useDeployModel } from "./use-deploy-model";

function DeployAIModelContent() {
  const {
    step,
    setStep,
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
    deployPayloadJson,
  } = useDeployModel();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-.03em] text-fg">
          Deploy a model{" "}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-band px-2.5 py-0.5 text-[11px] font-medium text-accent-t">
            Draft
          </span>
        </h1>
        <p className="mt-1.5 text-[13px] text-mut2">
          Pick a model from Hugging Face, choose where it runs, tune the engine,
          and go live in a few clicks.
        </p>
      </div>

      <div className="pt-1 pb-2">
        <StepIndicator currentStep={step} onStepClick={(s) => setStep(s)} />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {step === 1 && (
            <ModelSearchPanel
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSearch={handleSearch}
              isSearching={isSearching}
              searchResults={searchResults}
              selectedModel={data.model}
              onSelectModel={handleSelectModel}
              modality={data.modality}
              onModalityChange={handleModalityChange}
              runtime={data.runtime}
              onRuntimeChange={handleRuntimeChange}
              modalities={modalities}
              runtimes={runtimes}
              isLoadingCapabilities={isLoadingCapabilities}
              capabilities={capabilities}
              onToggleCapability={toggleCapability}
              modelDetails={modelDetails}
              requiredVram={requiredVram}
              hfToken={data.hf_token}
              onHfTokenChange={(token) => updateData({ hf_token: token })}
            />
          )}

          {step === 2 && (
            <ComputeSection
              selectedProvider={data.provider}
              onSelectProvider={(pid) =>
                updateData({
                  provider: pid,
                  instance: null,
                  provider_config: {},
                  provider_connection_id: "",
                  provider_connection_name: "",
                })
              }
              selectedConnectionId={data.provider_connection_id}
              onSelectConnection={(conn) =>
                updateData({
                  provider: conn.Provider,
                  provider_connection_id: conn.ID,
                  provider_connection_name: conn.Name,
                  instance: null,
                  provider_config: {},
                })
              }
              instances={instances}
              selectedInstance={data.instance}
              onSelectInstance={(i) => updateData({ instance: i })}
              requiredVram={requiredVram}
              selectedModel={data.model}
              providerConfig={data.provider_config}
              onProviderConfigChange={(key, val) =>
                updateData({
                  provider_config: { ...data.provider_config, [key]: val },
                })
              }
              volumeSizeGb={data.volume_size_gb}
              onVolumeSizeGbChange={(size) =>
                updateData({ volume_size_gb: size })
              }
            />
          )}

          {step === 3 && (
            <EngineSection
              runtime={data.runtime}
              modality={data.modality}
              schema={advancedSchema}
              config={advancedConfig}
              onChange={(key, value) =>
                updateData({
                  advanced_config: { ...data.advanced_config, [key]: value },
                })
              }
              image={data.image}
              onImageChange={handleImageChange}
            />
          )}

          {step === 4 && (
            <DeployConfigSection
              name={data.name}
              onNameChange={(val) => updateData({ name: val })}
              replicas={data.replicas}
              onReplicasChange={(val) => updateData({ replicas: val })}
              strategy={data.strategy}
              onStrategyChange={(val) => updateData({ strategy: val })}
              timeoutMinutes={data.timeout_minutes}
              onTimeoutMinutesChange={(val) =>
                updateData({ timeout_minutes: val })
              }
              apiKey={data.api_key}
              onApiKeyChange={(val) => updateData({ api_key: val })}
              gated={Boolean(modelDetails?.gated)}
              hfToken={data.hf_token}
              onHfTokenChange={(token) => updateData({ hf_token: token })}
            />
          )}

          {step === 5 && (
            <ReviewSection
              data={data}
              modelDetails={modelDetails}
              taskLabel={taskLabel}
              requiredVram={requiredVram}
              deployPayloadJson={deployPayloadJson}
            />
          )}
        </div>

        <DeploySummary
          data={data}
          modelDetails={modelDetails}
          taskLabel={taskLabel}
          requiredVram={requiredVram}
          currentStep={step}
          onNext={nextStep}
          canNext={canNext}
          onDeploy={handleDeploy}
          isDeploying={isDeploying}
        />
      </div>
    </div>
  );
}

export default function DeployAIModelPage() {
  return (
    <Suspense>
      <DeployAIModelContent />
    </Suspense>
  );
}