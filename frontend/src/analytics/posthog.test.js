import { beforeEach, describe, expect, it, vi } from "vitest";

const initMock = vi.fn();
const captureMock = vi.fn();
const identifyMock = vi.fn();
const resetMock = vi.fn();
const displaySurveyMock = vi.fn();
const getSurveysMock = vi.fn((callback) => {
  callback([{ id: "survey-test-id" }], { isLoaded: true });
});

vi.mock("posthog-js", () => ({
  default: {
    init: initMock,
    capture: captureMock,
    identify: identifyMock,
    reset: resetMock,
    displaySurvey: displaySurveyMock,
    getSurveys: getSurveysMock,
  },
  DisplaySurveyType: { Popover: "Popover", Inline: "Inline" },
}));

describe("posthog analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    initMock.mockClear();
    captureMock.mockClear();
    identifyMock.mockClear();
    resetMock.mockClear();
    displaySurveyMock.mockClear();
    getSurveysMock.mockClear();
    getSurveysMock.mockImplementation((callback) => {
      callback([{ id: "survey-test-id" }], { isLoaded: true });
    });
  });

  it("does not init when the project key is missing", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "");
    const { initPostHog } = await import("./posthog.js");
    initPostHog();
    expect(initMock).not.toHaveBeenCalled();
  });

  it("inits when the project key is set", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test");
    vi.stubEnv("VITE_POSTHOG_HOST", "https://us.i.posthog.com");
    const { initPostHog } = await import("./posthog.js");
    initPostHog();
    expect(initMock).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        api_host: "https://us.i.posthog.com",
        capture_pageview: false,
        disable_surveys_automatic_display: true,
        advanced_enable_surveys: true,
      }),
    );
  });

  it("opens the configured feedback survey via displaySurvey", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test");
    vi.stubEnv("VITE_POSTHOG_SURVEY_ID", "survey-test-id");
    const { initPostHog, openPostHogFeedbackSurvey } = await import("./posthog.js");
    initPostHog();
    openPostHogFeedbackSurvey();
    expect(displaySurveyMock).toHaveBeenCalledWith(
      "survey-test-id",
      expect.objectContaining({
        displayType: "Popover",
        ignoreConditions: true,
        ignoreDelay: true,
      }),
    );
  });

  it("does not open a survey without a survey id", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test");
    vi.stubEnv("VITE_POSTHOG_SURVEY_ID", "");
    const { initPostHog, openPostHogFeedbackSurvey } = await import("./posthog.js");
    initPostHog();
    openPostHogFeedbackSurvey();
    expect(displaySurveyMock).not.toHaveBeenCalled();
  });

  it("does not open a stopped or missing feedback survey", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test");
    vi.stubEnv("VITE_POSTHOG_SURVEY_ID", "survey-test-id");
    getSurveysMock.mockImplementation((callback) => {
      callback([{ id: "survey-test-id", end_date: "2020-01-01T00:00:00.000Z" }], {
        isLoaded: true,
      });
    });
    const { initPostHog, openPostHogFeedbackSurvey } = await import("./posthog.js");
    initPostHog();
    openPostHogFeedbackSurvey();
    expect(displaySurveyMock).not.toHaveBeenCalled();
  });

  it("reports feedback survey availability from getSurveys", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test");
    vi.stubEnv("VITE_POSTHOG_SURVEY_ID", "survey-test-id");
    const { initPostHog, fetchPostHogFeedbackSurveyAvailability } = await import("./posthog.js");
    initPostHog();
    await expect(fetchPostHogFeedbackSurveyAvailability()).resolves.toBe(true);

    getSurveysMock.mockImplementation((callback) => {
      callback([], { isLoaded: true });
    });
    await expect(fetchPostHogFeedbackSurveyAvailability()).resolves.toBe(false);
  });

  it("captures pageviews only after init", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "");
    const { initPostHog, capturePostHogPageView } = await import("./posthog.js");
    initPostHog();
    capturePostHogPageView();
    expect(captureMock).not.toHaveBeenCalled();

    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test");
    const { initPostHog: init2, capturePostHogPageView: capture2 } = await import("./posthog.js");
    init2();
    capture2();
    expect(captureMock).toHaveBeenCalledWith(
      "$pageview",
      expect.objectContaining({ $current_url: expect.any(String) }),
    );
  });

  it("identifies or resets the user after init", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test");
    const { initPostHog, syncPostHogUser } = await import("./posthog.js");
    initPostHog();
    syncPostHogUser({
      uid: "u1",
      email: "a@b.c",
      displayName: "Ada",
    });
    expect(identifyMock).toHaveBeenCalledWith("u1", {
      email: "a@b.c",
      name: "Ada",
    });
    syncPostHogUser(null);
    expect(resetMock).toHaveBeenCalled();
  });
});
