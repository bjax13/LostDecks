import posthog, { DisplaySurveyType } from "posthog-js";

const key = import.meta.env.VITE_POSTHOG_KEY?.trim() ?? "";
const host = import.meta.env.VITE_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";
const feedbackSurveyId = import.meta.env.VITE_POSTHOG_SURVEY_ID?.trim() ?? "";

let initialized = false;

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
