# Lost Tales Marketplace Frontend

This Vite-powered React application implements the Lost Tales Marketplace experience, including Firebase Authentication scaffolding for managing user sessions and protecting collection-oriented routes.

## Prerequisites

- Node.js 18+
- npm 9+
- A Firebase project with Email/Password, Google, and GitHub authentication providers configured.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and populate it with your Firebase project credentials:

   ```bash
   cp .env.example .env.local
   ```

3. Start the development server:

   ```bash
   npm run dev -- --host 127.0.0.1 --port 5174
   ```

## Local multi-user testing (Firebase Emulator Suite)

This project supports running against local Firebase emulators (Auth + Firestore). This is the recommended setup for testing multi-user flows like offers/acceptance.

1. Start emulators from the repo root:

   ```bash
   firebase emulators:start --only auth,firestore
   ```

2. Start the frontend in emulator mode:

   ```bash
   npm run dev -- --mode emulator --host 127.0.0.1 --port 5174
   ```

3. Create test users:

- Use two browser profiles/contexts (regular + incognito) and sign up as different users.
- Confirm users exist in Emulator UI: http://127.0.0.1:4000/auth

### Emulator env vars

Vite loads `.env.emulator.local` automatically when you run with `--mode emulator`.

See `.env.emulator.example` for the values.

## Authentication Features

- Centralized `AuthProvider` context wraps the app and exposes helpers for login, registration, password reset, and social sign-in.
- Dedicated pages for login, registration, and password resets with graceful error handling.
- `AuthGuard` component and utility hooks (`useRequireAuth`, `useAuthGuard`) for protecting authenticated routes.
- Modal-based quick sign-in experience with email/password and social login shortcuts.

## Protected Routes

The following routes require authentication and automatically redirect unauthenticated visitors to the `/auth/login` page:

- `/collections`
- `/offers`
- `/account`

Additional collection management, offers, and account customization features can be layered on top of these protected shells.
