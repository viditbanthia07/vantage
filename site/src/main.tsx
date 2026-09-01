import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('no #root element; index.html and this entry disagree');
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
