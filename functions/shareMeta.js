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
const CACHE_CONTROL = "public, max-age=900, s-maxage=1800";

const SPA_INDEX_PATH = path.join(__dirname, "static", "spa-index.html");

/** @type {string | null} */
let cachedBaseHtml = null;

function loadBaseHtml() {
  if (cachedBaseHtml) {
    return cachedBaseHtml;
  }
  cachedBaseHtml = fs.readFileSync(SPA_INDEX_PATH, "utf8");
  return cachedBaseHtml;
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

function parseShareIdFromPath(pathname) {
  if (typeof pathname !== "string") {
    return "";
  }
  const match = pathname.match(/^\/t\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
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
  next = next.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  next = next.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${description}">`,
  );
  next = next.replace(
    /<meta property="og:title" content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${title}">`,
  );
  next = next.replace(
    /<meta property="og:description" content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${description}">`,
  );
  next = next.replace(
    /<meta property="og:url" content="[^"]*"\s*\/?>/,
    `<meta property="og:url" content="${url}">`,
  );
  next = next.replace(
    /<meta property="og:image" content="[^"]*"\s*\/?>/,
    `<meta property="og:image" content="${image}">`,
  );
  next = next.replace(
    /<meta name="twitter:title" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:title" content="${title}">`,
  );
  next = next.replace(
    /<meta name="twitter:description" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${description}">`,
  );
  next = next.replace(
    /<meta name="twitter:image" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:image" content="${image}">`,
  );
  next = next.replace(
    /<link rel="canonical" href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${url}">`,
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
  if (!shareId) {
    return null;
  }
  const db = admin.firestore();
  const snapshot = await db.collection("shares").doc(shareId).get();
  if (!snapshot.exists) {
    return null;
  }
  return snapshot.data();
}

function renderShareMetaHtml(shareId, share) {
  const baseHtml = loadBaseHtml();
  const meta = share ? buildMetaFromShare(share, shareId) : buildDefaultMeta(shareId);
  return injectShareMeta(baseHtml, meta);
}

const renderShareMeta = onRequest(
  {
    maxInstances: 10,
    timeoutSeconds: 15,
  },
  async (req, res) => {
    try {
      const shareId = parseShareIdFromPath(req.path || req.url || "");
      const share = shareId ? await loadShareSnapshot(shareId) : null;
      const html = renderShareMetaHtml(shareId, share);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", CACHE_CONTROL);
      res.status(200).send(html);
    } catch (err) {
      console.error("renderShareMeta failed", err);
      const shareId = parseShareIdFromPath(req.path || req.url || "");
      const html = renderShareMetaHtml(shareId, null);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.status(200).send(html);
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
    setBaseHtmlForTests(html) {
      cachedBaseHtml = html;
    },
    resetBaseHtmlCache() {
      cachedBaseHtml = null;
    },
  },
};
