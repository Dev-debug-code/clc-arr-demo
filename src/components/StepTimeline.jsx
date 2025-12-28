import PropTypes from 'prop-types';

export default function StepTimeline({ steps, currentStep }) {
  return (
    <ol className="step-timeline">
      {steps.map((step) => {
        const status =
          currentStep === step.id ? 'active' : currentStep > step.id ? 'complete' : 'upcoming';
        return (
          <li key={step.id} className={`timeline-step ${status}`}>
            <div className="timeline-marker">{step.id}</div>
            <div className="timeline-content">
              <p className="timeline-title">{step.title}</p>
              <p className="timeline-subtitle">{step.subtitle}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

StepTimeline.propTypes = {
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      title: PropTypes.string.isRequired,
      subtitle: PropTypes.string.isRequired
    })
  ).isRequired,
  currentStep: PropTypes.number.isRequired
};
