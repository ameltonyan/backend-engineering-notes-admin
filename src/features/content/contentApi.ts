import { apiRequest } from "../../services/apiClient";
import type { Page, PageSummary, Section } from "./types";

export const listPages = () => apiRequest<PageSummary[]>("/api/admin/pages");

export const listSections = () => apiRequest<Section[]>("/api/admin/sections");

export const getPage = (slug: string) =>
  apiRequest<Page>(`/api/admin/pages/${encodeURIComponent(slug)}`);
