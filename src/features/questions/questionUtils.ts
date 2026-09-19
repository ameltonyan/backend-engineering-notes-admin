import type { Question } from "../content/types";

export function questionKind(depth: number) {
  return depth === 0 ? "Main question" : depth === 1 ? "Follow-up" : "Deep follow-up";
}

export function questionPreview(question: string) {
  return question.length > 96 ? `${question.slice(0, 93)}...` : question;
}

export function descendantCount(questionId: number, questions: Question[]): number {
  const pending = [questionId];
  let count = 0;
  while (pending.length) {
    const parentId = pending.pop();
    const children = questions.filter((question) => question.parentQuestionId === parentId);
    count += children.length;
    pending.push(...children.map((child) => child.id));
  }
  return count;
}
