import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { syncPostHogUser } from "../analytics/posthog.js";
import { auth, googleProvider, hasFirebaseConfig } from "../lib/firebase";
import { updateUserPreferences } from "../lib/userPreferences";

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

  useEffect(() => {
    syncPostHogUser(user);
  }, [user]);

  const handleError = useCallback((err) => {
    console.error("Firebase auth error", err);
    setError(err);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const login = useCallback(
    async (email, password) => {
      if (!auth) {
        const err = new Error(
          "Authentication is not configured. Set VITE_FIREBASE_* variables in frontend/.env to enable sign-in.",
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

  const loginAsGuest = useCallback(async () => {
    if (!auth) {
      const err = new Error(
        "Authentication is not configured. Set VITE_FIREBASE_* variables in frontend/.env to enable sign-in.",
      );
      handleError(err);
      throw err;
    }

    clearError();
    try {
      const credentials = await signInAnonymously(auth);
      const guestUid = credentials?.user?.uid;
      if (guestUid) {
        try {
          await updateUserPreferences(guestUid, { matchingOptOut: true });
        } catch (prefErr) {
          console.error("Failed to opt guest out of matching", prefErr);
        }
      }
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [clearError, handleError]);

  const register = useCallback(
    async (email, password, profile = {}) => {
      if (!auth) {
        const err = new Error(
          "Authentication is not configured. Set VITE_FIREBASE_* variables in frontend/.env to enable registration.",
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
          "Authentication is not configured. Set VITE_FIREBASE_* variables in frontend/.env to enable password reset.",
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
          "Authentication is not configured. Set VITE_FIREBASE_* variables in frontend/.env to enable social sign-in.",
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

  const loginWithGoogle = useCallback(
    () => signInWithProvider(googleProvider),
    [signInWithProvider],
  );

  const updateDisplayName = useCallback(
    async (displayName) => {
      if (!auth) {
        const err = new Error(
          "Authentication is not configured. Set VITE_FIREBASE_* variables in frontend/.env to enable profile updates.",
        );
        handleError(err);
        throw err;
      }

      const currentUser = auth.currentUser;
      if (!currentUser) {
        const err = new Error("You must be signed in to update your display name.");
        handleError(err);
        throw err;
      }

      const trimmed = String(displayName ?? "").trim();
      if (!trimmed) {
        const err = new Error("Display name cannot be empty.");
        handleError(err);
        throw err;
      }

      clearError();
      try {
        await updateProfile(currentUser, { displayName: trimmed });
        // updateProfile mutates the Firebase user in place; clone so React re-renders.
        // Skip if the signed-in session changed while the write was in flight.
        if (auth.currentUser !== currentUser) {
          return;
        }
        setUser({ ...currentUser, displayName: trimmed });
      } catch (err) {
        handleError(err);
        throw err;
      }
    },
    [clearError, handleError],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      clearError,
      login,
      loginAsGuest,
      register,
      logout,
      resetPassword,
      loginWithGoogle,
      updateDisplayName,
      hasFirebaseConfig,
    }),
    [
      user,
      loading,
      error,
      clearError,
      login,
      loginAsGuest,
      register,
      logout,
      resetPassword,
      loginWithGoogle,
      updateDisplayName,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
