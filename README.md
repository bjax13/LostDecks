# Lost Tales Marketplace

This repository contains an early prototype for a web application that
facilitates trading of Brandon Sanderson "Lost Tales" collectible story
cards. The project is still in the planning phase, but a simple
wireframe has been created to outline navigation and page structure.

## Getting Started

### Frontend (Vite + React)

The `frontend` directory contains a Vite-powered React application.

```bash
cd frontend
npm install
npm run dev
```

#### Firebase configuration

The frontend expects Firebase configuration via Vite environment variables.
Copy `frontend/.env.example` to `frontend/.env` and fill in your Firebase
project credentials:

```bash
cd frontend
cp .env.example .env
```

> Note: The app can still render without Firebase configured, but auth-related
> features will be unavailable.

### Planning docs

See `docs/plan.md` for a high-level plan of the pages and features considered
for the minimum viable product.
