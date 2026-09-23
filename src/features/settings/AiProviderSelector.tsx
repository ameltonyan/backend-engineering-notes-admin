import { useEffect, useState } from "react";
import {
  getAiProviderSettings,
  updateAiProvider,
  type AiProvider,
  type AiProviderSettings,
} from "./aiProviderApi";

type Props = {
  onError: (message: string) => void;
  onChanged: (message: string) => void;
};

function AiProviderSelector({ onError, onChanged }: Props) {
  const [settings, setSettings] = useState<AiProviderSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getAiProviderSettings()
      .then((loaded) => { if (active) setSettings(loaded); })
      .catch((error: unknown) => {
        if (active) onError(error instanceof Error ? error.message : "Could not load AI provider settings.");
      });
    return () => { active = false; };
  }, [onError]);

  const changeProvider = async (provider: AiProvider) => {
    if (!settings || provider === settings.provider) return;
    const previous = settings;
    setSettings({ ...settings, provider });
    setSaving(true);
    try {
      const updated = await updateAiProvider(provider);
      setSettings(updated);
      const selected = updated.options.find((option) => option.provider === updated.provider);
      onChanged(`AI provider changed to ${selected?.label ?? updated.provider}`);
    } catch (error) {
      setSettings(previous);
      onError(error instanceof Error ? error.message : "Could not change the AI provider.");
    } finally {
      setSaving(false);
    }
  };

  return (
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
  );
}

export default AiProviderSelector;
