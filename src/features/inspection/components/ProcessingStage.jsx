import { AI_PROCESSING_STEPS } from '../config.js';

export default function ProcessingStage({ analysisMessage, analysisProgress, analysisStageIndex }) {
  return (
    <div className="stage-card processing">
      <div className="processing-icon" aria-hidden="true">
        ⚙
      </div>
      <div>
        <h2>AI Processing in progress</h2>
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
        {AI_PROCESSING_STEPS.map((label, index) => {
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
      <p className="panel-subtitle">You will be taken to Overview automatically once processing completes.</p>
    </div>
  );
}
