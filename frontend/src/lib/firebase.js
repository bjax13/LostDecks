import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  setPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.trim().length > 0,
);

if (!hasFirebaseConfig) {
  console.warn(
    'Firebase is not configured. Copy .env.example to .env.local and set VITE_FIREBASE_* variables to enable auth.',
  );
}

const app = hasFirebaseConfig ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const functions = app ? getFunctions(app) : null;

// --- Local Emulator support (Auth + Firestore + Functions) ---
const useEmulators = String(import.meta.env.VITE_USE_EMULATORS || '').toLowerCase() === 'true';

if (useEmulators && auth && db && functions) {
  const authUrl = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099';
  const fsHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
  const fsPort = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080);
  const fnHost = import.meta.env.VITE_FUNCTIONS_EMULATOR_HOST || '127.0.0.1';
  const fnPort = Number(import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT || 5001);

  try {
    connectAuthEmulator(auth, authUrl, { disableWarnings: true });
  } catch (err) {
    console.debug('Auth emulator connection skipped', err);
  }

  try {
    connectFirestoreEmulator(db, fsHost, fsPort);
  } catch (err) {
    console.debug('Firestore emulator connection skipped', err);
  }

  try {
    connectFunctionsEmulator(functions, fnHost, fnPort);
  } catch (err) {
    console.debug('Functions emulator connection skipped', err);
  }
}

if (auth) {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Failed to set Firebase auth persistence', error);
  });
}

const googleProvider = auth ? new GoogleAuthProvider() : null;
const githubProvider = auth ? new GithubAuthProvider() : null;

if (googleProvider) {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}

if (githubProvider) {
  githubProvider.setCustomParameters({ allow_signup: 'false' });
}

export { app, auth, db, functions, googleProvider, githubProvider, hasFirebaseConfig };
