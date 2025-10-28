import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

function AuthGuard({ children, redirectTo = '/auth/login', fallback = null }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return fallback;
  }

  if (!user) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return children;
}

export default AuthGuard;
