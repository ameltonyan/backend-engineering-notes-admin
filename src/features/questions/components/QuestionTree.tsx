import type { Question } from "../../content/types";
import type { ReactNode } from "react";
import { questionKind } from "../questionUtils";

type QuestionTreeProps = {
  questions: Question[];
  rootQuestions: Question[];
  selectedQuestionId: number | null;
  expandedQuestions: Record<number, boolean>;
  revealedAnswers: Record<number, boolean>;
  revealedExamples: Record<number, boolean>;
  revealedCodeSnippets: Record<number, boolean>;
  revealedTags: Record<number, boolean>;
  isAiBusy: boolean;
  generatingDetailsFor: number | null;
  isVisible: (question: Question) => boolean;
  onSelect: (question: Question, hasChildren: boolean) => void;
  onDeselect: () => void;
  onToggleAnswer: (questionId: number) => void;
  onToggleExample: (questionId: number) => void;
  onToggleCodeSnippet: (questionId: number) => void;
  onToggleTags: (questionId: number) => void;
  onMove: (questionId: number, direction: -1 | 1) => void;
  onEdit: (question: Question) => void;
  onImprove: (question: Question) => void;
  onAddFollowUp: (parentId: number) => void;
  onGenerateFollowUps: () => void;
  onGenerateDetails: (question: Question) => void;
};

export default function QuestionTree({
  questions,
  rootQuestions,
  selectedQuestionId,
  expandedQuestions,
  revealedAnswers,
  revealedExamples,
  revealedCodeSnippets,
  revealedTags,
  isAiBusy,
  generatingDetailsFor,
  isVisible,
  onSelect,
  onDeselect,
  onToggleAnswer,
  onToggleExample,
  onToggleCodeSnippet,
  onToggleTags,
  onMove,
  onEdit,
  onImprove,
  onAddFollowUp,
  onGenerateFollowUps,
  onGenerateDetails,
}: QuestionTreeProps) {
  const renderQuestionNode = (question: Question): ReactNode => {
    if (!isVisible(question)) return null;

    const children = questions.filter((candidate) => candidate.parentQuestionId === question.id);
    const siblings = question.parentQuestionId === null
      ? rootQuestions
      : questions.filter((candidate) => candidate.parentQuestionId === question.parentQuestionId);
    const siblingIndex = siblings.findIndex((candidate) => candidate.id === question.id);
    const isExpanded = expandedQuestions[question.id] !== false;
    const isSelected = selectedQuestionId === question.id;
    const childNodes = children.map(renderQuestionNode);
    const canMoveUp = siblingIndex > 0;
    const canMoveDown = siblingIndex >= 0 && siblingIndex < siblings.length - 1;

    return (
      <article id={"question-node-" + question.id} className={["tree-node", "depth-" + Math.min(question.depth, 5), isSelected ? "selected" : ""].filter(Boolean).join(" ")} key={question.id}>
        <div className="tree-node-row">
          <button
            className="tree-node-toggle"
            type="button"
            aria-expanded={children.length ? isExpanded : undefined}
            aria-label={"Select " + question.question}
            onClick={() => {
              if (isSelected) {
                onDeselect();
                return;
              }
              onSelect(question, children.length > 0);
            }}
          >
            <span className="tree-branch" aria-hidden="true">{children.length ? (isExpanded ? "▾" : "▸") : "·"}</span>
            <span className="question-number" title={"Position " + (siblingIndex + 1) + " of " + siblings.length}>{siblingIndex + 1}</span>
            <span className="tree-node-copy">
              <strong>{question.question}</strong>
              <span className="tree-meta">
                {questionKind(question.depth)} <span className={["question-status-indicator", "status-" + question.status.toLowerCase()].join(" ")} title={question.status.toLowerCase()} aria-label={question.status.toLowerCase()} />
              </span>
            </span>
          </button>
          <div className="question-order-controls" aria-label={"Order for " + question.question}>
            <button className="question-order-button" type="button" title={canMoveUp ? "Move up" : "Already first in this group"} aria-label="Move question up" disabled={!canMoveUp} onClick={() => onMove(question.id, -1)}>↑</button>
            <button className="question-order-button" type="button" title={canMoveDown ? "Move down" : "Already last in this group"} aria-label="Move question down" disabled={!canMoveDown} onClick={() => onMove(question.id, 1)}>↓</button>
          </div>
        </div>
        {isSelected && (
          <section className="selected-question-card" aria-label={"Selected " + questionKind(question.depth).toLowerCase()}>
            <div className="selected-question-context">
              <span>{questionKind(question.depth)} · Level {question.depth}</span>
              <span>Order {siblingIndex + 1} of {siblings.length}</span>
              <span className={["question-status-badge", "status-" + question.status.toLowerCase()].join(" ")}>{question.status.toLowerCase()}</span>
              {question.aiGeneration && (
                <span title={"Generation run " + question.aiGeneration.generationRunId}>
                  AI-assisted by {question.aiGeneration.provider} ({question.aiGeneration.model})
                </span>
              )}
            </div>
            <div className="question-disclosures">
              <button className="answer-disclosure" type="button" aria-expanded={Boolean(revealedAnswers[question.id])} onClick={() => onToggleAnswer(question.id)}>
                {revealedAnswers[question.id] ? "Hide reference answer" : "Show reference answer"}
              </button>
              {question.example && <button className="answer-disclosure" type="button" aria-expanded={Boolean(revealedExamples[question.id])} onClick={() => onToggleExample(question.id)}>
                {revealedExamples[question.id] ? "Hide example" : "Show example"}
              </button>}
              {question.codeSnippet && <button className="answer-disclosure" type="button" aria-expanded={Boolean(revealedCodeSnippets[question.id])} onClick={() => onToggleCodeSnippet(question.id)}>
                {revealedCodeSnippets[question.id] ? "Hide code" : "Show code"}
              </button>}
              {question.tags.length > 0 && <button className="answer-disclosure" type="button" aria-expanded={Boolean(revealedTags[question.id])} onClick={() => onToggleTags(question.id)}>
                {revealedTags[question.id] ? "Hide tags" : "Show tags"}
              </button>}
            </div>
            {revealedAnswers[question.id] && <p className="inline-answer">{question.answer}</p>}
            {revealedExamples[question.id] && question.example && <p className="inline-answer inline-example">{question.example}</p>}
            {revealedCodeSnippets[question.id] && question.codeSnippet && <pre className="inline-code-snippet"><code>{question.codeSnippet}</code></pre>}
            {revealedTags[question.id] && question.tags.length > 0 && <div className="inline-tags">{question.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
            <div className="selected-question-actions" aria-label="Question actions">
              <button type="button" title="Edit question" onClick={() => onEdit(question)}>Edit</button>
              <button type="button" title="Ask AI to improve this saved question and answer" onClick={() => onImprove(question)}>Improve with AI</button>
              <button type="button" disabled={isAiBusy} onClick={onGenerateFollowUps}>Generate follow-ups</button>
              <button type="button" disabled={isAiBusy} title="Open the editor to generate a short example and optional code snippet" onClick={() => onGenerateDetails(question)}>
                {generatingDetailsFor === question.id ? "Generating details..." : "Generate example + code"}
              </button>
              <button type="button" title="Add a follow-up question" onClick={() => onAddFollowUp(question.id)}>+ Follow-up</button>
            </div>
          </section>
        )}
        {isExpanded && childNodes.length > 0 && <div className="tree-children">{childNodes}</div>}
      </article>
    );
  };

  return <div className="question-tree" aria-label="Interview question hierarchy">{rootQuestions.map(renderQuestionNode)}</div>;
}
