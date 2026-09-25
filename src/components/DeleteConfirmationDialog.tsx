import { useState } from "react";

export type DeleteConfirmation =
  | { type: "page"; title: string; slug: string }
  | { type: "question"; id: number; title: string; childCount: number };

type Props = {
  confirmation: DeleteConfirmation | null;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function DeleteConfirmationDialog({ confirmation, loading, onCancel, onConfirm }: Props) {
  const [confirmationText, setConfirmationText] = useState("");

  if (!confirmation) return null;

  const requiresTypedConfirmation = confirmation.type === "page";
  const isConfirmed = !requiresTypedConfirmation || confirmationText.trim() === confirmation.slug;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-confirmation-title" aria-describedby="delete-confirmation-description">
        <p className="eyebrow">Confirm deletion</p>
        <h2 id="delete-confirmation-title">Delete {confirmation.type === "page" ? "page" : "question"}?</h2>
        <p id="delete-confirmation-description">
          <strong>{confirmation.title}</strong> will be permanently removed.
          {confirmation.type === "question" && confirmation.childCount > 0
            ? ` This question has ${confirmation.childCount} follow-up${confirmation.childCount === 1 ? "" : "s"}; the API will delete the entire subtree. `
            : " "}
          This action cannot be undone.
        </p>
        {requiresTypedConfirmation && (
          <label className="delete-confirmation-input">
            Type <code>{confirmation.slug}</code> to permanently delete this page.
            <input
              autoFocus
              value={confirmationText}
              onChange={(event) => setConfirmationText(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-describedby="delete-confirmation-description"
            />
          </label>
        )}
        <div className="modal-actions">
          <button type="button" disabled={loading} onClick={onCancel}>Cancel</button>
          <button className="danger danger-button" type="button" disabled={loading || !isConfirmed} onClick={onConfirm}>
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default DeleteConfirmationDialog;
