import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Node 22+ may expose a broken experimental localStorage (empty object without
 * Storage methods) that shadows jsdom's implementation. Provide a minimal
 * in-memory Storage when clear/getItem/setItem are missing.
 */
function ensureWorkingLocalStorage() {
  const storage = globalThis.localStorage;
  const isUsable =
    storage &&
    typeof storage.getItem === "function" &&
    typeof storage.setItem === "function" &&
    typeof storage.removeItem === "function" &&
    typeof storage.clear === "function";

  if (isUsable) {
    return;
  }

  const map = new Map();
  const polyfill = {
    getItem(key) {
      return map.has(String(key)) ? map.get(String(key)) : null;
    },
    setItem(key, value) {
      map.set(String(key), String(value));
    },
    removeItem(key) {
      map.delete(String(key));
    },
    clear() {
      map.clear();
    },
    key(index) {
      return [...map.keys()][index] ?? null;
    },
    get length() {
      return map.size;
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    enumerable: true,
    value: polyfill,
  });

  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      enumerable: true,
      value: polyfill,
    });
  }
}

ensureWorkingLocalStorage();

afterEach(() => {
  cleanup();
  try {
    globalThis.localStorage?.clear?.();
  } catch {
    // Ignore storage cleanup failures.
  }
});
