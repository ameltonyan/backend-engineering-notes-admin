import { apiRequest } from "../../services/apiClient";
import type { Topic, TopicSummary, Category } from "./types";
import type { Difficulty } from "../questions/types";

export const listTopics = () => apiRequest<TopicSummary[]>("/api/admin/topics");

export const listCategories = () => apiRequest<Category[]>("/api/admin/categories");

export const getTopic = (slug: string, difficulty: Difficulty) =>
  apiRequest<Topic>(`/api/admin/topics/${encodeURIComponent(slug)}?difficulty=${encodeURIComponent(difficulty)}`);
