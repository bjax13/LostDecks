import { describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "./authErrorMessage.js";

function firebaseError(code, message = `Firebase: Error (${code}).`) {
  const err = new Error(message);
  err.code = code;
  return err;
}

describe("getAuthErrorMessage (unit)", () => {
  it("maps invalid-credential, wrong-password, and user-not-found to the same copy", () => {
    const expected = "Email or password is incorrect.";
    expect(getAuthErrorMessage(firebaseError("auth/invalid-credential"))).toBe(expected);
    expect(getAuthErrorMessage(firebaseError("auth/wrong-password"))).toBe(expected);
    expect(getAuthErrorMessage(firebaseError("auth/user-not-found"))).toBe(expected);
    expect(getAuthErrorMessage(firebaseError("auth/user-not-found"), { operation: "login" })).toBe(
      expected,
    );
    expect(getAuthErrorMessage(firebaseError("auth/invalid-login-credentials"))).toBe(expected);
  });

  it("uses reset-specific copy for user-not-found without mentioning a password", () => {
    expect(getAuthErrorMessage(firebaseError("auth/user-not-found"), { operation: "reset" })).toBe(
      "If an account exists for that email, a reset link has been sent.",
    );
  });

  it("extracts an auth code from a raw Firebase message when code is missing", () => {
    expect(getAuthErrorMessage(new Error("Firebase: Error (auth/invalid-credential)."))).toBe(
      "Email or password is incorrect.",
    );
  });

  it("maps other common auth codes to friendly copy", () => {
    expect(getAuthErrorMessage(firebaseError("auth/invalid-email"))).toBe(
      "Enter a valid email address.",
    );
    expect(getAuthErrorMessage(firebaseError("auth/email-already-in-use"))).toBe(
      "An account with this email already exists. Sign in or reset your password.",
    );
    expect(getAuthErrorMessage(firebaseError("auth/weak-password"))).toBe(
      "Password is too weak. Use at least 6 characters.",
    );
    expect(getAuthErrorMessage(firebaseError("auth/too-many-requests"))).toBe(
      "Too many attempts. Please wait a moment and try again.",
    );
    expect(getAuthErrorMessage(firebaseError("auth/popup-closed-by-user"))).toBe(
      "Sign-in was cancelled.",
    );
  });

  it("uses a generic message for unmapped auth codes instead of the raw Firebase string", () => {
    expect(getAuthErrorMessage(firebaseError("auth/internal-error"))).toBe(
      "Something went wrong. Please try again.",
    );
    expect(getAuthErrorMessage(new Error("Firebase: Error (auth/internal-error)."))).toBe(
      "Something went wrong. Please try again.",
    );
    expect(getAuthErrorMessage(new Error("Firebase: Unexpected failure"))).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("preserves non-Firebase application messages", () => {
    expect(
      getAuthErrorMessage(
        new Error(
          "Authentication is not configured. Set VITE_FIREBASE_* variables in frontend/.env to enable sign-in.",
        ),
      ),
    ).toBe(
      "Authentication is not configured. Set VITE_FIREBASE_* variables in frontend/.env to enable sign-in.",
    );
  });

  it("returns empty string for nullish errors and a generic fallback for empty messages", () => {
    expect(getAuthErrorMessage(null)).toBe("");
    expect(getAuthErrorMessage(undefined)).toBe("");
    expect(getAuthErrorMessage({})).toBe("Something went wrong. Please try again.");
  });
});
