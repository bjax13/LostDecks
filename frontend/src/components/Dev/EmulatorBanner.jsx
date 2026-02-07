import './EmulatorBanner.css';

function envBool(value) {
  return String(value || '').toLowerCase() === 'true';
}

export default function EmulatorBanner() {
  const enabled = envBool(import.meta.env.VITE_USE_EMULATORS);
  if (!enabled) return null;

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'unknown-project';
  const authUrl = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099';
  const fsHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
  const fsPort = import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || '8080';
  const fnHost = import.meta.env.VITE_FUNCTIONS_EMULATOR_HOST || '127.0.0.1';
  const fnPort = import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT || '5001';

  return (
    <aside className="emulator-banner" role="status">
      <div className="emulator-banner__pill">EMULATORS</div>
      <div className="emulator-banner__text">
        <strong>{projectId}</strong>
        <span className="emulator-banner__sep">·</span>
        Auth: {authUrl}
        <span className="emulator-banner__sep">·</span>
        Firestore: {fsHost}:{fsPort}
        <span className="emulator-banner__sep">·</span>
        Functions: {fnHost}:{fnPort}
      </div>
    </aside>
  );
}
