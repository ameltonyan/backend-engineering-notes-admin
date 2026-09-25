import type { AiGenerationMetadata, Difficulty } from "../questions/types";

export type TopicSummary = {
  slug: string;
  title: string;
  description: string | null;
  category: string;
  displayOrder: number;
};

export type Category = {
  id: number;
  name: string;
  displayOrder: number;
};

export type Question = {
  id: number;
  parentQuestionId: number | null;
  question: string;
  answer: string;
  example: string | null;
  codeSnippet: string | null;
  difficulty: Difficulty;
  status: QuestionStatus;
  tags: string[];
  aiGeneration: AiGenerationMetadata | null;
  displayOrder: number;
  depth: number;
};

export type QuestionStatus = "DRAFT" | "REVIEWED" | "PUBLISHED";

export type Topic = TopicSummary & { questions: Question[] };

export type TopicForm = {
  slug: string;
  title: string;
  description: string;
  category: string;
  displayOrder: number;
};

export type QuestionForm = {
  question: string;
  answer: string;
  example: string;
  codeSnippet: string;
  difficulty: Difficulty;
  status: QuestionStatus;
  tags: string[];
  aiGenerationRunId: string | null;
  parentQuestionId: number | null;
  displayOrder: number;
};

export type GeneratedTopicProposal = {
  title: string;
  description: string;
};
