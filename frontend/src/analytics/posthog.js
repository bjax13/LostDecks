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

/** True when the survey is present and has not been stopped (end_date in the past). */
export function isActiveFeedbackSurvey(survey) {
  if (!survey || survey.id !== feedbackSurveyId) {
    return false;
  }
  if (survey.start_date) {
    const start = new Date(survey.start_date);
    if (!Number.isNaN(start.getTime()) && start.getTime() > Date.now()) {
      return false;
    }
  }
  if (survey.end_date) {
    const end = new Date(survey.end_date);
    if (!Number.isNaN(end.getTime()) && end.getTime() <= Date.now()) {
      return false;
    }
  }
  return true;
}

/**
 * Resolves true when PostHog still serves the configured feedback survey as active.
 * Use this to hide the FAB after PostHog stops the survey (e.g. responses_limit).
 */
export function fetchPostHogFeedbackSurveyAvailability() {
  return new Promise((resolve) => {
    if (!initialized || !feedbackSurveyId) {
      resolve(false);
      return;
    }

    const resolveFromList = (surveys) => {
      resolve((surveys ?? []).some(isActiveFeedbackSurvey));
    };

    posthog.getSurveys((surveys, context) => {
      if (context?.isLoaded) {
        resolveFromList(surveys);
        return;
      }
      posthog.getSurveys((fresh) => resolveFromList(fresh), true);
    });
  });
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

  const displayIfActive = (surveys) => {
    if (!(surveys ?? []).some(isActiveFeedbackSurvey)) {
      return;
    }
    posthog.displaySurvey(feedbackSurveyId, {
      displayType: DisplaySurveyType.Popover,
      ignoreConditions: true,
      ignoreDelay: true,
    });
  };

  posthog.getSurveys((surveys, context) => {
    if (context?.isLoaded) {
      displayIfActive(surveys);
      return;
    }
    posthog.getSurveys((fresh) => displayIfActive(fresh), true);
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
