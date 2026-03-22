import { beforeEach, describe, expect, it, vi } from "vitest";

const initMock = vi.fn();
const captureMock = vi.fn();
const identifyMock = vi.fn();
const resetMock = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    init: initMock,
    capture: captureMock,
    identify: identifyMock,
    reset: resetMock,
  },
}));

describe("posthog analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    initMock.mockClear();
    captureMock.mockClear();
    identifyMock.mockClear();
    resetMock.mockClear();
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
      }),
    );
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
