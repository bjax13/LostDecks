"use strict";

const fs = require("node:fs");
const path = require("node:path");
const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");

const SITE_URL = "https://shardstash.web.app";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;
const DEFAULT_TITLE = "ShardStash";
const DEFAULT_DESCRIPTION =
  "Track your Lost Tales Story Deck cards and ChasmFriends pins, and find collectors to trade with.";
const CACHE_CONTROL_OK = "public, max-age=900, s-maxage=300";
const CACHE_CONTROL_MISS = "public, max-age=300, s-maxage=300";
const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{8,32}$/;
const HOSTED_SHELL_TTL_MS = 60_000;

const SPA_SHELL_CANDIDATES = [
  path.join(__dirname, "static", "spa-index.html"),
  path.join(__dirname, "..", "frontend", "dist", "index.html"),
];

/** @type {string | null} */
let testBaseHtmlOverride = null;

/** @type {{ html: string | null, fetchedAt: number }} */
let hostedShellCache = { html: null, fetchedAt: 0 };

function readLocalShellFallback() {
  for (const candidate of SPA_SHELL_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      const html = fs.readFileSync(candidate, "utf8");
      if (!html.includes("/src/main.jsx")) {
        return html;
      }
    }
  }
  const fallback = SPA_SHELL_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!fallback) {
    throw new Error(
      "SPA index shell is missing. Run npm run build:frontend && npm run sync:spa-shell.",
    );
  }
  return fs.readFileSync(fallback, "utf8");
}

async function loadBaseHtmlAsync() {
  if (testBaseHtmlOverride) {
    return testBaseHtmlOverride;
  }

  const now = Date.now();
  if (hostedShellCache.html && now - hostedShellCache.fetchedAt < HOSTED_SHELL_TTL_MS) {
    return hostedShellCache.html;
  }

  try {
    const response = await fetch(`${SITE_URL}/index.html`, {
      headers: { Accept: "text/html", "Cache-Control": "no-cache" },
    });
    if (response.ok) {
      const html = await response.text();
      if (html && !html.includes("/src/main.jsx")) {
        hostedShellCache = { html, fetchedAt: now };
        return html;
      }
    }
  } catch (err) {
    console.warn("renderShareMeta: could not fetch hosted index.html", err);
  }

  return readLocalShellFallback();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

/**
 * @param {string} pathname
 * @returns {{ shareId: string, invalid: boolean }}
 */
function parseShareIdFromPath(pathname) {
  if (typeof pathname !== "string") {
    return { shareId: "", invalid: false };
  }
  const match = pathname.match(/^\/t\/([^/?#]+)/);
  if (!match) {
    return { shareId: "", invalid: false };
  }
  let decoded = "";
  try {
    decoded = decodeURIComponent(match[1]);
  } catch {
    return { shareId: "", invalid: true };
  }
  if (!SHARE_ID_PATTERN.test(decoded)) {
    return { shareId: decoded, invalid: true };
  }
  return { shareId: decoded, invalid: false };
}

function isShareActive(share) {
  if (!share || typeof share !== "object") {
    return false;
  }
  return !("revokedAt" in share);
}

function sanitizeShareForMeta(share) {
  if (!isShareActive(share)) {
    return null;
  }
  const iso = Array.isArray(share.iso) ? share.iso.filter((id) => typeof id === "string") : [];
  const uft = Array.isArray(share.uft)
    ? share.uft.filter(
        (row) =>
          row &&
          typeof row === "object" &&
          typeof row.skuId === "string" &&
          typeof row.quantity === "number",
      )
    : [];
  return { ...share, iso, uft };
}

function buildShareDescription(share) {
  const isoCount = Array.isArray(share?.iso) ? share.iso.length : 0;
  const uftCount = Array.isArray(share?.uft) ? share.uft.length : 0;
  const parts = [];
  if (isoCount > 0) {
    parts.push(`ISO: ${isoCount} item${isoCount === 1 ? "" : "s"}`);
  }
  if (uftCount > 0) {
    parts.push(`UFT: ${uftCount} item${uftCount === 1 ? "" : "s"}`);
  }
  if (parts.length === 0) {
    return "Public trade list on ShardStash.";
  }
  return `${parts.join(" · ")} — public trade list on ShardStash.`;
}

function buildShareTitle(share) {
  const name = typeof share?.displayName === "string" ? share.displayName.trim() : "";
  if (!name) {
    return "Trade list on ShardStash";
  }
  return `${name}'s trade list on ShardStash`;
}

/**
 * Replace or inject Open Graph / Twitter meta tags in the SPA shell HTML.
 * @param {string} html
 * @param {{ title: string, description: string, url: string, image?: string }} meta
 */
function injectShareMeta(html, meta) {
  const title = escapeHtml(meta.title);
  const description = escapeHtmlAttr(meta.description);
  const url = escapeHtmlAttr(meta.url);
  const image = escapeHtmlAttr(meta.image || DEFAULT_IMAGE);

  let next = html;
  next = next.replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`);
  next = next.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/,
    () => `<meta name="description" content="${description}">`,
  );
  next = next.replace(
    /<meta property="og:title" content="[^"]*"\s*\/?>/,
    () => `<meta property="og:title" content="${title}">`,
  );
  next = next.replace(
    /<meta property="og:description" content="[^"]*"\s*\/?>/,
    () => `<meta property="og:description" content="${description}">`,
  );
  next = next.replace(
    /<meta property="og:url" content="[^"]*"\s*\/?>/,
    () => `<meta property="og:url" content="${url}">`,
  );
  next = next.replace(
    /<meta property="og:image" content="[^"]*"\s*\/?>/,
    () => `<meta property="og:image" content="${image}">`,
  );
  next = next.replace(
    /<meta name="twitter:title" content="[^"]*"\s*\/?>/,
    () => `<meta name="twitter:title" content="${title}">`,
  );
  next = next.replace(
    /<meta name="twitter:description" content="[^"]*"\s*\/?>/,
    () => `<meta name="twitter:description" content="${description}">`,
  );
  next = next.replace(
    /<meta name="twitter:image" content="[^"]*"\s*\/?>/,
    () => `<meta name="twitter:image" content="${image}">`,
  );
  next = next.replace(
    /<link rel="canonical" href="[^"]*"\s*\/?>/,
    () => `<link rel="canonical" href="${url}">`,
  );
  return next;
}

function buildDefaultMeta(shareId) {
  const url = shareId ? `${SITE_URL}/t/${encodeURIComponent(shareId)}` : `${SITE_URL}/t/unknown`;
  return {
    title: shareId ? "Trade list unavailable · ShardStash" : DEFAULT_TITLE,
    description: shareId
      ? "This trade list is no longer shared on ShardStash."
      : DEFAULT_DESCRIPTION,
    url,
    image: DEFAULT_IMAGE,
  };
}

function buildMetaFromShare(share, shareId) {
  const url = `${SITE_URL}/t/${encodeURIComponent(shareId)}`;
  return {
    title: buildShareTitle(share),
    description: buildShareDescription(share),
    url,
    image: DEFAULT_IMAGE,
  };
}

async function loadShareSnapshot(shareId) {
  if (!shareId || !SHARE_ID_PATTERN.test(shareId)) {
    return null;
  }
  const db = admin.firestore();
  const snapshot = await db.collection("shares").doc(shareId).get();
  if (!snapshot.exists) {
    return null;
  }
  return sanitizeShareForMeta(snapshot.data());
}

async function renderShareMetaHtml(shareId, share) {
  const baseHtml = await loadBaseHtmlAsync();
  const activeShare = sanitizeShareForMeta(share);
  const meta = activeShare ? buildMetaFromShare(activeShare, shareId) : buildDefaultMeta(shareId);
  return injectShareMeta(baseHtml, meta);
}

function resolveShareVisibility({ shareId, invalid, share }) {
  if (invalid || !shareId) {
    return { notFound: true };
  }
  if (!share) {
    return { notFound: true };
  }
  return { notFound: false };
}

const renderShareMeta = onRequest(
  {
    maxInstances: 10,
    timeoutSeconds: 15,
  },
  async (req, res) => {
    try {
      const { shareId, invalid } = parseShareIdFromPath(req.path || req.url || "");
      if (invalid) {
        const html = await renderShareMetaHtml("", null);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", CACHE_CONTROL_MISS);
        res.status(404).send(html);
        return;
      }

      const rawShare = shareId ? await loadShareSnapshot(shareId) : null;
      const shareIdForMeta = shareId && !invalid ? shareId : "";
      const { notFound } = resolveShareVisibility({
        shareId: shareIdForMeta,
        invalid,
        share: rawShare,
      });
      const html = await renderShareMetaHtml(shareIdForMeta, rawShare);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", notFound ? CACHE_CONTROL_MISS : CACHE_CONTROL_OK);
      res.status(notFound ? 404 : 200).send(html);
    } catch (err) {
      console.error("renderShareMeta failed", err);
      const { shareId } = parseShareIdFromPath(req.path || req.url || "");
      try {
        const html = await renderShareMetaHtml(shareId || "", null);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.status(404).send(html);
      } catch (innerErr) {
        console.error("renderShareMeta fallback failed", innerErr);
        res.status(500).send("Internal error");
      }
    }
  },
);

module.exports = {
  renderShareMeta,
  escapeHtml,
  escapeHtmlAttr,
  injectShareMeta,
  parseShareIdFromPath,
  buildShareDescription,
  buildShareTitle,
  buildDefaultMeta,
  buildMetaFromShare,
  renderShareMetaHtml,
  isShareActive,
  __test: {
    escapeHtml,
    escapeHtmlAttr,
    injectShareMeta,
    parseShareIdFromPath,
    buildShareDescription,
    buildShareTitle,
    buildDefaultMeta,
    buildMetaFromShare,
    renderShareMetaHtml,
    loadBaseHtmlAsync,
    resetHostedShellCache() {
      hostedShellCache = { html: null, fetchedAt: 0 };
    },
    setBaseHtmlForTests(html) {
      testBaseHtmlOverride = html;
    },
    resetBaseHtmlCache() {
      testBaseHtmlOverride = null;
      hostedShellCache = { html: null, fetchedAt: 0 };
    },
    setHostedShellFetchForTests(fetchImpl) {
      module.exports.__test._fetchOverride = fetchImpl;
    },
    getFetchForTests() {
      return module.exports.__test._fetchOverride || globalThis.fetch;
    },
  },
};
