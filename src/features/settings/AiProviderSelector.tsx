import { useEffect, useRef, useState } from "react";
import {
  getAiProviderSettings,
  updateAiProvider,
  updateAiProviderSettings,
  type AiProvider,
  type AiProviderSettings,
} from "./aiProviderApi";

type Props = {
  onError: (message: string) => void;
  onChanged: (message: string) => void;
};

function AiProviderSelector({ onError, onChanged }: Props) {
  const [settings, setSettings] = useState<AiProviderSettings | null>(null);
  const [model, setModel] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("");
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const settingsRef = useRef<HTMLElement>(null);

  const applySettings = (next: AiProviderSettings) => {
    setSettings(next);
    setModel(next.model ?? "");
    setReasoningEffort(next.reasoningEffort ?? "");
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
    if (!settings || provider === settings.provider) return;
    const previous = settings;
    setSaving(true);
    try {
      const updated = await updateAiProvider(provider);
      applySettings(updated);
      const selected = updated.options.find((option) => option.provider === updated.provider);
      onChanged(`AI provider changed to ${selected?.label ?? updated.provider}`);
    } catch (error) {
      applySettings(previous);
      onError(error instanceof Error ? error.message : "Could not change the AI provider.");
    } finally {
      setSaving(false);
    }
  };

  const saveProviderSettings = async () => {
    if (!settings || !settings.modelConfigurable) return;
    if (!model.trim()) {
      onError("Enter the provider's exact model ID before saving AI settings.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateAiProviderSettings({
        provider: settings.provider,
        model: model.trim(),
        reasoningEffort: settings.reasoningEffortConfigurable ? reasoningEffort.trim() : null,
      });
      applySettings(updated);
      onChanged("AI settings saved");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save AI settings.");
    } finally {
      setSaving(false);
    }
  };

  const selectedProvider = settings?.options.find((option) => option.provider === settings.provider);
  const providerResources = settings?.provider === "OPENAI"
    ? {
        documentation: "https://developers.openai.com/api/docs/models",
        pricing: "https://developers.openai.com/api/docs/pricing",
      }
    : settings?.provider === "ZAI"
      ? {
          documentation: "https://docs.z.ai/",
          pricing: "https://z.ai/pricing",
        }
      : null;

  return (
    <section className="ai-settings" ref={settingsRef} aria-label="AI settings">
      <button
        className="ai-settings-trigger"
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{selectedProvider?.label ?? "AI settings"}</span>
        <span className="ai-settings-gear" aria-hidden="true">⚙</span>
      </button>
      {isOpen && <div className="ai-settings-popover" role="dialog" aria-label="AI provider settings">
        <div className="ai-settings-popover-heading">
          <div>
            <p className="eyebrow">AI settings</p>
            <strong>{selectedProvider?.label ?? "Loading settings…"}</strong>
          </div>
          <button className="ai-settings-close" type="button" onClick={() => setIsOpen(false)} aria-label="Close AI settings">×</button>
        </div>
        <label className="provider-selector">
          <span>AI provider</span>
          <select
            aria-label="Active AI provider"
            value={settings?.provider ?? ""}
            disabled={!settings || saving}
            onChange={(event) => void changeProvider(event.target.value as AiProvider)}
          >
            {!settings && <option value="">Loading…</option>}
            {settings?.options.map((option) => (
              <option key={option.provider} value={option.provider} disabled={!option.configured}>
                {option.label}{option.configured ? "" : " — not configured"}
              </option>
            ))}
          </select>
        </label>
        {settings?.modelConfigurable ? <>
          <label className="ai-settings-field">
            <span>Model ID</span>
            <input
              value={model}
              disabled={saving}
              onChange={(event) => setModel(event.target.value)}
              placeholder="Provider model ID"
            />
          </label>
          {settings.reasoningEffortConfigurable && <label className="ai-settings-field">
            <span>Reasoning effort</span>
            <input
              list="zai-reasoning-efforts"
              value={reasoningEffort}
              disabled={saving}
              onChange={(event) => setReasoningEffort(event.target.value)}
              placeholder="low"
            />
            <datalist id="zai-reasoning-efforts">
              <option value="low" />
              <option value="medium" />
              <option value="high" />
            </datalist>
          </label>}
          <button className="secondary ai-settings-save" type="button" disabled={saving} onClick={() => void saveProviderSettings()}>
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
