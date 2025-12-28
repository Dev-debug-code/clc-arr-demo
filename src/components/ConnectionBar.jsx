import PropTypes from 'prop-types';

export default function ConnectionBar({ icon, status, path, lastSynced, meta }) {
  return (
    <div className="connection-bar">
      <div className="connection-status">
        <div className="connection-icon">{icon}</div>
        <div className="connection-details">
          <h4>{status}</h4>
          <div className="connection-path">{path}</div>
        </div>
      </div>
      <div className="connection-meta">
        <div>{lastSynced}</div>
        {meta ? <div className="connection-extra">{meta}</div> : null}
      </div>
    </div>
  );
}

ConnectionBar.propTypes = {
  icon: PropTypes.string.isRequired,
  status: PropTypes.string.isRequired,
  path: PropTypes.string.isRequired,
  lastSynced: PropTypes.string.isRequired,
  meta: PropTypes.string
};
