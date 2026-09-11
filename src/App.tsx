// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import RifaPage from './pages/RifaPage';
import AdminPage from './pages/AdminPage';
import AdminLogin from './pages/AdminLogin';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/rifa" replace />} />
        <Route path="/rifa" element={<RifaPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/rifa" replace />} />
      </Routes>
    </AuthProvider>
  );
}
