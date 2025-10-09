/**
 * @fileoverview Root App component
 * Purpose: Main application routing and layout
 */

import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Navigation } from './components/Navigation/Navigation';
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { UploadPage } from './pages/UploadPage';
import { HistoryPage } from './pages/HistoryPage';
import { PatternsPage } from './pages/PatternsPage';

export function App() {
  const location = useLocation();
  const showNavigation = location.pathname !== '/login';

  return (
    <div className="app">
      {showNavigation && <Navigation />}
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/connections"
          element={
            <ProtectedRoute>
              <ConnectionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <UploadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patterns"
          element={
            <ProtectedRoute>
              <PatternsPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}
