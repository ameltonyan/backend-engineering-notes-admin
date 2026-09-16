export type DeleteConfirmation =
  | { type: "page"; title: string }
  | { type: "question"; id: number; title: string; childCount: number };

type Props = {
  confirmation: DeleteConfirmation | null;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function DeleteConfirmationDialog({ confirmation, loading, onCancel, onConfirm }: Props) {
  if (!confirmation) return null;

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
        <div className="modal-actions">
          <button type="button" disabled={loading} onClick={onCancel}>Cancel</button>
          <button className="danger danger-button" type="button" disabled={loading} onClick={onConfirm}>
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default DeleteConfirmationDialog;
