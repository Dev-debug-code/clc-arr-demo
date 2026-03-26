export const renderRiskDots = (riskLabel) => {
  const risk = (riskLabel || '').toLowerCase();
  const filled = risk === 'high' ? ['high', 'high', 'high'] : risk === 'medium' ? ['medium', 'medium'] : ['low'];
  return (
    <span className="risk-dots" aria-label={`Risk ${riskLabel}`}>
      {[0, 1, 2].map((idx) => {
        const level = filled[idx];
        return <span key={`risk-${riskLabel}-${idx}`} className={`risk-dot ${level ? `filled ${level}` : 'empty'}`} />;
      })}
    </span>
  );
};

export const renderConfidenceDots = (status) => {
  const map =
    status === 'attention' ? ['red'] : status === 'reviewing' ? ['amber', 'amber'] : ['green', 'green', 'green'];
  return (
    <span className="confidence-dots" aria-label={`Confidence ${status}`}>
      {[0, 1, 2].map((idx) => (
        <span key={`conf-${status}-${idx}`} className={`confidence-dot ${map[idx] ? map[idx] : 'empty'}`} />
      ))}
    </span>
  );
};
