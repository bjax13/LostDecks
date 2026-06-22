import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../contexts/AuthContext.jsx";
import SocialLoginButtons from "./SocialLoginButtons.jsx";

const { mockAuth, mockGoogleProvider, signInWithPopup } = vi.hoisted(() => {
  const auth = { _mock: "auth" };
  return {
    mockAuth: auth,
    mockGoogleProvider: { providerId: "google.com", _mock: "google" },
    signInWithPopup: vi.fn(),
  };
});

vi.mock("../../lib/firebase", () => ({
  auth: mockAuth,
  googleProvider: mockGoogleProvider,
  hasFirebaseConfig: true,
  app: {},
  db: null,
  functions: null,
}));

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(null);
    return vi.fn();
  }),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: (...args) => signInWithPopup(...args),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
  GoogleAuthProvider: vi.fn(),
}));

function renderSocialLogin(ui) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

describe("SocialLoginButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInWithPopup.mockResolvedValue(undefined);
  });

  it("renders social login heading and provider buttons", () => {
    renderSocialLogin(<SocialLoginButtons />);
    expect(screen.getByText("Or continue with")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Google" })).toBeInTheDocument();
  });

  it("calls Firebase signInWithPopup with auth and Google provider and invokes onSuccess", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    renderSocialLogin(<SocialLoginButtons onSuccess={onSuccess} />);

    await user.click(screen.getByRole("button", { name: "Google" }));

    expect(signInWithPopup).toHaveBeenCalledTimes(1);
    expect(signInWithPopup).toHaveBeenCalledWith(mockAuth, mockGoogleProvider);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("does not call onSuccess when prop is omitted after successful sign-in", async () => {
    const user = userEvent.setup();
    renderSocialLogin(<SocialLoginButtons />);

    await user.click(screen.getByRole("button", { name: "Google" }));

    expect(signInWithPopup).toHaveBeenCalledTimes(1);
  });

  it("logs and swallows errors when Google sign-in fails", async () => {
    const user = userEvent.setup();
    const err = new Error("popup blocked");
    signInWithPopup.mockRejectedValueOnce(err);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onSuccess = vi.fn();

    renderSocialLogin(<SocialLoginButtons onSuccess={onSuccess} />);
    await user.click(screen.getByRole("button", { name: "Google" }));

    expect(errorSpy).toHaveBeenCalledWith("Google sign-in failed", err);
    expect(onSuccess).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
