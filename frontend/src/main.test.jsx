import { render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateRoot, mockRender } = vi.hoisted(() => {
  const mockRender = vi.fn();
  const mockCreateRoot = vi.fn(() => ({ render: mockRender }));
  return { mockCreateRoot, mockRender };
});

vi.mock("react-dom/client", () => ({
  default: {
    createRoot: (...args) => mockCreateRoot(...args),
  },
}));

vi.mock("./App.jsx", () => ({
  default: function MockApp() {
    return <span data-testid="mock-app">App</span>;
  },
}));

vi.mock("./contexts/AuthContext.jsx", () => ({
  AuthProvider: ({ children }) => <div data-testid="auth-provider">{children}</div>,
}));

vi.mock("./contexts/AuthModalContext.jsx", () => ({
  AuthModalProvider: ({ children }) => <div data-testid="auth-modal-provider">{children}</div>,
}));

async function loadMain() {
  vi.resetModules();
  await import("./main.jsx");
}

describe("main.jsx (entry)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    mockCreateRoot.mockClear();
    mockRender.mockClear();
  });

  it("creates a root on #root and renders the provider tree under StrictMode", async () => {
    const rootEl = document.getElementById("root");
    await loadMain();

    expect(mockCreateRoot).toHaveBeenCalledTimes(1);
    expect(mockCreateRoot).toHaveBeenCalledWith(rootEl);
    expect(mockRender).toHaveBeenCalledTimes(1);

    const tree = mockRender.mock.calls[0][0];
    expect(tree.type).toBe(React.StrictMode);

    render(tree);
    expect(screen.getByTestId("auth-provider")).toBeInTheDocument();
    expect(screen.getByTestId("auth-modal-provider")).toBeInTheDocument();
    expect(screen.getByTestId("mock-app")).toBeInTheDocument();
  });

  it("wires the same root element returned by the document", async () => {
    const getById = vi.spyOn(document, "getElementById");
    await loadMain();

    expect(getById).toHaveBeenCalledWith("root");
    expect(mockCreateRoot).toHaveBeenCalledWith(document.getElementById("root"));
    getById.mockRestore();
  });
});
