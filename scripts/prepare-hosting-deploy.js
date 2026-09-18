const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const npxCmd = isWindows ? "npx.cmd" : "npx";

const DEFAULT_PROJECT_ID = "storydeck-16";
const HOSTING_TARGET = "shardstash";
const SITE_CANDIDATES = ["shardstash", "shard-stash", "shardstash-app"];
const FIREBASE_TOOLS = "firebase-tools@15";
const AUTH_CONFIG_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

function publicUrlForSite(siteId) {
  return `https://${siteId}.web.app`;
}

function authorizedDomainsForSite(siteId) {
  return [`${siteId}.web.app`, `${siteId}.firebaseapp.com`];
}

function extractSiteIds(payload) {
  let sites = [];
  if (Array.isArray(payload)) {
    sites = payload;
  } else if (Array.isArray(payload?.result)) {
    sites = payload.result;
  } else if (Array.isArray(payload?.result?.sites)) {
    sites = payload.result.sites;
  } else if (Array.isArray(payload?.sites)) {
    sites = payload.sites;
  }

  return sites
    .map((site) => {
      if (typeof site === "string") {
        return site;
      }
      if (typeof site?.siteId === "string" && site.siteId.trim()) {
        return site.siteId.trim();
      }
      if (typeof site?.name === "string" && site.name.trim()) {
        const parts = site.name.split("/").filter(Boolean);
        return parts[parts.length - 1] || "";
      }
      return "";
    })
    .filter(Boolean);
}

function pickExistingSite(siteIds, candidates = SITE_CANDIDATES) {
  const known = new Set(siteIds);
  return candidates.find((id) => known.has(id)) || null;
}

function mergeAuthorizedDomains(existing = [], required = []) {
  const seen = new Set();
  const domains = [];
  for (const value of [...existing, ...required]) {
    const domain = String(value || "").trim();
    if (!domain || seen.has(domain)) {
      continue;
    }
    seen.add(domain);
    domains.push(domain);
  }
  const existingSet = new Set(existing.map((value) => String(value || "").trim()).filter(Boolean));
  const added = required
    .map((value) => String(value || "").trim())
    .filter((domain) => domain && !existingSet.has(domain));
  return { domains, added };
}

function isCreateConflict(status, stdout, stderr) {
  if (status === 0) {
    return false;
  }
  const text = `${stdout}\n${stderr}`.toLowerCase();
  return (
    text.includes("http error: 409") ||
    text.includes('"code": 409') ||
    text.includes("already exists") ||
    text.includes("already in use") ||
    text.includes("site id is taken") ||
    text.includes("site id is unavailable")
  );
}

function authorizedDomainConsoleFallback(projectId, domains) {
  const lines = [
    "Could not add Auth authorized domains automatically.",
    "Add them in the Firebase console:",
    `1. Open https://console.firebase.google.com/project/${projectId}/authentication/settings`,
    "2. Stay on the Settings tab.",
    "3. Find Authorized domains and click Add domain.",
  ];
  domains.forEach((domain, index) => {
    lines.push(`${index + 4}. Enter ${domain} and save.`);
  });
  lines.push(
    `${domains.length + 4}. Google sign-in on the new host will fail until these domains are listed.`,
  );
  lines.push(
    "If automation returned 403, grant the GitHub Actions service account Identity Toolkit Admin (roles/identitytoolkit.admin) or Editor on project storydeck-16, then re-run Front end only deploy.",
  );
  return lines.join("\n");
}

function runCapture(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWindows,
  });

  return {
    status: result.error ? 1 : (result.status ?? 1),
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function parseJsonFromOutput(output, context) {
  const firstBrace = output.indexOf("{");
  const firstBracket = output.indexOf("[");
  let start = -1;
  let end = -1;
  let closer = "}";

  if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) {
    start = firstBrace;
    closer = "}";
    end = output.lastIndexOf("}");
  } else if (firstBracket >= 0) {
    start = firstBracket;
    closer = "]";
    end = output.lastIndexOf("]");
  }

  if (start < 0 || end < start) {
    throw new Error(`Could not parse JSON from ${context} output.`);
  }

  if (closer === "}" && output[end] !== "}") {
    throw new Error(`Could not parse JSON from ${context} output.`);
  }

  return JSON.parse(output.slice(start, end + 1));
}

function runFirebase(args) {
  return runCapture(npxCmd, ["--yes", FIREBASE_TOOLS, ...args]);
}

function listSiteIds(projectId) {
  const result = runFirebase([
    "hosting:sites:list",
    "--project",
    projectId,
    "--non-interactive",
    "--json",
  ]);

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    throw new Error(`Failed to list Firebase Hosting sites for project ${projectId}.`);
  }

  const payload = parseJsonFromOutput(`${result.stdout}\n${result.stderr}`, "hosting:sites:list");
  return extractSiteIds(payload);
}

function createHostingSite(projectId, siteId) {
  const result = runFirebase([
    "hosting:sites:create",
    siteId,
    "--project",
    projectId,
    "--non-interactive",
    "--json",
  ]);
  return {
    ok: result.status === 0,
    conflict: isCreateConflict(result.status, result.stdout, result.stderr),
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function applyHostingTarget(projectId, siteId) {
  const result = runFirebase([
    "target:apply",
    "hosting",
    HOSTING_TARGET,
    siteId,
    "--project",
    projectId,
    "--non-interactive",
  ]);

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    throw new Error(`Failed to apply hosting target ${HOSTING_TARGET} to site ${siteId}.`);
  }
}

function readServiceAccountCredentials() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    process.env.GOOGLE_GHA_CREDS_PATH,
    process.env.CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE,
  ].filter((value) => typeof value === "string" && value.trim());

  for (const credsPath of candidates) {
    if (!fs.existsSync(credsPath)) {
      continue;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(credsPath, "utf8"));
      if (parsed.client_email && parsed.private_key) {
        return parsed;
      }
    } catch {
      // Try the next well-known credential path.
    }
  }

  return null;
}

function signServiceAccountJwt(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: credentials.client_email,
      scope: AUTH_CONFIG_SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(credentials.private_key).toString("base64url");
  return `${unsigned}.${signature}`;
}

async function getAccessTokenFromServiceAccount(credentials) {
  const assertion = signServiceAccountJwt(credentials);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.access_token !== "string") {
    throw new Error(
      `Service account token request failed (${response.status}): ${payload.error || "unknown error"}`,
    );
  }
  return payload.access_token;
}

async function getAccessToken() {
  const gcloud = runCapture("gcloud", ["auth", "print-access-token"]);
  if (gcloud.status === 0) {
    const token = gcloud.stdout.trim().split(/\s+/)[0];
    if (token) {
      return token;
    }
  }

  const credentials = readServiceAccountCredentials();
  if (!credentials) {
    return null;
  }

  return getAccessTokenFromServiceAccount(credentials);
}

async function identityToolkitRequest(accessToken, method, url, body) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

async function ensureAuthorizedDomains(projectId, siteId) {
  const required = authorizedDomainsForSite(siteId);
  const fallback = authorizedDomainConsoleFallback(projectId, required);

  let accessToken;
  try {
    accessToken = await getAccessToken();
  } catch (error) {
    console.warn(fallback);
    console.warn(error.message);
    return { ok: false, added: required };
  }

  if (!accessToken) {
    console.warn(fallback);
    console.warn(
      "No gcloud token or GOOGLE_APPLICATION_CREDENTIALS service account was available.",
    );
    return { ok: false, added: required };
  }

  const configUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;
  const current = await identityToolkitRequest(accessToken, "GET", configUrl);
  if (!current.ok) {
    console.warn(fallback);
    console.warn(
      `GET Identity Toolkit config failed (${current.status}): ${JSON.stringify(current.payload)}`,
    );
    return { ok: false, added: required };
  }

  const existing = Array.isArray(current.payload.authorizedDomains)
    ? current.payload.authorizedDomains
    : [];
  const merged = mergeAuthorizedDomains(existing, required);
  if (merged.added.length === 0) {
    console.log(`Auth authorized domains already include: ${required.join(", ")}`);
    return { ok: true, added: [] };
  }

  const patchUrl = `${configUrl}?updateMask=authorizedDomains`;
  const patched = await identityToolkitRequest(accessToken, "PATCH", patchUrl, {
    authorizedDomains: merged.domains,
  });
  if (!patched.ok) {
    console.warn(fallback);
    console.warn(
      `PATCH Identity Toolkit authorizedDomains failed (${patched.status}): ${JSON.stringify(patched.payload)}`,
    );
    return { ok: false, added: merged.added };
  }

  console.log(`Added Auth authorized domains: ${merged.added.join(", ")}`);
  return { ok: true, added: merged.added };
}

function ensureHostingSite(projectId) {
  let siteIds = listSiteIds(projectId);
  const existing = pickExistingSite(siteIds);
  if (existing) {
    console.log(`Using existing Hosting site ${existing} (${publicUrlForSite(existing)}).`);
    applyHostingTarget(projectId, existing);
    return { siteId: existing, created: false };
  }

  for (const candidate of SITE_CANDIDATES) {
    console.log(`Creating Hosting site ${candidate} in project ${projectId}...`);
    const created = createHostingSite(projectId, candidate);
    if (created.ok) {
      console.log(`Created Hosting site ${candidate} (${publicUrlForSite(candidate)}).`);
      applyHostingTarget(projectId, candidate);
      return { siteId: candidate, created: true };
    }

    siteIds = listSiteIds(projectId);
    if (siteIds.includes(candidate)) {
      console.log(`Hosting site ${candidate} already exists in this project. Reusing it.`);
      applyHostingTarget(projectId, candidate);
      return { siteId: candidate, created: false };
    }

    if (created.conflict) {
      console.warn(
        `Hosting site id ${candidate} is unavailable globally. Trying the next candidate.`,
      );
      continue;
    }

    process.stderr.write(created.stderr || created.stdout);
    throw new Error(`Failed to create Hosting site ${candidate}.`);
  }

  throw new Error(
    `Could not create a Hosting site. Tried: ${SITE_CANDIDATES.join(", ")}. The default storydeck-16 site was left unchanged.`,
  );
}

async function prepareHostingDeploy(options = {}) {
  const projectId = options.projectId || process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
  const { siteId, created } = ensureHostingSite(projectId);
  if (siteId !== SITE_CANDIDATES[0]) {
    console.warn(
      `Primary site id shardstash was unavailable. Deploying to ${siteId} at ${publicUrlForSite(siteId)}. Update .firebaserc if this fallback should be permanent.`,
    );
  }
  const auth = await ensureAuthorizedDomains(projectId, siteId);
  return {
    projectId,
    siteId,
    created,
    publicUrl: publicUrlForSite(siteId),
    authorizedDomains: authorizedDomainsForSite(siteId),
    authorizedDomainsOk: auth.ok,
  };
}

module.exports = {
  HOSTING_TARGET,
  SITE_CANDIDATES,
  authorizedDomainConsoleFallback,
  authorizedDomainsForSite,
  extractSiteIds,
  isCreateConflict,
  mergeAuthorizedDomains,
  pickExistingSite,
  prepareHostingDeploy,
  publicUrlForSite,
};

if (require.main === module) {
  prepareHostingDeploy()
    .then((result) => {
      console.log(
        `Hosting target ${HOSTING_TARGET} -> site ${result.siteId} (${result.publicUrl}).`,
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
