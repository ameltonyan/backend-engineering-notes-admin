import { apiRequest } from "../../services/apiClient";

export type AiProvider = "MOCK" | "OPENAI" | "ZAI";

export type AiProviderOption = {
  provider: AiProvider;
  label: string;
  configured: boolean;
};

export type AiProviderSettings = {
  provider: AiProvider;
  options: AiProviderOption[];
  model: string | null;
  reasoningEffort: string | null;
  modelConfigurable: boolean;
  reasoningEffortConfigurable: boolean;
};

export const getAiProviderSettings = () =>
  apiRequest<AiProviderSettings>("/api/admin/ai/provider");

export const updateAiProvider = (provider: AiProvider) =>
  apiRequest<AiProviderSettings>("/api/admin/ai/provider", {
    method: "PUT",
    body: JSON.stringify({ provider }),
  });

export const updateAiProviderSettings = (settings: {
  provider: AiProvider;
  model: string;
  reasoningEffort: string | null;
}) =>
  apiRequest<AiProviderSettings>("/api/admin/ai/provider/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
