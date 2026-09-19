type Props = {
  error: string;
  notice: string;
  onDismiss: () => void;
};

function StatusBanner({ error, notice, onDismiss }: Props) {
  if (!error && !notice) return null;

  return (
    <div className={error ? "status-banner error-banner" : "status-banner notice-banner"}>
      <span>{error || notice}</span>
      <button type="button" aria-label="Dismiss message" onClick={onDismiss}>Close</button>
    </div>
  );
}

export default StatusBanner;
