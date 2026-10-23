import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TestMemoryRouter } from "../../test/router.jsx";
import AdminPage from "./index.jsx";

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseUserCollection = vi.hoisted(() => vi.fn());
const mockHttpsCallable = vi.hoisted(() => vi.fn());
const firebaseState = vi.hoisted(() => ({ functions: { app: "test" } }));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../Collection/hooks/useUserCollection", () => ({
  useUserCollection: (...args) => mockUseUserCollection(...args),
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: (...args) => mockHttpsCallable(...args),
}));

vi.mock("../../lib/firebase", () => firebaseState);

const COLLECTORS = [
  {
    uid: "user-b",
    displayName: "Bee",
    email: "bee@example.com",
    distinctItems: 1,
    totalQuantity: 4,
    dunCount: 0,
    foilCount: 1,
  },
  {
    uid: "user-a",
    displayName: "Ada",
    email: "ada@example.com",
    distinctItems: 3,
    totalQuantity: 8,
    dunCount: 2,
    foilCount: 1,
  },
];

function renderAdmin(path = "/admin") {
  return render(
    <TestMemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/:uid" element={<AdminPage />} />
        <Route path="/auth/login" element={<h1>Sign in</h1>} />
        <Route path="/collectibles/:cardId/:skuId" element={<h1>Card editor</h1>} />
      </Routes>
    </TestMemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  firebaseState.functions = { app: "test" };
  mockUseAuth.mockReturnValue({
    user: { uid: "admin-1", email: "corbyagain@gmail.com" },
    loading: false,
    isAdmin: true,
    adminLoading: false,
  });
  mockUseUserCollection.mockReturnValue({ entries: [], loading: false, error: null });
  mockHttpsCallable.mockReturnValue(async () => ({ data: { users: COLLECTORS } }));
});

describe("AdminPage", () => {
  it("redirects signed-out visitors to sign in", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      isAdmin: false,
      adminLoading: false,
    });
    renderAdmin();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(mockHttpsCallable).not.toHaveBeenCalled();
    expect(mockUseUserCollection).not.toHaveBeenCalled();
  });

  it("tells a signed-in collector they are not authorized", () => {
    mockUseAuth.mockReturnValue({
      user: { uid: "user-1" },
      loading: false,
      isAdmin: false,
      adminLoading: false,
    });
    renderAdmin();
    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    expect(
      screen.getByText("You are not authorized to view collector collections."),
    ).toBeInTheDocument();
    expect(mockHttpsCallable).not.toHaveBeenCalled();
    expect(mockUseUserCollection).not.toHaveBeenCalled();
  });

  it("waits while the admin claim is loading", () => {
    mockUseAuth.mockReturnValue({
      user: { uid: "admin-1" },
      loading: false,
      isAdmin: false,
      adminLoading: true,
    });
    renderAdmin();
    expect(screen.getByText("Checking access…")).toBeInTheDocument();
    expect(mockHttpsCallable).not.toHaveBeenCalled();
  });

  it("lists every collector with server-provided totals", async () => {
    renderAdmin();
    const list = await screen.findByRole("list", { name: "Collectors" });
    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining("Bee"),
      expect.stringContaining("Ada"),
    ]);
    expect(links[0]).toHaveTextContent("bee@example.com");
    expect(links[0]).toHaveTextContent("1 owned · 4 copies · 0 dun · 1 foil");
    expect(links[1]).toHaveTextContent("3 owned · 8 copies · 2 dun · 1 foil");
    expect(mockHttpsCallable).toHaveBeenCalledWith(firebaseState.functions, "listAdminCollectors");
  });

  it("shows an empty directory and a load error", async () => {
    mockHttpsCallable.mockReturnValue(async () => ({ data: { users: [] } }));
    renderAdmin();
    expect(await screen.findByText("No collectors yet.")).toBeInTheDocument();

    mockHttpsCallable.mockReturnValue(async () => {
      throw new Error("permission");
    });
    renderAdmin("/admin");
    expect(await screen.findByText(/Failed to load collectors\. permission/)).toBeInTheDocument();
  });

  it("opens a read-only collection without quantity controls", async () => {
    const user = userEvent.setup();
    mockUseUserCollection.mockImplementation((ownerUid) => {
      if (ownerUid !== "user-a") {
        return { entries: [], loading: false, error: null };
      }
      return {
        entries: [
          {
            id: "entry-1",
            ownerUid: "user-a",
            skuId: "LT24-ELS-01-DUN",
            quantity: 2,
            updatedAt: null,
          },
        ],
        loading: false,
        error: null,
      };
    });

    renderAdmin();
    await user.click(await screen.findByRole("link", { name: /Ada/ }));

    expect(await screen.findByRole("heading", { name: "Ada" })).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(
      screen.getByText("Read-only. This collection cannot be edited here."),
    ).toBeInTheDocument();
    expect(screen.getByText("LT24-ELS-01-DUN")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Increase quantity/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Decrease quantity/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Card editor" })).not.toBeInTheDocument();
    expect(mockUseUserCollection).toHaveBeenCalledWith("user-a");

    const row = screen.getByText("LT24-ELS-01-DUN").closest("tr");
    await user.click(row);
    expect(screen.queryByRole("heading", { name: "Card editor" })).not.toBeInTheDocument();
  });

  it("reports a collection load failure for the selected user", async () => {
    mockUseUserCollection.mockReturnValue({
      entries: [],
      loading: false,
      error: new Error("missing"),
    });
    renderAdmin("/admin/user-a");
    expect(await screen.findByText(/Failed to load this collection\. missing/)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeInTheDocument();
  });

  it("explains when Firebase is not configured", async () => {
    firebaseState.functions = null;
    renderAdmin();
    expect(
      await screen.findByText(
        /Firebase is not configured, so collector collections cannot be loaded/,
      ),
    ).toBeInTheDocument();
    expect(mockHttpsCallable).not.toHaveBeenCalled();
  });
});
