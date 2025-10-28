import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function useRequireAuth(redirectTo = '/auth/login') {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate(redirectTo, { replace: true, state: { from: location } });
    }
  }, [user, loading, navigate, redirectTo, location]);

  return { user, loading };
}
