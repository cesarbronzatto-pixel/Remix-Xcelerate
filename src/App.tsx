/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PlaybookSessionPage from './pages/PlaybookSession';

// Student Pages
import StudentLayout from './components/layout/StudentLayout';
import TrailDetails from './pages/student/TrailDetails';
import ModulePlayer from './pages/student/ModulePlayer';
import LeaderDashboard from './pages/student/LeaderDashboard';
import RecognitionWall from './pages/student/RecognitionWall';
import Settings from './pages/student/Settings';
import LiveSession from './pages/student/LiveSession';

// Admin Pages
import AdminLayout from './components/layout/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import Roles from './pages/admin/Roles';
import Users from './pages/admin/Users';
import Areas from './pages/admin/Areas';
import Trails from './pages/admin/Trails';
import Modules from './pages/admin/Modules';
import Countries from './pages/admin/Countries';
import Ranking from './pages/admin/Ranking';
import PlaybookAdmin from './pages/admin/Playbook';
import ProjectsAdmin from './pages/admin/Projects';
import Submissions from './pages/admin/Submissions';
import OnboardingAdmin from './pages/admin/OnboardingAdmin';
import OnboardingAnalytics from './pages/admin/OnboardingAnalytics';
import { useAuth } from './contexts/AuthContext';
import { useDeadlineCheck } from './hooks/useDeadlineCheck';
import BlockedScreen from './components/BlockedScreen';

function MainApp() {
  const { userProfile, loading } = useAuth();
  useDeadlineCheck();

  React.useEffect(() => {
    document.title = 'Xcelerate';
  }, []);

  if (loading) return null;

  if (userProfile?.isBlocked) {
    return <BlockedScreen />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Rotas do Aluno (LMS Frontend) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <StudentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="playbook/:sessionId" element={<PlaybookSessionPage />} />
        <Route path="trail/:id" element={<TrailDetails />} />
        <Route path="module/:id" element={<ModulePlayer />} />
        <Route path="ranking" element={<Ranking />} />
        <Route path="team" element={<LeaderDashboard />} />
        <Route path="recognition" element={<RecognitionWall />} />
        <Route path="settings" element={<Settings />} />
        <Route path="live/:id" element={<LiveSession />} />
      </Route>

      {/* Rotas do Admin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="roles" element={<Roles />} />
        <Route path="users" element={<Users />} />
        <Route path="areas" element={<Areas />} />
        <Route path="trails" element={<Trails />} />
        <Route path="modules" element={<Modules />} />
        <Route path="countries" element={<Countries />} />
        <Route path="ranking" element={<Ranking />} />
        <Route path="playbook" element={<PlaybookAdmin />} />
        <Route path="projects" element={<ProjectsAdmin />} />
        <Route path="submissions" element={<Submissions />} />
        <Route path="onboarding" element={<OnboardingAdmin />} />
        <Route path="onboarding-analytics" element={<OnboardingAnalytics />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { Toaster } from 'sonner';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <MainApp />
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
