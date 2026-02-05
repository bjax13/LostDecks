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

2. Copy `.env.example` to `.env` and populate it with your Firebase project credentials:

   ```bash
   cp .env.example .env
   ```

   Required variables (see `src/lib/firebase.js`):

   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`

3. Start the development server:

   ```bash
   npm run dev
   ```

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
