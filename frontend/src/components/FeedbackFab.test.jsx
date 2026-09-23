import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const openPostHogFeedbackSurveyMock = vi.fn();
const isPostHogConfiguredMock = vi.fn(() => true);

vi.mock("../analytics/posthog.js", () => ({
  isPostHogConfigured: () => isPostHogConfiguredMock(),
  openPostHogFeedbackSurvey: () => openPostHogFeedbackSurveyMock(),
}));

import FeedbackFab from "./FeedbackFab.jsx";

describe("FeedbackFab", () => {
  beforeEach(() => {
    isPostHogConfiguredMock.mockReturnValue(true);
    openPostHogFeedbackSurveyMock.mockClear();
  });

  it("does not render when PostHog is not configured", () => {
    isPostHogConfiguredMock.mockReturnValue(false);
    render(<FeedbackFab />);
    expect(screen.queryByRole("button", { name: "Submit feedback" })).not.toBeInTheDocument();
  });

  it("opens the PostHog feedback survey when clicked", async () => {
    const user = userEvent.setup();
    render(<FeedbackFab />);

    const button = screen.getByRole("button", { name: "Submit feedback" });
    expect(button).toHaveTextContent("Submit feedback");

    await user.click(button);
    expect(openPostHogFeedbackSurveyMock).toHaveBeenCalledTimes(1);
  });
});
