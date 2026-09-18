import { describe, expect, it } from "vitest";
import { POST_AUTH_HOME, resolvePostAuthPath, sanitizeInAppPath } from "./postAuthRedirect.js";

describe("sanitizeInAppPath", () => {
  it("accepts in-app paths including search and hash", () => {
    expect(sanitizeInAppPath("/account")).toBe("/account");
    expect(sanitizeInAppPath(" /collections?tab=bulk#top ")).toBe("/collections?tab=bulk#top");
  });

  it("rejects missing, external, and auth-loop paths", () => {
    expect(sanitizeInAppPath(null)).toBeNull();
    expect(sanitizeInAppPath("collections")).toBeNull();
    expect(sanitizeInAppPath("//evil.example")).toBeNull();
    expect(sanitizeInAppPath("https://evil.example/phish")).toBeNull();
    expect(sanitizeInAppPath("/\\evil.example")).toBeNull();
    expect(sanitizeInAppPath("/auth/login")).toBeNull();
    expect(sanitizeInAppPath("/auth/register?x=1")).toBeNull();
    expect(sanitizeInAppPath("/auth")).toBeNull();
  });
});

describe("resolvePostAuthPath", () => {
  it("defaults to home", () => {
    expect(resolvePostAuthPath({ pathname: "/auth/login", search: "" })).toBe(POST_AUTH_HOME);
    expect(resolvePostAuthPath(undefined)).toBe("/");
  });

  it("honors a safe redirect query over state.from and home", () => {
    expect(
      resolvePostAuthPath({
        pathname: "/auth/login",
        search: "?redirect=/matches",
        state: { from: { pathname: "/account" } },
      }),
    ).toBe("/matches");
  });

  it("honors location.state.from when no redirect query is present", () => {
    expect(
      resolvePostAuthPath({
        pathname: "/auth/login",
        search: "",
        state: { from: { pathname: "/collections", search: "?focus=bulk", hash: "#tools" } },
      }),
    ).toBe("/collections?focus=bulk#tools");
  });

  it("accepts a string state.from pathname", () => {
    expect(
      resolvePostAuthPath({
        pathname: "/auth/login",
        search: "",
        state: { from: "/account" },
      }),
    ).toBe("/account");
  });

  it("ignores unsafe redirect values and falls back to home", () => {
    expect(
      resolvePostAuthPath({
        pathname: "/auth/login",
        search: "?redirect=https://evil.example",
      }),
    ).toBe("/");
    expect(
      resolvePostAuthPath({
        pathname: "/auth/login",
        search: "?redirect=/auth/login",
        state: { from: { pathname: "/auth/register" } },
      }),
    ).toBe("/");
  });

  it("uses the provided default path when nothing safe is present", () => {
    expect(resolvePostAuthPath({ search: "" }, "/collections")).toBe("/collections");
  });
});
