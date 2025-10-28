import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function useAuthGuard() {
  const { user, loading } = useAuth();
  const location = useLocation();

  return useMemo(
    () => ({
      isAuthenticated: Boolean(user),
      loading,
      redirectState: { from: location },
    }),
    [user, loading, location],
  );
}
