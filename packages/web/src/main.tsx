/**
 * @fileoverview Main application entry point
 * Purpose: Bootstrap React application
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { setupAutoRefresh } from './lib/apiClient';
import './design/global.css';

// Setup automatic token refresh
setupAutoRefresh();

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

// basename always empty for Vercel deployment
const basename = '';

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
