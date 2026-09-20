export type Difficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
export type QuestionType = "CONCEPTUAL" | "CODE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SCENARIO" | "INTERVIEW" | "TRICK";
export type AiGenerationMode = "main" | "batch-main" | "follow-up";

export type GeneratedQuestion = {
  question: string;
  answer: string;
  example: string;
  codeSnippet: string;
  difficulty: Difficulty;
  type: QuestionType;
  tags: string[];
};

export type GeneratedQuestionDraft = GeneratedQuestion & { draftId: string };

export type AnswerImprovement = {
  criteria: string;
  humanized: boolean;
  shortened: boolean;
  simplified: boolean;
};

export type AiUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedTokens?: number;
};
