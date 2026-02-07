// Back-compat shim.
// The project already uses src/lib/firebase.js as the canonical Firebase setup
// (Auth + Firestore + providers). Prefer importing from that module.

export * from './lib/firebase';
