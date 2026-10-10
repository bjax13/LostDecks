import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const openPostHogFeedbackSurveyMock = vi.fn();
const isPostHogConfiguredMock = vi.fn(() => true);
const getPostHogFeedbackSurveyIdMock = vi.fn(() => "survey-test-id");
const fetchPostHogFeedbackSurveyAvailabilityMock = vi.fn(async () => true);

vi.mock("../analytics/posthog.js", () => ({
  isPostHogConfigured: () => isPostHogConfiguredMock(),
  getPostHogFeedbackSurveyId: () => getPostHogFeedbackSurveyIdMock(),
  fetchPostHogFeedbackSurveyAvailability: () => fetchPostHogFeedbackSurveyAvailabilityMock(),
  openPostHogFeedbackSurvey: () => openPostHogFeedbackSurveyMock(),
}));

import FeedbackFab from "./FeedbackFab.jsx";

describe("FeedbackFab", () => {
  beforeEach(() => {
    isPostHogConfiguredMock.mockReturnValue(true);
    getPostHogFeedbackSurveyIdMock.mockReturnValue("survey-test-id");
    fetchPostHogFeedbackSurveyAvailabilityMock.mockResolvedValue(true);
    openPostHogFeedbackSurveyMock.mockClear();
  });

  it("does not render when PostHog is not configured", async () => {
    isPostHogConfiguredMock.mockReturnValue(false);
    render(<FeedbackFab />);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Submit feedback" })).not.toBeInTheDocument();
    });
    expect(fetchPostHogFeedbackSurveyAvailabilityMock).not.toHaveBeenCalled();
  });

  it("does not render when the survey id is missing", async () => {
    getPostHogFeedbackSurveyIdMock.mockReturnValue("");
    render(<FeedbackFab />);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Submit feedback" })).not.toBeInTheDocument();
    });
    expect(fetchPostHogFeedbackSurveyAvailabilityMock).not.toHaveBeenCalled();
  });

  it("does not render when the feedback survey is inactive or missing", async () => {
    fetchPostHogFeedbackSurveyAvailabilityMock.mockResolvedValue(false);
    render(<FeedbackFab />);
    await waitFor(() => {
      expect(fetchPostHogFeedbackSurveyAvailabilityMock).toHaveBeenCalled();
    });
    expect(screen.queryByRole("button", { name: "Submit feedback" })).not.toBeInTheDocument();
  });

  it("opens the PostHog feedback survey when clicked", async () => {
    const user = userEvent.setup();
    render(<FeedbackFab />);

    const button = await screen.findByRole("button", { name: "Submit feedback" });
    expect(button).toHaveTextContent("Submit feedback");

    await user.click(button);
    expect(openPostHogFeedbackSurveyMock).toHaveBeenCalledTimes(1);
  });
});
