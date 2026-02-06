import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Reset global styles
const style = document.createElement('style');
style.textContent = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  body {
    background: #06060a;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
  }
  input[type="range"]::-webkit-slider-track {
    background: #1a1a1e;
    height: 4px;
    border-radius: 2px;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #e0e0e0;
    border: 2px solid #333;
    cursor: pointer;
    margin-top: -5px;
  }
  input[type="range"][style*="vertical"] {
    width: 4px;
  }
  select {
    outline: none;
    cursor: pointer;
  }
  ::-webkit-scrollbar {
    width: 4px;
  }
  ::-webkit-scrollbar-track {
    background: #08080a;
  }
  ::-webkit-scrollbar-thumb {
    background: #2a2a2e;
    border-radius: 2px;
  }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
