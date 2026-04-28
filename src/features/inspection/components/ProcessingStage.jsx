export default function ProcessingStage({
  analysisTitle,
  analysisMessage,
  analysisProgress,
  analysisStageIndex,
  analysisSteps,
  analysisCompletionLabel
}) {
  return (
    <div className="stage-card processing">
      <div className="processing-icon" aria-hidden="true">
        ⚙
      </div>
      <div>
        <h2>{analysisTitle}</h2>
        <p className="panel-subtitle">{analysisMessage}</p>
      </div>
      <div
        className="progress-bar-wrapper"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(analysisProgress)}
      >
        <div
          className="progress-bar-fill"
          style={{ width: `${Math.min(100, Math.max(0, analysisProgress))}%` }}
        />
      </div>
      <p className="progress-status">{Math.round(analysisProgress)}% complete</p>
      <div className="progress-steps">
        {analysisSteps.map((label, index) => {
          const status = index < analysisStageIndex ? 'completed' : index === analysisStageIndex ? 'active' : '';
          return (
            <div key={label} className={`progress-step ${status}`}>
              <span className="progress-step-icon">
                {status === 'completed' ? '✓' : status === 'active' ? '⟳' : '○'}
              </span>
              {label}
            </div>
          );
        })}
      </div>
      <p className="panel-subtitle">
        You will be taken to {analysisCompletionLabel} automatically once processing completes.
      </p>
    </div>
  );
}
