import { useEffect, useRef, useState } from "react";
import {
  getAiProviderModels,
  getAiProviderSettings,
  updateAiProvider,
  type AiProvider,
  type AiProviderConfiguration,
  type AiProviderSettings,
  type AiProviderModels,
} from "./aiProviderApi";

type Props = {
  onError: (message: string) => void;
  onChanged: (message: string) => void;
};

function AiProviderSelector({ onError, onChanged }: Props) {
  const [settings, setSettings] = useState<AiProviderSettings | null>(null);
  const [draftProvider, setDraftProvider] = useState<AiProvider | null>(null);
  const [draftValues, setDraftValues] = useState<Partial<Record<AiProvider, Record<string, string>>>>({});
  const [modelLists, setModelLists] = useState<Partial<Record<AiProvider, AiProviderModels & { error?: string }>>>({});
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const settingsRef = useRef<HTMLElement>(null);

  const selected = (next: AiProviderSettings): AiProviderConfiguration | undefined =>
    next.providers.find((provider) => provider.id === next.selectedProvider);

  const applySettings = (next: AiProviderSettings) => {
    setSettings(next);
    setDraftProvider(next.selectedProvider);
    setDraftValues(Object.fromEntries(next.providers.map((provider) => [
      provider.id,
      Object.fromEntries(provider.settings.map((field) => [
        field.key, provider.values[field.key] ?? field.defaultValue ?? "",
      ])),
    ])));
  };

  useEffect(() => {
    let active = true;
    getAiProviderSettings()
      .then((loaded) => { if (active) applySettings(loaded); })
      .catch((error: unknown) => {
        if (active) onError(error instanceof Error ? error.message : "Could not load AI provider settings.");
      });
    return () => { active = false; };
  }, [onError]);

  useEffect(() => {
    if (!isOpen || !draftProvider || draftProvider === "MOCK" || modelLists[draftProvider]) return;
    let active = true;
    getAiProviderModels(draftProvider)
      .then((loaded) => {
        if (active) setModelLists((current) => ({ ...current, [draftProvider]: loaded }));
      })
      .catch((error: unknown) => {
        if (active) setModelLists((current) => ({ ...current, [draftProvider]: {
          provider: draftProvider, models: [], description: "",
          error: error instanceof Error ? error.message : "Could not load models.",
        } }));
      });
    return () => { active = false; };
  }, [isOpen, draftProvider, modelLists]);

  useEffect(() => {
    if (!isOpen) return;
    const closeWhenClickingOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !settingsRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeWhenClickingOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeWhenClickingOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const changeProvider = (provider: AiProvider) => {
    setDraftProvider(provider);
    setFeedback(null);
  };

  const selectedProvider = settings?.providers.find((provider) => provider.id === draftProvider);
  const values = draftProvider ? draftValues[draftProvider] ?? {} : {};
  const modelList = draftProvider ? modelLists[draftProvider] : undefined;
  const currentModel = values.model ?? "";
  const configuredModel = selectedProvider?.values.model
    ?? selectedProvider?.settings.find((field) => field.key === "model")?.defaultValue ?? "";
  const modelOptions = Array.from(new Set([...(modelList?.models ?? []), configuredModel, currentModel].filter(Boolean)));

  const reloadModels = () => {
    if (!draftProvider) return;
    setModelLists((current) => {
      const next = { ...current };
      delete next[draftProvider];
      return next;
    });
  };

  const changeValue = (key: string, value: string) => {
    if (!draftProvider) return;
    setDraftValues((current) => ({ ...current, [draftProvider]: { ...current[draftProvider], [key]: value } }));
    setFeedback(null);
  };

  const saveProviderSettings = async () => {
    if (!settings || saving) return;
    const provider = selectedProvider;
    if (!provider || provider.settings.some((field) => field.required && !values[field.key]?.trim())) {
      setFeedback({ message: "Complete all required AI settings before saving.", error: true });
      onError("Complete all required AI settings before saving.");
      return;
    }
    setSaving(true);
    setFeedback(null);
    onError("");
    onChanged("");
    try {
      const submitted = Object.fromEntries(provider.settings
        .map((field) => [field.key, values[field.key]?.trim() ?? ""])
        .filter(([, value]) => value));
      const updated = await updateAiProvider(provider.id, submitted);
      applySettings(updated);
      setFeedback({ message: "AI settings saved", error: false });
      onChanged("AI settings saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save AI settings.";
      setFeedback({ message, error: true });
      onError(message);
    } finally {
      setSaving(false);
    }
  };

  const providerResources = selectedProvider?.id === "OPENAI"
    ? { documentation: "https://developers.openai.com/api/docs/models", pricing: "https://developers.openai.com/api/docs/pricing" }
    : selectedProvider?.id === "ZAI"
      ? { documentation: "https://docs.z.ai/", pricing: "https://z.ai/pricing" }
      : null;

  return (
    <section className="ai-settings" ref={settingsRef} aria-label="AI settings">
      <button className="ai-settings-trigger" type="button" aria-expanded={isOpen} aria-haspopup="dialog"
        onClick={() => setIsOpen((current) => !current)}>
        <span>{settings ? selected(settings)?.label ?? "AI settings" : "AI settings"}</span>
        <span className="ai-settings-gear" aria-hidden="true">⚙</span>
      </button>
      {isOpen && <div className="ai-settings-popover" role="dialog" aria-label="AI provider settings">
        <div className="ai-settings-popover-heading">
          <div><p className="eyebrow">AI settings</p><strong>{selectedProvider?.label ?? "Loading settings…"}</strong></div>
          <button className="ai-settings-close" type="button" onClick={() => setIsOpen(false)} aria-label="Close AI settings">×</button>
        </div>
        <label className="provider-selector">
          <span>AI provider</span>
          <select aria-label="AI provider" value={draftProvider ?? ""} disabled={!settings || saving}
            onChange={(event) => changeProvider(event.target.value as AiProvider)}>
            {!settings && <option value="">Loading…</option>}
            {settings?.providers.map((provider) => <option key={provider.id} value={provider.id} disabled={!provider.configured}>
              {provider.label}{provider.configured ? "" : " — not configured"}
            </option>)}
          </select>
        </label>
        {selectedProvider?.settings.length ? <>
          {selectedProvider.settings.map((field) => <label key={field.key} className="ai-settings-field">
            <span className="ai-settings-field-heading">
              <span>{field.label}</span>
              {field.key === "model" && !modelList && <span className="ai-settings-loading" role="status">
                <span className="ai-settings-spinner" aria-hidden="true" />
                Loading…
              </span>}
            </span>
            {field.key === "model" ? <select value={currentModel} disabled={saving || !modelList}
              aria-label={field.label} aria-busy={!modelList}
              onChange={(event) => changeValue(field.key, event.target.value)}>
              {!currentModel && <option value="">{modelList ? "Choose a model" : "Loading models…"}</option>}
              {modelOptions.map((model) => <option key={model} value={model}>
                {model}{modelList && !modelList.models.includes(model) ? " (configured)" : ""}
              </option>)}
            </select> : field.type === "ENUM" ? <select value={values[field.key] ?? ""} disabled={saving}
              onChange={(event) => changeValue(field.key, event.target.value)}>
              {!field.required && <option value="">Use default{field.defaultValue ? ` (${field.defaultValue})` : ""}</option>}
              {field.allowedValues.map((value) => <option key={value} value={value}>{value}</option>)}
            </select> : <input value={values[field.key] ?? ""} disabled={saving} placeholder={field.label}
              onChange={(event) => changeValue(field.key, event.target.value)} />}
            {(field.key === "model" ? modelList?.description : field.description) &&
              <small>{field.key === "model" ? modelList?.description : field.description}</small>}
          </label>)}
          {modelList?.error ? <p className="ai-settings-hint" role="alert">
            {modelList.error} Your configured model is still available.
          </p> : modelList && !modelList.models.length ? <p className="ai-settings-hint">
            No model suggestions are available. Your configured model is still available.
          </p> : null}
          {modelList && <button type="button" disabled={saving} onClick={reloadModels}>
            {modelList.error ? "Retry loading models" : "Refresh models"}
          </button>}
        </> : settings && <p className="ai-settings-hint">The local mock provider uses its built-in static response and has no model settings.</p>}
        {settings && <>
          <button className="primary ai-settings-save" type="button" disabled={saving} onClick={() => void saveProviderSettings()}>
            {saving ? "Saving…" : "Save AI settings"}
          </button>
          <p className="ai-settings-hint">Provider and setting changes apply when you save.</p>
        </>}
        {feedback && <p className="ai-settings-hint" role={feedback.error ? "alert" : "status"}>{feedback.message}</p>}
        {providerResources && <div className="ai-settings-links">
          <a href={providerResources.documentation} target="_blank" rel="noreferrer">Provider docs ↗</a>
          <a href={providerResources.pricing} target="_blank" rel="noreferrer">Models & pricing ↗</a>
        </div>}
      </div>}
    </section>
  );
}

export default AiProviderSelector;
