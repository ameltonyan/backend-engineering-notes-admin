import { apiRequest } from "../../services/apiClient";

export type AiProvider = "MOCK" | "OPENAI" | "ZAI";
export type AiProviderSettingType = "STRING" | "ENUM";

export type AiProviderSettingDefinition = {
  key: string;
  label: string;
  type: AiProviderSettingType;
  required: boolean;
  allowedValues: string[];
  description: string;
  defaultValue: string | null;
};

export type AiProviderConfiguration = {
  id: AiProvider;
  label: string;
  configured: boolean;
  settings: AiProviderSettingDefinition[];
  values: Record<string, string>;
};

export type AiProviderSettings = {
  selectedProvider: AiProvider;
  providers: AiProviderConfiguration[];
};

export const getAiProviderSettings = () =>
  apiRequest<AiProviderSettings>("/api/admin/ai/provider");

export const updateAiProvider = (provider: AiProvider) =>
  apiRequest<AiProviderSettings>("/api/admin/ai/provider", {
    method: "PUT",
    body: JSON.stringify({ provider }),
  });

export const updateAiProviderSettings = (provider: AiProvider, settings: Record<string, string>) =>
  apiRequest<AiProviderSettings>("/api/admin/ai/provider/settings", {
    method: "PUT",
    body: JSON.stringify({ provider, settings }),
  });
