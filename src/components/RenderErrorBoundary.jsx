import React from 'react';

class RenderErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unknown render error' };
  }

  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.error('RenderErrorBoundary caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="edge-empty-card">
          <div className="edge-empty-card__icon">⚠️</div>
          <h3>{this.props.title || 'View failed to render'}</h3>
          <p>{this.state.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default RenderErrorBoundary;
