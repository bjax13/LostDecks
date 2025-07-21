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

| Page             | Description                                                  |
|------------------|--------------------------------------------------------------|
| **Home**         | Landing page with brief introduction and navigation links.   |
| **Cards**        | Browse all cards and see current bids/asks.                  |
| **Market Maker** | Form to create an offer to sell a card or request a bounty.  |
| **Market Taker** | View existing offers and accept one.                         |
| **Not Found**    | Fallback page for unknown routes.                            |

### Future Ideas

- User accounts with login and portfolio tracking
- Search and filtering of cards
- Transaction history
- Admin features for curating cards and offers

## Wireframe Prototype

The `frontend` directory contains a very simple wireframe built with
React (via CDN). It demonstrates basic navigation between the pages
listed above using React Router. The wireframe is purely for planning
purposes and does not persist any data.

To preview the prototype, open `frontend/index.html` in a browser with
internet access.
