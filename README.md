# Lost Tales Marketplace

This repository contains an early prototype for a web application that
facilitates trading of Brandon Sanderson "Lost Tales" collectible story
cards. The project is still in the planning phase, but a simple
wireframe has been created to outline navigation and page structure.

## Getting Started

### Frontend (Vite + React)

The app lives in `frontend/`.

```bash
cd frontend
npm install
cp .env.example .env.local
# fill in VITE_FIREBASE_* values
npm run dev -- --host 127.0.0.1 --port 5174
```

### Firebase (Auth + Firestore)

This repo includes Firestore security rules in `firestore.rules` and Firebase Emulator Suite configuration in `firebase.json`.

For local multi-user testing (recommended), run the emulators and point the frontend at them:

```bash
# terminal 1
cd ..
firebase emulators:start --only auth,firestore

# terminal 2
cd frontend
npm run dev -- --mode emulator --host 127.0.0.1 --port 5174
```

Emulator UI:
- http://127.0.0.1:4000/

See `frontend/README.md` for details.

See `docs/plan.md` for a high-level plan of the pages and features considered for the minimum viable product.
