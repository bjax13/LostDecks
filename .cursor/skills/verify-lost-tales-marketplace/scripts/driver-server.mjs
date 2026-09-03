#!/usr/bin/env node
/**
 * Long-lived Playwright driver for Lost Tales Marketplace verification.
 * Bound to 127.0.0.1. Started by verify-lost-tales.mjs; do not launch by hand.
 */
import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function findRepoRoot(startDir) {
  let dir = startDir;
  while (true) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg.name === "lost-tales-marketplace-repo") {
          return dir;
        }
      } catch {
        // keep walking
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error("Could not find Lost Tales repo root from driver-server.mjs");
    }
    dir = parent;
  }
}

const repoRoot = findRepoRoot(here);
const requireFrontend = createRequire(path.join(repoRoot, "frontend", "package.json"));
const { chromium } = requireFrontend("playwright");

const baseUrl = process.env.VERIFY_BASE_URL || "http://127.0.0.1:5173";
const listenPort = Number(process.env.VERIFY_DRIVER_PORT || 17331);
const listenHost = "127.0.0.1";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  baseURL: baseUrl,
});
const page = await context.newPage();
page.setDefaultTimeout(15_000);
await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function locatorFor(spec) {
  let root = page;
  if (spec.scope === "nav") {
    root = page.getByRole("navigation", { name: "Primary" });
  }

  const exact = Boolean(spec.exact);
  if (spec.role) {
    const options = {};
    if (spec.name != null) {
      options.name = spec.name;
      options.exact = exact;
    }
    let loc = root.getByRole(spec.role, options);
    if (spec.nth != null) {
      loc = loc.nth(Number(spec.nth));
    }
    return loc;
  }
  if (spec.label) {
    let loc = root.getByLabel(spec.label, { exact });
    if (spec.nth != null) {
      loc = loc.nth(Number(spec.nth));
    }
    return loc;
  }
  if (spec.placeholder) {
    let loc = root.getByPlaceholder(spec.placeholder, { exact });
    if (spec.nth != null) {
      loc = loc.nth(Number(spec.nth));
    }
    return loc;
  }
  if (spec.text) {
    let loc = root.getByText(spec.text, { exact });
    if (spec.nth != null) {
      loc = loc.nth(Number(spec.nth));
    }
    return loc;
  }
  throw new Error("Need --role, --label, --placeholder, or --text to build a locator");
}

async function pageInfo() {
  return {
    url: page.url(),
    title: await page.title(),
  };
}

async function handleCommand(cmd) {
  const action = cmd.action;
  if (action === "goto") {
    const target = cmd.path.startsWith("http") ? cmd.path : new URL(cmd.path, baseUrl).toString();
    await page.goto(target, { waitUntil: "domcontentloaded" });
    return pageInfo();
  }
  if (action === "click") {
    await locatorFor(cmd).click();
    return pageInfo();
  }
  if (action === "fill") {
    await locatorFor(cmd).fill(String(cmd.value ?? ""));
    return pageInfo();
  }
  if (action === "select") {
    const loc = locatorFor(cmd);
    if (cmd.value != null) {
      await loc.selectOption({ label: String(cmd.value) });
    } else if (cmd.option != null) {
      await loc.selectOption(String(cmd.option));
    } else {
      throw new Error("select requires --value (visible label) or --option (option value)");
    }
    return pageInfo();
  }
  if (action === "press") {
    if (cmd.role || cmd.label || cmd.placeholder || cmd.text) {
      await locatorFor(cmd).press(cmd.key);
    } else {
      await page.keyboard.press(cmd.key);
    }
    return pageInfo();
  }
  if (action === "expect") {
    await locatorFor(cmd).waitFor({ state: cmd.state || "visible" });
    return pageInfo();
  }
  if (action === "expect-url") {
    const expected = cmd.path;
    await page.waitForURL((url) => {
      const current = new URL(url);
      if (expected.startsWith("http")) {
        return current.href === expected;
      }
      return current.pathname === expected;
    });
    return pageInfo();
  }
  if (action === "count") {
    const count = await locatorFor(cmd).count();
    return { ...(await pageInfo()), count };
  }
  if (action === "text") {
    const loc =
      cmd.role || cmd.label || cmd.placeholder || cmd.text ? locatorFor(cmd) : page.locator("body");
    const text = ((await loc.innerText()) || "").trim();
    return { ...(await pageInfo()), text };
  }
  if (action === "screenshot") {
    const outPath = cmd.path;
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await page.screenshot({ path: outPath, fullPage: Boolean(cmd.fullPage) });
    return { ...(await pageInfo()), path: outPath };
  }
  if (action === "snapshot") {
    const outPath = cmd.path;
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const snapshot = await page.locator("body").ariaSnapshot();
    fs.writeFileSync(outPath, `${snapshot}\n`);
    return { ...(await pageInfo()), path: outPath };
  }
  if (action === "login") {
    const email = cmd.email;
    const password = cmd.password;
    if (!email || !password) {
      throw new Error("login requires --email and --password");
    }
    await page.goto(new URL("/auth/login", baseUrl).toString(), { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: /Sign in to Lost Tales Marketplace/i }).waitFor();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("button", { name: "Sign out" })
      .waitFor();
    return pageInfo();
  }
  if (action === "logout") {
    const signOut = page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("button", { name: "Sign out" });
    if ((await signOut.count()) > 0) {
      await signOut.click();
      await page
        .getByRole("navigation", { name: "Primary" })
        .getByRole("link", { name: "Sign in" })
        .waitFor();
    }
    return pageInfo();
  }
  throw new Error(`Unknown drive action: ${action}`);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${listenHost}:${listenPort}`);
    if (req.method === "GET" && url.pathname === "/health") {
      send(res, 200, { ok: true, ...(await pageInfo()), baseUrl });
      return;
    }
    if (req.method === "POST" && url.pathname === "/command") {
      const cmd = await readBody(req);
      const result = await handleCommand(cmd);
      send(res, 200, { ok: true, ...result });
      return;
    }
    send(res, 404, { ok: false, error: "not found" });
  } catch (error) {
    let snapshot = "";
    try {
      snapshot = await page.locator("body").ariaSnapshot();
    } catch {
      snapshot = "";
    }
    send(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      url: page.url(),
      snapshot,
    });
  }
});

function shutdown() {
  server.close();
  context.close().catch(() => {});
  browser.close().catch(() => {});
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(listenPort, listenHost, () => {
  process.stdout.write(`driver ready on http://${listenHost}:${listenPort}\n`);
});
