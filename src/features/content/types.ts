import type { Difficulty } from "../questions/types";

export type PageSummary = {
  slug: string;
  title: string;
  description: string | null;
  section: string;
  displayOrder: number;
};

export type Section = {
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
  displayOrder: number;
  depth: number;
};

export type QuestionStatus = "DRAFT" | "REVIEWED" | "PUBLISHED";

export type Page = PageSummary & { questions: Question[] };

export type PageForm = {
  slug: string;
  title: string;
  description: string;
  section: string;
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
  parentQuestionId: number | null;
  displayOrder: number;
};

export type GeneratedTopicSection = {
  title: string;
  description: string;
};
