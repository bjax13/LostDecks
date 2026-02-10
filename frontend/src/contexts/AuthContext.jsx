import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  signInWithPopup,
} from 'firebase/auth';
import { auth, googleProvider, githubProvider, hasFirebaseConfig } from '../lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleError = useCallback((err) => {
    console.error('Firebase auth error', err);
    setError(err);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const login = useCallback(
    async (email, password) => {
      if (!auth) {
        const err = new Error(
          'Authentication is not configured. Set VITE_FIREBASE_* variables in frontend/.env to enable sign-in.',
        );
        handleError(err);
        throw err;
      }

      clearError();
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        handleError(err);
        throw err;
      }
    },
    [clearError, handleError],
  );

  const register = useCallback(
    async (email, password, profile = {}) => {
      if (!auth) {
        const err = new Error(
          'Authentication is not configured. Set VITE_FIREBASE_* variables in frontend/.env to enable registration.',
        );
        handleError(err);
        throw err;
      }

      clearError();
      try {
        const credentials = await createUserWithEmailAndPassword(auth, email, password);
        if (profile.displayName) {
          await updateProfile(credentials.user, { displayName: profile.displayName });
        }
      } catch (err) {
        handleError(err);
        throw err;
      }
    },
    [clearError, handleError],
  );

  const logout = useCallback(async () => {
    if (!auth) {
      const err = new Error(
        'Authentication is not configured. Set VITE_FIREBASE_* variables in frontend/.env to enable sign-out.',
      );
      handleError(err);
      throw err;
    }

    clearError();
    try {
      await signOut(auth);
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [clearError, handleError]);

  const resetPassword = useCallback(
    async (email) => {
      if (!auth) {
        const err = new Error(
          'Authentication is not configured. Set VITE_FIREBASE_* variables in frontend/.env to enable password reset.',
        );
        handleError(err);
        throw err;
      }

      clearError();
      try {
        await sendPasswordResetEmail(auth, email);
      } catch (err) {
        handleError(err);
        throw err;
      }
    },
    [clearError, handleError],
  );

  const signInWithProvider = useCallback(
    async (provider) => {
      if (!auth || !provider) {
        const err = new Error(
          'Authentication is not configured. Set VITE_FIREBASE_* variables in frontend/.env to enable social sign-in.',
        );
        handleError(err);
        throw err;
      }

      clearError();
      try {
        await signInWithPopup(auth, provider);
      } catch (err) {
        handleError(err);
        throw err;
      }
    },
    [clearError, handleError],
  );

  const loginWithGoogle = useCallback(() => signInWithProvider(googleProvider), [signInWithProvider]);
  const loginWithGithub = useCallback(() => signInWithProvider(githubProvider), [signInWithProvider]);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      clearError,
      login,
      register,
      logout,
      resetPassword,
      loginWithGoogle,
      loginWithGithub,
      hasFirebaseConfig,
    }),
    [user, loading, error, clearError, login, register, logout, resetPassword, loginWithGoogle, loginWithGithub],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
