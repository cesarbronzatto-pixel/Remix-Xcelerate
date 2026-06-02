import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Se o usuário não estiver logado, redireciona para o login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
