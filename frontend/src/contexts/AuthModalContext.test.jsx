import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthModalProvider, useAuthModal } from "./AuthModalContext.jsx";

vi.mock("../components/Auth/AuthModal.jsx", () => ({
  default: ({ isOpen, onClose }) =>
    isOpen ? (
      <div data-testid="auth-modal">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

function TestConsumer() {
  const { openAuthModal, closeAuthModal, isOpen } = useAuthModal();
  return (
    <div>
      <button type="button" onClick={() => openAuthModal({ mode: "login" })}>
        Open
      </button>
      <button type="button" onClick={closeAuthModal}>
        Close programmatic
      </button>
      <span data-testid="is-open">{String(isOpen)}</span>
    </div>
  );
}

describe("AuthModalContext (unit)", () => {
  it("provides openAuthModal and closeAuthModal", () => {
    render(
      <AuthModalProvider>
        <TestConsumer />
      </AuthModalProvider>,
    );
    expect(screen.getByTestId("is-open")).toHaveTextContent("false");
  });

  it("opens modal when openAuthModal called", async () => {
    render(
      <AuthModalProvider>
        <TestConsumer />
      </AuthModalProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByTestId("auth-modal")).toBeInTheDocument();
    expect(screen.getByTestId("is-open")).toHaveTextContent("true");
  });

  it("closes modal when closeAuthModal called", async () => {
    render(
      <AuthModalProvider>
        <TestConsumer />
      </AuthModalProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();
  });

  it("throws when useAuthModal used outside provider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(/must be used within an AuthModalProvider/);
    consoleSpy.mockRestore();
  });
});
