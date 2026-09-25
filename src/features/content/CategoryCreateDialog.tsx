import { useState, type FormEvent } from "react";

type Props = {
  suggestedOrder: number;
  onCreate: (name: string, displayOrder: number) => Promise<void>;
  onClose: () => void;
};

function CategoryCreateDialog({ suggestedOrder, onCreate, onClose }: Props) {
  const [name, setName] = useState("");
  const [displayOrder, setDisplayOrder] = useState(suggestedOrder);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }
    setSaving(true);
    try {
      await onCreate(name.trim(), displayOrder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create category.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="modal-backdrop">
    <form className="confirm-modal category-create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-category-title" onSubmit={handleSubmit}>
      <p className="eyebrow">Content library</p>
      <h2 id="create-category-title">New category</h2>
      <label>Name
        <input autoFocus value={name} onChange={(event) => { setName(event.target.value); setError(""); }} maxLength={100} required />
      </label>
      <label>Order
        <input type="number" min="0" value={displayOrder} onChange={(event) => setDisplayOrder(Number(event.target.value))} required />
      </label>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="category-dialog-actions">
        <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="primary" type="submit" disabled={saving}>{saving ? "Creating…" : "Create category"}</button>
      </div>
    </form>
  </div>;
}

export default CategoryCreateDialog;
