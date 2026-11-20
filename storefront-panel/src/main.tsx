import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import Manager from './pages/Manager';

function Gate() {
  const { isManager, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm font-medium">
        Loading manager…
      </div>
    );
  }
  if (!isManager) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700 text-sm font-semibold">
        Only managers can open this page.
      </div>
    );
  }
  return (
    <Routes>
      <Route path="/manager/*" element={<Manager />} />
      <Route path="*" element={<Navigate to="/manager/users" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);
