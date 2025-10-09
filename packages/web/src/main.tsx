/**
 * @fileoverview Main application entry point
 * Purpose: Bootstrap React application
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './design/global.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

// basename para GitHub Pages en producción, vacío en desarrollo
const basename = import.meta.env.PROD ? '/SubiteYa' : '';

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
