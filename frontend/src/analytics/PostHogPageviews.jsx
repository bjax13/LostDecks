import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { capturePostHogPageView } from "./posthog.js";

/**
 * Sends a $pageview on initial load and on client-side route changes (SPA).
 */
export function PostHogPageviews() {
  const location = useLocation();

  // biome-ignore lint/correctness/useExhaustiveDependencies: capture uses window.location; effect must run on client-side navigations
  useEffect(() => {
    capturePostHogPageView();
  }, [location.pathname, location.search]);

  return null;
}
