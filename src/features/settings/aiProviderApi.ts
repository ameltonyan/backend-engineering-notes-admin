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
};

export const getAiProviderSettings = () =>
  apiRequest<AiProviderSettings>("/api/admin/ai/provider");

export const updateAiProvider = (provider: AiProvider) =>
  apiRequest<AiProviderSettings>("/api/admin/ai/provider", {
    method: "PUT",
    body: JSON.stringify({ provider }),
  });
