const DEFAULT_LOGIN_URL = "https://shardstash.web.app/auth/login";
const DEFAULT_EXPECTED_HOST = "shardstash.web.app";

function parseRedirectUriFromGoogleUrl(url) {
  if (typeof url !== "string" || !url.includes("accounts.google.com")) {
    return null;
  }

  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("redirect_uri");
  } catch {
    return null;
  }
}

function expectedRedirectUriForHost(host) {
  const trimmed = String(host || "").trim();
  if (!trimmed) {
    return "";
  }
  return `https://${trimmed}/__/auth/handler`;
}

async function verifyGoogleAuthRedirectHost(options = {}) {
  const loginUrl = options.loginUrl || DEFAULT_LOGIN_URL;
  const expectedHost = options.expectedHost || DEFAULT_EXPECTED_HOST;
  const expectedRedirectUri = expectedRedirectUriForHost(expectedHost);

  const path = require("node:path");
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch (firstError) {
    try {
      ({ chromium } = require(path.join(__dirname, "../frontend/node_modules/playwright")));
    } catch (secondError) {
      throw new Error(
        "Playwright is required. Run npm ci in frontend/, then npx playwright install chromium.",
        { cause: secondError ?? firstError },
      );
    }
  }

  const browser = await chromium.launch({ headless: options.headless !== false });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const popupPromise = context.waitForEvent("page", { timeout: options.timeoutMs || 20000 });

    await page.goto(loginUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /google/i }).click();

    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    await popup.waitForTimeout(1500);

    const popupUrl = popup.url();
    const redirectUri = parseRedirectUriFromGoogleUrl(popupUrl);
    const bodyText = await popup.locator("body").innerText();
    const continueMatch = bodyText.match(/continue to\s+([^\n]+)/i);
    const continueHost = continueMatch?.[1]?.trim() || "";

    const ok =
      redirectUri === expectedRedirectUri &&
      continueHost.toLowerCase() === expectedHost.toLowerCase();

    return {
      ok,
      loginUrl,
      expectedHost,
      expectedRedirectUri,
      popupUrl,
      redirectUri,
      continueHost,
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  DEFAULT_EXPECTED_HOST,
  DEFAULT_LOGIN_URL,
  expectedRedirectUriForHost,
  parseRedirectUriFromGoogleUrl,
  verifyGoogleAuthRedirectHost,
};

if (require.main === module) {
  verifyGoogleAuthRedirectHost({
    loginUrl: process.env.VERIFY_GOOGLE_AUTH_LOGIN_URL,
    expectedHost: process.env.VERIFY_GOOGLE_AUTH_EXPECTED_HOST,
    headless: process.env.VERIFY_GOOGLE_AUTH_HEADED !== "1",
  })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
