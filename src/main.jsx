import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import RenderErrorBoundary from './components/RenderErrorBoundary.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RenderErrorBoundary title="Application render failed">
      <App />
    </RenderErrorBoundary>
  </React.StrictMode>
);
