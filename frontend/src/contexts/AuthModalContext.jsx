import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import AuthModal from '../components/Auth/AuthModal.jsx';

const AuthModalContext = createContext(null);

export function AuthModalProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState(null);

  const openAuthModal = useCallback((options = {}) => {
    setContext(options);
    setIsOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsOpen(false);
    setContext(null);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      openAuthModal,
      closeAuthModal,
      context,
    }),
    [isOpen, openAuthModal, closeAuthModal, context],
  );

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModal isOpen={isOpen} onClose={closeAuthModal} />
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error('useAuthModal must be used within an AuthModalProvider');
  }
  return context;
}
