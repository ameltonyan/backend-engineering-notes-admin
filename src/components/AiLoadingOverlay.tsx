type Props = {
  message: string;
  pagePlanLoading: boolean;
};

function AiLoadingOverlay({ message, pagePlanLoading }: Props) {
  return (
    <div className="ai-loading-overlay" role="status" aria-live="polite" aria-label="AI request in progress">
      <div className="ai-loading-card">
        <div className="ai-loading-mark" aria-hidden="true"><span /><span /><span /></div>
        <p className="eyebrow">AI assist is thinking</p>
        <h2>{pagePlanLoading ? "Building your page plan" : "Drafting interview material"}</h2>
        <p className="ai-loading-message">{message}</p>
        <div className="ai-loading-track" aria-hidden="true"><span /></div>
        <small>This can take a little while for reasoning-heavy requests. Please keep this tab open.</small>
      </div>
    </div>
  );
}

export default AiLoadingOverlay;
