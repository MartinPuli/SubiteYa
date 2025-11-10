/**
 * @fileoverview Root App component
 * Purpose: Main application routing and layout
 */

import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Navigation } from './components/Navigation/Navigation';
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute';
import { ToastContainer } from './components/Toast/ToastContainer';
import { useToastStore } from './store/toastStore';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { EmailVerificationPage } from './pages/EmailVerificationPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { LegalDocumentsPage } from './pages/LegalDocumentsPage';
import { DashboardPage } from './pages/DashboardPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { UploadPage } from './pages/UploadPage';
import { HistoryPage } from './pages/HistoryPage';
import { PatternsPage } from './pages/PatternsPage';
import { PatternEditorPage } from './pages/PatternEditorPage';

export function App() {
  const location = useLocation();
  const { toasts, removeToast } = useToastStore();

  const showNavigation =
    location.pathname !== '/login' &&
    location.pathname !== '/register' &&
    location.pathname !== '/verify-email' &&
    location.pathname !== '/forgot-password' &&
    location.pathname !== '/reset-password' &&
    !location.pathname.startsWith('/legal');

  return (
    <div className="app">
      {showNavigation && <Navigation />}
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<EmailVerificationPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/legal/:type" element={<LegalDocumentsPage />} />
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
        <Route
          path="/patterns/:id"
          element={
            <ProtectedRoute>
              <PatternEditorPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}
