import { isPostHogConfigured, openPostHogFeedbackSurvey } from "../analytics/posthog.js";

function MegaphoneIcon() {
  return (
    <svg
      className="feedback-fab__icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M3 10v4a1 1 0 0 0 1 1h1.586l4.707 4.707A1 1 0 0 0 12 19.414V4.586a1 1 0 0 0-1.707-.707L5.586 8.586H4a1 1 0 0 0-1 1Z"
        fill="currentColor"
      />
      <path
        d="M15.536 8.464a5 5 0 0 1 0 7.072M17.95 6.05a8 8 0 0 1 0 11.314"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function FeedbackFab() {
  if (!isPostHogConfigured()) {
    return null;
  }

  return (
    <button
      type="button"
      className="feedback-fab"
      aria-label="Submit feedback"
      onClick={() => openPostHogFeedbackSurvey()}
    >
      <MegaphoneIcon />
      <span className="feedback-fab__label">Submit feedback</span>
    </button>
  );
}
