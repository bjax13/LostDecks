import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export const POST_AUTH_HOME = "/";

const AUTH_PATH = /^\/auth(\/|$)/;
const IN_APP_ORIGIN = "https://shardstash.invalid";

export function sanitizeInAppPath(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return null;
  }

  let url;
  try {
    url = new URL(trimmed, IN_APP_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== IN_APP_ORIGIN || url.username || url.password) {
    return null;
  }
  if (AUTH_PATH.test(url.pathname)) {
    return null;
  }

  const normalized = `${url.pathname}${url.search}${url.hash}`;
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return null;
  }
  return normalized;
}

function pathFromLocationLike(from) {
  if (typeof from === "string") {
    return from;
  }
  if (from && typeof from.pathname === "string") {
    return `${from.pathname}${from.search || ""}${from.hash || ""}`;
  }
  return null;
}

export function resolvePostAuthPath(location, defaultPath = POST_AUTH_HOME) {
  const redirectParam = new URLSearchParams(location?.search ?? "").get("redirect");
  const fromQuery = sanitizeInAppPath(redirectParam);
  if (fromQuery) {
    return fromQuery;
  }

  const fromState = sanitizeInAppPath(pathFromLocationLike(location?.state?.from));
  if (fromState) {
    return fromState;
  }

  return defaultPath;
}

export function usePostAuthRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    navigate(resolvePostAuthPath(location), { replace: true });
  }, [location, navigate]);
}
