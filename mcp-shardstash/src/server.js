#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { catalogStats, searchCatalog } from "./catalog.js";
import { getCollection, getMatches, getMode, setQuantity } from "./store.js";

const server = new McpServer({
  name: "mcp-shardstash",
  version: "0.1.0",
});

function jsonText(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

server.tool(
  "search_catalog",
  "Search Lost Tales / pin catalog by substring (id, story, display name). Token-efficient: returns compact rows.",
  {
    query: z.string().describe("Substring to match against catalog search tokens"),
    category: z
      .enum(["story", "herald", "nonsense", "pin"])
      .optional()
      .describe("Optional category filter"),
    limit: z.number().int().min(1).max(25).optional().describe("Max results (default 10, max 25)"),
  },
  async ({ query, category, limit }) => jsonText(searchCatalog({ query, category, limit })),
);

server.tool(
  "get_collection",
  "Get owned SKU quantities for the acting collector (stub or emulator).",
  {
    uid: z.string().optional().describe("Optional owner uid; defaults to SHARDSTASH_MCP_UID"),
  },
  async ({ uid }) => jsonText(await getCollection({ uid })),
);

server.tool(
  "set_quantity",
  "Set absolute quantity for one SKU. quantity 0 deletes the entry. Validates skuId against catalog.",
  {
    skuId: z.string().describe("Catalog SKU id, e.g. LT24-ELS-01-DUN"),
    quantity: z.number().int().min(0).describe("Absolute owned quantity; 0 deletes"),
    uid: z.string().optional().describe("Optional owner uid; defaults to SHARDSTASH_MCP_UID"),
  },
  async ({ skuId, quantity, uid }) => jsonText(await setQuantity({ skuId, quantity, uid })),
);

server.tool(
  "get_matches",
  "Get trade matches for the acting collector. Stub mode returns synthetic lanes; emulator wiring is TODO.",
  {
    pageSize: z.number().int().min(1).max(50).optional(),
    cursor: z.string().nullable().optional(),
    uid: z.string().optional(),
  },
  async ({ pageSize, cursor, uid }) => jsonText(await getMatches({ pageSize, cursor, uid })),
);

server.tool("server_info", "PoC diagnostics: mode, catalog size, default uid.", {}, async () =>
  jsonText({
    mode: getMode(),
    catalog: catalogStats(),
    defaultUid: process.env.SHARDSTASH_MCP_UID || "poc-collector-one",
    plan: "docs/grok-bot-mcp-plan.md (project store) / mcp-shardstash/README.md",
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
