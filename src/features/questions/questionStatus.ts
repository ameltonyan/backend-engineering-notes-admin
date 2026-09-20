import type { QuestionStatus } from "../content/types";

export type QuestionStatusOption = {
  value: QuestionStatus;
  label: string;
  description: string;
};

export const QUESTION_STATUS_OPTIONS: readonly QuestionStatusOption[] = [
  { value: "DRAFT", label: "Draft", description: "Still being written" },
  { value: "REVIEWED", label: "Reviewed", description: "Ready for a final check" },
  { value: "PUBLISHED", label: "Published", description: "Visible to learners" },
];
