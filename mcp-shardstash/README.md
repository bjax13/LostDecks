# mcp-shardstash (PoC)

Minimal **MCP** server so a Grok / Cursor bot can use ShardStash without scraping the SPA.

This is a **shape proof**, not a production product. Default mode uses **stub collection/matches** plus a **real catalog search** over the bundled Lost Tales JSON.

See the project plan: `docs/grok-bot-mcp-plan.md` (Cursor Project store) for auth options and open decisions.

## Tools

| Tool | Behavior |
|------|----------|
| `search_catalog` | Real substring search on `frontend/src/storyData/*.json` |
| `get_collection` | Stub bag (or Firestore emulator Admin when `SHARDSTASH_MCP_MODE=emulator`) |
| `set_quantity` | Absolute qty set / delete-at-0 (stub or emulator) |
| `get_matches` | Stub mutual-trade payload (emulator callable wiring = TODO) |
| `server_info` | Mode + catalog counts |

## Quick start (stub, no Firebase)

```bash
cd mcp-shardstash
npm install
npm run smoke          # verifies tools without MCP transport
npm start              # stdio MCP server (for Cursor / MCP clients)
```

## Connect from Cursor

Add to your Cursor MCP config (path varies by Cursor version; often `~/.cursor/mcp.json` or project `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "shardstash": {
      "command": "node",
      "args": ["/absolute/path/to/LostDecks/mcp-shardstash/src/server.js"],
      "env": {
        "SHARDSTASH_MCP_MODE": "stub",
        "SHARDSTASH_MCP_UID": "poc-collector-one"
      }
    }
  }
}
```

Restart MCP / Cursor, then ask the agent to call `search_catalog` with query `els`, then `get_collection` / `set_quantity` / `get_matches`.

## Connect from a Grok-style bot

Any MCP client that can spawn a **stdio** server works the same way:

1. Install deps in `mcp-shardstash/`.
2. Spawn `node src/server.js` with the env above.
3. Advertise the four Phase-1 tools; keep tool results JSON-small (already compact).

Remote HTTP MCP hosting is out of scope for this PoC.

## Optional: emulator mode

```bash
# terminal 1 — repo root
firebase emulators:start --project storydeck-16
# or: npx firebase-tools emulators:start --project storydeck-16

# terminal 2 — seed collectors
npm run seed:local

# MCP
cd mcp-shardstash
SHARDSTASH_MCP_MODE=emulator \
SHARDSTASH_MCP_UID=<seed-user-uid> \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
npm start
```

`get_collection` / `set_quantity` use Admin SDK against the Firestore emulator.  
`get_matches` still returns a stub payload until the Functions callable (or in-process `matches.js`) is wired — see TODO in `src/store.js`.

## Design notes

- **Why MCP:** Cursor/Grok already speak it; maps cleanly to agent tool turns.
- **Why not SPA scrape:** Fragile, token-heavy, fights Auth/UI.
- **Why not full REST yet:** Product has one match callable + client Firestore; MCP adapts those sources without inventing a public API.
- **Catalog path:** Reads sibling `frontend/src/storyData/` (not copied into this package).

## Out of scope

Production auth, App Check, remote hosting, preferences tools, CLI reuse, launch-prep PR stack changes.
