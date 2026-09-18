const DEFAULT_PUBLIC_AUTH_DOMAIN = "shardstash.web.app";

function hostFromPublicUrl(publicUrl) {
  if (typeof publicUrl !== "string" || !publicUrl.trim()) {
    return "";
  }

  try {
    return new URL(publicUrl).hostname;
  } catch {
    return "";
  }
}

function resolveProductionAuthDomain({ publicHost, env = process.env } = {}) {
  const override = String(env.FIREBASE_AUTH_DOMAIN || "").trim();
  if (override) {
    return override;
  }

  const host = String(publicHost || "").trim();
  return host || DEFAULT_PUBLIC_AUTH_DOMAIN;
}

module.exports = {
  DEFAULT_PUBLIC_AUTH_DOMAIN,
  hostFromPublicUrl,
  resolveProductionAuthDomain,
};
