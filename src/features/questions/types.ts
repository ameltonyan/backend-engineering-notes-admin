export type Difficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
export type QuestionType = "CONCEPTUAL" | "CODE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SCENARIO" | "INTERVIEW" | "TRICK";
export type AiGenerationMode = "main" | "follow-up";

export type AiGenerationMetadata = {
  generationRunId: string;
  provider: "MOCK" | "OPENAI" | "ZAI";
  model: string;
  operation: string;
  generatedAt: string;
};

export type GeneratedQuestion = {
  question: string;
  answer: string;
  example: string;
  codeSnippet: string;
  difficulty: Difficulty;
  type: QuestionType;
  tags: string[];
};

export type GeneratedQuestionDraft = GeneratedQuestion & {
  draftId: string;
  status: import("../content/types").QuestionStatus;
  generation: AiGenerationMetadata;
};

export type GeneratedQuestionsResult = {
  questions: GeneratedQuestion[];
  usage?: AiUsage;
  generation: AiGenerationMetadata;
};

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
