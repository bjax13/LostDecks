/**
 * Non-MCP smoke test: exercise tools without stdio transport.
 * Run: npm run smoke
 */
import { catalogStats, searchCatalog } from "./catalog.js";
import { getCollection, getMatches, getMode, setQuantity } from "./store.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const stats = catalogStats();
assert(stats.collectibleCount > 200, `expected catalog size, got ${stats.collectibleCount}`);
assert(stats.skuCount > 400, `expected sku count, got ${stats.skuCount}`);

const search = searchCatalog({ query: "els", limit: 5 });
assert(search.results.length > 0, "search_catalog should find els");
assert(search.results[0].skuIds?.length > 0, "results should include skuIds");

const before = await getCollection({});
assert(before.mode === getMode(), "collection mode should match server mode");
assert(before.bySkuId["LT24-ELS-01-DUN"] === 2, "stub seed qty for ELS-01");

const updated = await setQuantity({ skuId: "LT24-ELS-01-DUN", quantity: 3 });
assert(updated.quantity === 3, "set_quantity should set absolute qty");

const after = await getCollection({});
assert(after.bySkuId["LT24-ELS-01-DUN"] === 3, "get_collection should reflect set");

await setQuantity({ skuId: "LT24-ELS-01-DUN", quantity: 2 });

const matches = await getMatches({ pageSize: 10 });
assert(
  Array.isArray(matches.matches) && matches.matches.length >= 1,
  "get_matches should return rows",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: getMode(),
      catalog: stats,
      sampleSearch: search.results[0],
      matchCount: matches.matches.length,
    },
    null,
    2,
  ),
);
