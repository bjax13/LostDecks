import posthog, { DisplaySurveyType } from "posthog-js";

const key = import.meta.env.VITE_POSTHOG_KEY?.trim() ?? "";
const host = import.meta.env.VITE_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";
const feedbackSurveyId = import.meta.env.VITE_POSTHOG_SURVEY_ID?.trim() ?? "";

const POSTHOG_UID_KEY = "shardstash.posthogUid";

let initialized = false;

function readStoredPostHogUid() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    return window.localStorage.getItem(POSTHOG_UID_KEY);
  } catch {
    return null;
  }
}

function writeStoredPostHogUid(uid) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(POSTHOG_UID_KEY, uid);
  } catch {
    // Ignore quota / private-mode failures; identify still runs.
  }
}

function clearStoredPostHogUid() {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(POSTHOG_UID_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function isPostHogConfigured() {
  return Boolean(key);
}

export function getPostHogFeedbackSurveyId() {
  return feedbackSurveyId;
}

export function initPostHog() {
  if (initialized || !key) {
    return;
  }

  posthog.init(key, {
    api_host: host,
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "identified_only",
    // Custom FAB triggers surveys; do not show PostHog's automatic survey chrome.
    disable_surveys_automatic_display: true,
    advanced_enable_surveys: true,
  });
  initialized = true;
}

export function openPostHogFeedbackSurvey() {
  if (!initialized || !feedbackSurveyId) {
    return;
  }

  const display = () => {
    posthog.displaySurvey(feedbackSurveyId, {
      displayType: DisplaySurveyType.Popover,
      ignoreConditions: true,
      ignoreDelay: true,
    });
  };

  posthog.getSurveys((surveys, context) => {
    if (context?.isLoaded && surveys.some((survey) => survey.id === feedbackSurveyId)) {
      display();
      return;
    }
    posthog.getSurveys(() => display(), true);
  });
}

export function capturePostHogPageView() {
  if (!initialized) {
    return;
  }
  posthog.capture("$pageview", {
    $current_url: window.location.href,
  });
}

export function captureEvent(name, properties = {}) {
  if (!initialized) {
    return;
  }
  posthog.capture(name, properties);
}

export function resetPostHogUser() {
  if (!initialized) {
    clearStoredPostHogUid();
    return;
  }
  posthog.reset();
  clearStoredPostHogUid();
}

export function syncPostHogUser(firebaseUser) {
  if (!initialized) {
    return;
  }
  if (!firebaseUser?.uid) {
    // Keep the anonymous distinct id across signed-out page loads.
    return;
  }

  const previousUid = readStoredPostHogUid();
  if (previousUid && previousUid !== firebaseUser.uid) {
    posthog.reset();
  }

  posthog.identify(firebaseUser.uid, {
    email: firebaseUser.email ?? undefined,
    name: firebaseUser.displayName ?? undefined,
  });
  writeStoredPostHogUid(firebaseUser.uid);
}

/** Reset PostHog identity after account deletion (or explicit sign-out flows that need it). */
export function resetPostHogUser() {
  if (!initialized) {
    return;
  }
  posthog.reset();
}
