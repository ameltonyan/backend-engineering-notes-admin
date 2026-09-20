import type { QuestionStatus } from "../../content/types";
import { QUESTION_STATUS_OPTIONS } from "../questionStatus";

type QuestionStatusSelectorProps = {
  value: QuestionStatus;
  onChange: (status: QuestionStatus) => void;
  name: string;
  compact?: boolean;
};

export default function QuestionStatusSelector({
  value,
  onChange,
  name,
  compact = false,
}: QuestionStatusSelectorProps) {
  return (
    <fieldset className={`question-status-selector${compact ? " question-status-selector-compact" : ""}`}>
      {!compact && <legend>Publishing status</legend>}
      <div className="question-status-options">
        {QUESTION_STATUS_OPTIONS.map((status) => (
          <label className={`question-status-option${value === status.value ? " selected" : ""}`} key={status.value}>
            <input type="radio" name={name} value={status.value} checked={value === status.value} onChange={() => onChange(status.value)} />
            <span>{status.label}</span>
            {!compact && <small>{status.description}</small>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
