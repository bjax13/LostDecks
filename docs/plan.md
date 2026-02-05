# Lost Tales Marketplace Plan

This document outlines a very early roadmap for a simple web application that allows
users to trade Brandon Sanderson "Lost Tales" collectible story cards.

## Goals

- Minimum viable product (MVP)
  - View a list of available cards
  - Market makers can create an offer to sell a card or place a bounty
  - Market takers can accept an existing offer
  - Focus on a straightforward interface with minimal friction

## Page Overview

The UI is evolving, but at a high level the experience includes:

| Page / Area       | Description                                                  |
|-------------------|--------------------------------------------------------------|
| **Home**          | Landing page with brief introduction and navigation links.   |
| **Cards**         | Browse cards and (eventually) see current bids/asks.         |
| **Auth**          | Login / registration / password reset flows.                 |
| **Collections**   | Authenticated area for managing a user collection.           |
| **Offers**        | Authenticated area for viewing/creating offers.              |
| **Account**       | Authenticated account settings/profile area.                 |
| **Not Found**     | Fallback page for unknown routes.                            |

> Note: Some authenticated areas may currently be placeholders/shells.

### Future Ideas

- Flesh out cards browsing (search/filtering, bids/asks display)
- Trading workflow (offers + bounties + accept/fulfill)
- User portfolios and transaction history
- Admin features for curating cards and offers

## Frontend Prototype

The `frontend` directory contains a Vite + React application that demonstrates
navigation and scaffolding (including Firebase Authentication helpers and route
guards).

For local development instructions, see the root `README.md` and `frontend/README.md`.
