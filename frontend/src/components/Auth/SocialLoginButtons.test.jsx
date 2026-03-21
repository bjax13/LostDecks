import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SocialLoginButtons from "./SocialLoginButtons.jsx";

const loginWithGoogle = vi.fn(() => Promise.resolve());
const loginWithGithub = vi.fn(() => Promise.resolve());

vi.mock("../../contexts/AuthContext.jsx", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useAuth: () => ({
      loginWithGoogle,
      loginWithGithub,
    }),
  };
});

describe("SocialLoginButtons", () => {
  it("invokes Google and GitHub sign-in handlers", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<SocialLoginButtons onSuccess={onSuccess} />);

    await user.click(screen.getByRole("button", { name: /^google$/i }));
    expect(loginWithGoogle).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /^github$/i }));
    expect(loginWithGithub).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(2);
  });
});
