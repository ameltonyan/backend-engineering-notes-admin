import { useEffect, useRef, useState } from "react";
import {
  getAiProviderSettings,
  updateAiProvider,
  updateAiProviderSettings,
  type AiProvider,
  type AiProviderConfiguration,
  type AiProviderSettings,
} from "./aiProviderApi";

type Props = {
  onError: (message: string) => void;
  onChanged: (message: string) => void;
};

function AiProviderSelector({ onError, onChanged }: Props) {
  const [settings, setSettings] = useState<AiProviderSettings | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const settingsRef = useRef<HTMLElement>(null);

  const selected = (next: AiProviderSettings): AiProviderConfiguration | undefined =>
    next.providers.find((provider) => provider.id === next.selectedProvider);

  const applySettings = (next: AiProviderSettings) => {
    setSettings(next);
    const provider = selected(next);
    setValues(Object.fromEntries((provider?.settings ?? []).map((field) => [
      field.key,
      provider?.values[field.key] ?? field.defaultValue ?? "",
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

  const changeProvider = async (provider: AiProvider) => {
    if (!settings || provider === settings.selectedProvider) return;
    const previous = settings;
    setSaving(true);
    try {
      const updated = await updateAiProvider(provider);
      applySettings(updated);
      onChanged(`AI provider changed to ${selected(updated)?.label ?? updated.selectedProvider}`);
    } catch (error) {
      applySettings(previous);
      onError(error instanceof Error ? error.message : "Could not change the AI provider.");
    } finally {
      setSaving(false);
    }
  };

  const saveProviderSettings = async () => {
    if (!settings) return;
    const provider = selected(settings);
    if (!provider || provider.settings.some((field) => field.required && !values[field.key]?.trim())) {
      onError("Complete all required AI settings before saving.");
      return;
    }
    setSaving(true);
    try {
      const submitted = Object.fromEntries(provider.settings
        .map((field) => [field.key, values[field.key]?.trim() ?? ""])
        .filter(([, value]) => value));
      const updated = await updateAiProviderSettings(provider.id, submitted);
      applySettings(updated);
      onChanged("AI settings saved");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save AI settings.");
    } finally {
      setSaving(false);
    }
  };

  const selectedProvider = settings ? selected(settings) : undefined;
  const providerResources = selectedProvider?.id === "OPENAI"
    ? { documentation: "https://developers.openai.com/api/docs/models", pricing: "https://developers.openai.com/api/docs/pricing" }
    : selectedProvider?.id === "ZAI"
      ? { documentation: "https://docs.z.ai/", pricing: "https://z.ai/pricing" }
      : null;

  return (
    <section className="ai-settings" ref={settingsRef} aria-label="AI settings">
      <button className="ai-settings-trigger" type="button" aria-expanded={isOpen} aria-haspopup="dialog"
        onClick={() => setIsOpen((current) => !current)}>
        <span>{selectedProvider?.label ?? "AI settings"}</span>
        <span className="ai-settings-gear" aria-hidden="true">⚙</span>
      </button>
      {isOpen && <div className="ai-settings-popover" role="dialog" aria-label="AI provider settings">
        <div className="ai-settings-popover-heading">
          <div><p className="eyebrow">AI settings</p><strong>{selectedProvider?.label ?? "Loading settings…"}</strong></div>
          <button className="ai-settings-close" type="button" onClick={() => setIsOpen(false)} aria-label="Close AI settings">×</button>
        </div>
        <label className="provider-selector">
          <span>AI provider</span>
          <select aria-label="Active AI provider" value={settings?.selectedProvider ?? ""} disabled={!settings || saving}
            onChange={(event) => void changeProvider(event.target.value as AiProvider)}>
            {!settings && <option value="">Loading…</option>}
            {settings?.providers.map((provider) => <option key={provider.id} value={provider.id} disabled={!provider.configured}>
              {provider.label}{provider.configured ? "" : " — not configured"}
            </option>)}
          </select>
        </label>
        {selectedProvider?.settings.length ? <>
          {selectedProvider.settings.map((field) => <label key={field.key} className="ai-settings-field">
            <span>{field.label}</span>
            {field.type === "ENUM" ? <select value={values[field.key] ?? ""} disabled={saving}
              onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}>
              {field.allowedValues.map((value) => <option key={value} value={value}>{value}</option>)}
            </select> : <input value={values[field.key] ?? ""} disabled={saving} placeholder={field.key === "model" ? "Provider model ID" : field.label}
              onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} />}
            {field.description && <small>{field.description}</small>}
          </label>)}
          <button className="primary ai-settings-save" type="button" disabled={saving} onClick={() => void saveProviderSettings()}>
            {saving ? "Saving…" : "Save AI settings"}
          </button>
          <p className="ai-settings-hint">Use the exact model ID available to your provider account.</p>
        </> : settings && <p className="ai-settings-hint">The local mock provider uses its built-in static response and has no model settings.</p>}
        {providerResources && <div className="ai-settings-links">
          <a href={providerResources.documentation} target="_blank" rel="noreferrer">Provider docs ↗</a>
          <a href={providerResources.pricing} target="_blank" rel="noreferrer">Models & pricing ↗</a>
        </div>}
      </div>}
    </section>
  );
}

export default AiProviderSelector;
