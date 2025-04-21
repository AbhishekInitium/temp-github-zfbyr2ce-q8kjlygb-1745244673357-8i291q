import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './components/Dashboard';
import { SchemeDesigner } from './components/SchemeDesigner';
import { AdminPanel } from './components/AdminPanel';
import { KpiConfigurator } from './components/KpiConfigurator';
import { Reports } from './components/Reports';
import { SchemeExecution } from './pages/SchemeExecution';
import { SchemeResults } from './pages/SchemeResults';
import { ExecutionLog } from './components/ExecutionLog';
import { AgentDashboard } from './pages/AgentDashboard';
import { useAuthStore } from './store/authStore';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  const user = useAuthStore((state) => state.user);

  // Redirect agents to their dashboard
  if (user?.role === 'agent') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/agent"
          element={
            <ProtectedRoute>
              <Layout>
                <AgentDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/agent" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/designer"
        element={
          <ProtectedRoute>
            <Layout>
              <SchemeDesigner />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Layout>
              <AdminPanel />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/kpi-config"
        element={
          <ProtectedRoute>
            <Layout>
              <KpiConfigurator />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Layout>
              <Reports />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/execution"
        element={
          <ProtectedRoute>
            <Layout>
              <SchemeExecution />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/execution/results"
        element={
          <ProtectedRoute>
            <Layout>
              <SchemeResults />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/execution/log"
        element={
          <ProtectedRoute>
            <Layout>
              <ExecutionLog />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/agent"
        element={
          <ProtectedRoute>
            <Layout>
              <AgentDashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;