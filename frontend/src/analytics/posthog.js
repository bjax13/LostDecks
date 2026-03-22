import posthog from "posthog-js";

const key = import.meta.env.VITE_POSTHOG_KEY?.trim() ?? "";
const host = import.meta.env.VITE_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";

let initialized = false;

export function initPostHog() {
  if (initialized || !key) {
    return;
  }

  posthog.init(key, {
    api_host: host,
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "identified_only",
  });
  initialized = true;
}

export function capturePostHogPageView() {
  if (!initialized) {
    return;
  }
  posthog.capture("$pageview", {
    $current_url: window.location.href,
  });
}

export function syncPostHogUser(firebaseUser) {
  if (!initialized) {
    return;
  }
  if (firebaseUser?.uid) {
    posthog.identify(firebaseUser.uid, {
      email: firebaseUser.email ?? undefined,
      name: firebaseUser.displayName ?? undefined,
    });
  } else {
    posthog.reset();
  }
}
