import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { UserDashboardPage } from './pages/UserDashboardPage';
import { TroubleshootWizardPage } from './pages/TroubleshootWizardPage';
import { SessionHistoryPage } from './pages/SessionHistoryPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminDatasetPage } from './pages/AdminDatasetPage';
import { AdminCorrectionsPage } from './pages/AdminCorrectionsPage';
import { AdminResponsibleAIPage } from './pages/AdminResponsibleAIPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ children, adminOnly }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center font-mono text-xs text-cyan-400">
        Loading NetSage Session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-[#0b0f19] text-slate-100 font-sans">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              <Route path="/dashboard" element={<UserDashboardPage />} />
              <Route path="/troubleshoot" element={<TroubleshootWizardPage />} />
              <Route path="/history" element={<SessionHistoryPage />} />

              {/* Admin Protected Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/dataset"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminDatasetPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/corrections"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminCorrectionsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/responsible-ai"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminResponsibleAIPage />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
};
