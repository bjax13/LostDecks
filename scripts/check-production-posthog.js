/**
 * Fetches the live production Hosting bundle and asserts a non-empty PostHog
 * project key (phc_…) is baked into the built JS (VITE_POSTHOG_KEY at build time).
 */

const CANONICAL_PRODUCTION_ORIGIN = "https://shardstash.web.app";

/** PostHog browser project API keys begin with phc_ */
const POSTHOG_KEY_PATTERN = /phc_[A-Za-z0-9_-]{10,}/;

function maskPostHogKey(key) {
  if (!key || key.length < 12) {
    return "phc_…";
  }
  return `${key.slice(0, 8)}…`;
}

function parseModuleScriptSrcs(html, origin) {
  const base = origin.replace(/\/$/, "");
  const srcs = [];
  const scriptTagPattern = /<script[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  for (
    let match = scriptTagPattern.exec(html);
    match !== null;
    match = scriptTagPattern.exec(html)
  ) {
    const raw = match[1];
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      srcs.push(raw);
    } else if (raw.startsWith("/")) {
      srcs.push(`${base}${raw}`);
    } else {
      srcs.push(new URL(raw, `${base}/`).href);
    }
  }
  return srcs;
}

function findPostHogProjectKey(text) {
  if (!text || typeof text !== "string") {
    return null;
  }
  const match = text.match(POSTHOG_KEY_PATTERN);
  return match ? match[0] : null;
}

function assertPostHogKeyInAssets({ html, scriptsByUrl, origin }) {
  let key = findPostHogProjectKey(html);
  let source = "index.html";

  if (!key) {
    const scriptUrls = parseModuleScriptSrcs(html, origin);
    for (const url of scriptUrls) {
      const body = scriptsByUrl[url];
      if (body == null) {
        continue;
      }
      key = findPostHogProjectKey(body);
      if (key) {
        source = url;
        break;
      }
    }
  }

  if (!key) {
    throw new Error(
      `PostHog project key (phc_…) not found in the live frontend bundle at ${origin}. ` +
        "Production deploys must export VITE_POSTHOG_KEY into the Vite build (see deploy-frontend.yml, deploy-firebase.yml, and AGENTS.md).",
    );
  }

  return { key, source };
}

async function fetchText(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  return response.text();
}

async function checkProductionOrigin(origin, fetchImpl = fetch) {
  const normalized = origin.replace(/\/$/, "");
  const html = await fetchText(`${normalized}/`, fetchImpl);
  const scriptUrls = parseModuleScriptSrcs(html, normalized);
  const scriptsByUrl = {};
  for (const url of scriptUrls) {
    scriptsByUrl[url] = await fetchText(url, fetchImpl);
  }
  const { key, source } = assertPostHogKeyInAssets({
    html,
    scriptsByUrl,
    origin: normalized,
  });
  return { origin: normalized, maskedKey: maskPostHogKey(key), source };
}

function resolveOrigins() {
  const fromEnv = process.env.POSTHOG_CHECK_ORIGINS?.trim();
  if (fromEnv) {
    return fromEnv
      .split(",")
      .map((segment) => segment.trim())
      .filter(Boolean);
  }
  return [CANONICAL_PRODUCTION_ORIGIN];
}

async function main() {
  const origins = resolveOrigins();
  let exitCode = 0;

  for (const origin of origins) {
    try {
      const result = await checkProductionOrigin(origin);
      console.log(
        `PASS ${result.origin}: PostHog key present in bundle (${result.maskedKey}; source: ${result.source})`,
      );
    } catch (err) {
      console.error(`FAIL ${origin}: ${err.message}`);
      exitCode = 1;
    }
  }

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
  console.log("Production PostHog bundle check succeeded.");
}

module.exports = {
  CANONICAL_PRODUCTION_ORIGIN,
  maskPostHogKey,
  parseModuleScriptSrcs,
  findPostHogProjectKey,
  assertPostHogKeyInAssets,
  checkProductionOrigin,
  resolveOrigins,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(`FAIL: ${err.message}`);
    process.exit(1);
  });
}
