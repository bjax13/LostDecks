import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateListingForm, { dollarsToCents } from "./CreateListingForm.jsx";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
	useNavigate: () => mockNavigate,
}));

const mockCreateListing = vi.fn();
vi.mock("../../../lib/marketplace/listings", () => ({
	createListing: (...args) => mockCreateListing(...args),
}));

let mockUser = null;
vi.mock("../../../contexts/AuthContext", () => ({
	useAuth: () => ({ user: mockUser }),
}));

function renderForm(props = {}) {
	const defaults = { collectibleId: "card-42" };
	return render(<CreateListingForm {...defaults} {...props} />);
}

describe("dollarsToCents", () => {
	it("returns null for empty string", () => {
		expect(dollarsToCents("")).toBeNull();
	});

	it("returns null for whitespace-only string", () => {
		expect(dollarsToCents("   ")).toBeNull();
		expect(dollarsToCents("\t\n")).toBeNull();
	});

	it("returns null for null or undefined", () => {
		expect(dollarsToCents(null)).toBeNull();
		expect(dollarsToCents(undefined)).toBeNull();
	});

	it("returns null for zero", () => {
		expect(dollarsToCents("0")).toBeNull();
		expect(dollarsToCents(0)).toBeNull();
	});

	it("returns null for negative values", () => {
		expect(dollarsToCents("-5")).toBeNull();
		expect(dollarsToCents(-10)).toBeNull();
	});

	it("returns null for non-numeric strings", () => {
		expect(dollarsToCents("abc")).toBeNull();
		expect(dollarsToCents("$10")).toBeNull();
	});

	it("returns null for NaN", () => {
		expect(dollarsToCents(NaN)).toBeNull();
	});

	it("returns null for Infinity", () => {
		expect(dollarsToCents("Infinity")).toBeNull();
	});

	it("converts whole dollars to cents", () => {
		expect(dollarsToCents("10")).toBe(1000);
		expect(dollarsToCents(25)).toBe(2500);
	});

	it("converts decimal amounts to cents", () => {
		expect(dollarsToCents("25.50")).toBe(2550);
		expect(dollarsToCents("0.01")).toBe(1);
	});

	it("rounds fractional cents", () => {
		expect(dollarsToCents("10.999")).toBe(1100);
		expect(dollarsToCents("10.004")).toBe(1000);
	});

	it("trims surrounding whitespace", () => {
		expect(dollarsToCents("  10  ")).toBe(1000);
	});
});

describe("CreateListingForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockCreateListing.mockReset();
		mockUser = null;
	});

	describe("rendering", () => {
		it("renders a type select, price input, and submit button", () => {
			renderForm();
			expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/price/i)).toBeInTheDocument();
			expect(screen.getByRole("button")).toBeInTheDocument();
		});

		it("renders a form with create-listing className", () => {
			renderForm();
			const form = document.querySelector("form.create-listing");
			expect(form).toBeTruthy();
			expect(form).toHaveClass("create-listing");
		});

		it("price input has correct attributes", () => {
			renderForm();
			const input = screen.getByPlaceholderText("10.00");
			expect(input).toHaveAttribute("type", "number");
			expect(input).toHaveAttribute("min", "0");
			expect(input).toHaveAttribute("step", "0.01");
			expect(input).toHaveAttribute("inputMode", "decimal");
		});

		it("shows 'Sign in to create listing' when signed out", () => {
			renderForm();
			expect(
				screen.getByRole("button", { name: /sign in to create listing/i }),
			).toBeInTheDocument();
		});

		it("shows 'Create listing' when signed in", () => {
			mockUser = { uid: "u1", email: "a@b.com" };
			renderForm();
			expect(
				screen.getByRole("button", { name: "Create listing" }),
			).toBeInTheDocument();
		});

		it("defaults type to BID", () => {
			renderForm();
			expect(screen.getByLabelText(/type/i)).toHaveValue("BID");
		});

		it("defaults price to empty", () => {
			renderForm();
			expect(screen.getByPlaceholderText("10.00")).toHaveValue(null);
		});

		it("renders both type options", () => {
			renderForm();
			const options = screen.getAllByRole("option");
			expect(options).toHaveLength(2);
			expect(options[0]).toHaveTextContent("Buy (Bid)");
			expect(options[1]).toHaveTextContent("Sell (Ask)");
		});

		it("renders the quantity disclaimer message", () => {
			renderForm();
			expect(
				screen.getByText(/quantity is fixed to 1/i),
			).toBeInTheDocument();
		});
	});

	describe("type selection", () => {
		it("can switch type to ASK", async () => {
			const user = userEvent.setup();
			renderForm();

			await user.selectOptions(screen.getByLabelText(/type/i), "ASK");
			expect(screen.getByLabelText(/type/i)).toHaveValue("ASK");
		});

		it("can switch back to BID", async () => {
			const user = userEvent.setup();
			renderForm();

			await user.selectOptions(screen.getByLabelText(/type/i), "ASK");
			await user.selectOptions(screen.getByLabelText(/type/i), "BID");
			expect(screen.getByLabelText(/type/i)).toHaveValue("BID");
		});
	});

	describe("submit when unauthenticated", () => {
		it("navigates to login with return path using collectibleId", async () => {
			mockUser = null;
			const user = userEvent.setup();
			renderForm({ collectibleId: "card-99" });

			await user.click(screen.getByRole("button"));
			expect(mockNavigate).toHaveBeenCalledWith("/auth/login", {
				state: { from: { pathname: "/collectibles/card-99" } },
			});
			expect(mockCreateListing).not.toHaveBeenCalled();
		});

		it("navigates to login with cardId fallback when collectibleId is absent", async () => {
			mockUser = null;
			const user = userEvent.setup();
			renderForm({ collectibleId: undefined, cardId: "fallback-id" });

			await user.click(screen.getByRole("button"));
			expect(mockNavigate).toHaveBeenCalledWith("/auth/login", {
				state: { from: { pathname: "/collectibles/fallback-id" } },
			});
		});
	});

	describe("dollarsToCents validation (via form submission)", () => {
		beforeEach(() => {
			mockUser = { uid: "u1", email: "a@b.com" };
		});

		it("rejects empty price", async () => {
			const user = userEvent.setup();
			renderForm();

			await user.click(screen.getByRole("button", { name: "Create listing" }));
			expect(screen.getByText("Enter a valid price.")).toBeInTheDocument();
			expect(mockCreateListing).not.toHaveBeenCalled();
		});

		it("rejects zero", async () => {
			const user = userEvent.setup();
			renderForm();

			await user.type(screen.getByPlaceholderText("10.00"), "0");
			await user.click(screen.getByRole("button", { name: "Create listing" }));
			expect(screen.getByText("Enter a valid price.")).toBeInTheDocument();
			expect(mockCreateListing).not.toHaveBeenCalled();
		});

		it("rejects negative values", async () => {
			const user = userEvent.setup();
			renderForm();

			// type="number" often blocks "-" in user-event; set value directly
			fireEvent.change(screen.getByPlaceholderText("10.00"), {
				target: { value: "-5" },
			});
			await user.click(screen.getByRole("button", { name: "Create listing" }));
			expect(screen.getByText("Enter a valid price.")).toBeInTheDocument();
			expect(mockCreateListing).not.toHaveBeenCalled();
		});

		it("converts a whole-dollar amount to cents", async () => {
			mockCreateListing.mockResolvedValueOnce({});
			const user = userEvent.setup();
			renderForm();

			await user.type(screen.getByPlaceholderText("10.00"), "25");
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			await waitFor(() => {
				expect(mockCreateListing).toHaveBeenCalledWith(
					expect.objectContaining({ priceCents: 2500 }),
				);
			});
		});

		it("converts a decimal amount to cents", async () => {
			mockCreateListing.mockResolvedValueOnce({});
			const user = userEvent.setup();
			renderForm();

			await user.type(screen.getByPlaceholderText("10.00"), "25.50");
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			await waitFor(() => {
				expect(mockCreateListing).toHaveBeenCalledWith(
					expect.objectContaining({ priceCents: 2550 }),
				);
			});
		});

		it("rounds fractional cents", async () => {
			mockCreateListing.mockResolvedValueOnce({});
			const user = userEvent.setup();
			renderForm();

			await user.type(screen.getByPlaceholderText("10.00"), "10.999");
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			await waitFor(() => {
				expect(mockCreateListing).toHaveBeenCalledWith(
					expect.objectContaining({ priceCents: 1100 }),
				);
			});
		});

		it("rejects whitespace-only price", async () => {
			const user = userEvent.setup();
			renderForm();
			const priceInput = screen.getByPlaceholderText("10.00");

			fireEvent.change(priceInput, { target: { value: "   " } });
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			expect(screen.getByText("Enter a valid price.")).toBeInTheDocument();
			expect(mockCreateListing).not.toHaveBeenCalled();
		});

		it("rejects non-numeric price", async () => {
			const user = userEvent.setup();
			renderForm();
			const priceInput = screen.getByPlaceholderText("10.00");

			fireEvent.change(priceInput, { target: { value: "abc" } });
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			expect(screen.getByText("Enter a valid price.")).toBeInTheDocument();
			expect(mockCreateListing).not.toHaveBeenCalled();
		});

		it("accepts minimum valid price (0.01)", async () => {
			mockCreateListing.mockResolvedValueOnce({});
			const user = userEvent.setup();
			renderForm();

			await user.type(screen.getByPlaceholderText("10.00"), "0.01");
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			await waitFor(() => {
				expect(mockCreateListing).toHaveBeenCalledWith(
					expect.objectContaining({ priceCents: 1 }),
				);
			});
		});
	});

	describe("successful listing creation", () => {
		it("calls createListing with the full BID payload", async () => {
			mockUser = { uid: "u1", displayName: "Alice", email: "a@b.com" };
			mockCreateListing.mockResolvedValueOnce({});
			const user = userEvent.setup();
			renderForm({ collectibleId: "card-42" });

			await user.type(screen.getByPlaceholderText("10.00"), "10");
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			await waitFor(() => {
				expect(mockCreateListing).toHaveBeenCalledWith({
					type: "BID",
					cardId: "card-42",
					priceCents: 1000,
					currency: "USD",
					quantity: 1,
					createdByUid: "u1",
					createdByDisplayName: "Alice",
				});
			});
		});

		it("sends ASK type when selected", async () => {
			mockUser = { uid: "u1", displayName: "Bob", email: "b@b.com" };
			mockCreateListing.mockResolvedValueOnce({});
			const user = userEvent.setup();
			renderForm();

			await user.selectOptions(screen.getByLabelText(/type/i), "ASK");
			await user.type(screen.getByPlaceholderText("10.00"), "99.99");
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			await waitFor(() => {
				expect(mockCreateListing).toHaveBeenCalledWith(
					expect.objectContaining({ type: "ASK", priceCents: 9999 }),
				);
			});
		});

		it("falls back to email when displayName is falsy", async () => {
			mockUser = { uid: "u2", displayName: "", email: "test@example.com" };
			mockCreateListing.mockResolvedValueOnce({});
			const user = userEvent.setup();
			renderForm();

			await user.type(screen.getByPlaceholderText("10.00"), "1");
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			await waitFor(() => {
				expect(mockCreateListing).toHaveBeenCalledWith(
					expect.objectContaining({
						createdByDisplayName: "test@example.com",
					}),
				);
			});
		});

		it("passes falsy value for createdByDisplayName when both displayName and email are falsy", async () => {
			mockUser = { uid: "u3", displayName: null, email: null };
			mockCreateListing.mockResolvedValueOnce({});
			const user = userEvent.setup();
			renderForm();

			await user.type(screen.getByPlaceholderText("10.00"), "5");
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			await waitFor(() => {
				const call = mockCreateListing.mock.calls[0][0];
				expect(call.createdByUid).toBe("u3");
				expect(call.createdByDisplayName).toBeFalsy();
			});
		});

		it("resets the price input after success", async () => {
			mockUser = { uid: "u1", displayName: "A", email: "a@b.com" };
			mockCreateListing.mockResolvedValueOnce({});
			const user = userEvent.setup();
			renderForm();

			const priceInput = screen.getByPlaceholderText("10.00");
			await user.type(priceInput, "15");
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			await waitFor(() => {
				expect(priceInput).toHaveValue(null);
			});
		});
	});

	describe("failed listing creation", () => {
		beforeEach(() => {
			mockUser = { uid: "u1", email: "a@b.com" };
			vi.spyOn(console, "error").mockImplementation(() => {});
		});

		it("shows an error message on API failure", async () => {
			mockCreateListing.mockRejectedValueOnce(new Error("network"));
			const user = userEvent.setup();
			renderForm();

			await user.type(screen.getByPlaceholderText("10.00"), "10");
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			expect(
				await screen.findByText("Failed to create listing."),
			).toBeInTheDocument();
		});

		it("logs the error to the console", async () => {
			const err = new Error("boom");
			mockCreateListing.mockRejectedValueOnce(err);
			const user = userEvent.setup();
			renderForm();

			await user.type(screen.getByPlaceholderText("10.00"), "10");
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			await waitFor(() => {
				expect(console.error).toHaveBeenCalledWith("Failed to create listing", err);
			});
		});

		it("re-enables the form after failure", async () => {
			mockCreateListing.mockRejectedValueOnce(new Error("boom"));
			const user = userEvent.setup();
			renderForm();

			await user.type(screen.getByPlaceholderText("10.00"), "10");
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			await waitFor(() => {
				expect(
					screen.getByRole("button", { name: "Create listing" }),
				).toBeEnabled();
				expect(screen.getByLabelText(/type/i)).toBeEnabled();
				expect(screen.getByPlaceholderText("10.00")).toBeEnabled();
			});
		});
	});

	describe("error clearing", () => {
		it("clears a previous validation error on the next submit", async () => {
			mockUser = { uid: "u1", email: "a@b.com" };
			mockCreateListing.mockResolvedValueOnce({});
			const user = userEvent.setup();
			renderForm();

			await user.click(screen.getByRole("button", { name: "Create listing" }));
			expect(screen.getByText("Enter a valid price.")).toBeInTheDocument();

			await user.type(screen.getByPlaceholderText("10.00"), "5");
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			await waitFor(() => {
				expect(
					screen.queryByText("Enter a valid price."),
				).not.toBeInTheDocument();
			});
		});

		it("clears a previous API error on the next submit attempt", async () => {
			mockUser = { uid: "u1", email: "a@b.com" };
			vi.spyOn(console, "error").mockImplementation(() => {});
			mockCreateListing.mockRejectedValueOnce(new Error("fail"));
			const user = userEvent.setup();
			renderForm();

			const priceInput = screen.getByPlaceholderText("10.00");
			await user.type(priceInput, "10");
			await user.click(screen.getByRole("button", { name: "Create listing" }));
			expect(
				await screen.findByText("Failed to create listing."),
			).toBeInTheDocument();

			mockCreateListing.mockResolvedValueOnce({});
			// Avoid appending to existing "10" (would become "1010")
			await user.clear(priceInput);
			await user.type(priceInput, "10");
			await user.click(screen.getByRole("button", { name: "Create listing" }));
			await waitFor(() => {
				expect(
					screen.queryByText("Failed to create listing."),
				).not.toBeInTheDocument();
			});
		});
	});

	describe("submitting state", () => {
		it("disables all inputs and the button while the request is pending", async () => {
			mockUser = { uid: "u1", email: "a@b.com" };
			let resolveCreate;
			mockCreateListing.mockImplementation(
				() => new Promise((resolve) => { resolveCreate = resolve; }),
			);
			const user = userEvent.setup();
			renderForm();

			await user.type(screen.getByPlaceholderText("10.00"), "10");
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			await waitFor(() => {
				expect(
					screen.getByRole("button", { name: "Create listing" }),
				).toBeDisabled();
				expect(screen.getByLabelText(/type/i)).toBeDisabled();
				expect(screen.getByPlaceholderText("10.00")).toBeDisabled();
			});

			resolveCreate({});
			await waitFor(() => {
				expect(
					screen.getByRole("button", { name: "Create listing" }),
				).toBeEnabled();
			});
		});
	});

	describe("prop handling (collectibleId vs cardId)", () => {
		beforeEach(() => {
			mockUser = { uid: "u1", displayName: "A", email: "a@b.com" };
			mockCreateListing.mockResolvedValue({});
		});

		it("prefers collectibleId over cardId", async () => {
			const user = userEvent.setup();
			renderForm({ collectibleId: "preferred", cardId: "fallback" });

			await user.type(screen.getByPlaceholderText("10.00"), "5");
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			await waitFor(() => {
				expect(mockCreateListing).toHaveBeenCalledWith(
					expect.objectContaining({ cardId: "preferred" }),
				);
			});
		});

		it("uses cardId when collectibleId is undefined", async () => {
			const user = userEvent.setup();
			renderForm({ collectibleId: undefined, cardId: "fallback-id" });

			await user.type(screen.getByPlaceholderText("10.00"), "5");
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			await waitFor(() => {
				expect(mockCreateListing).toHaveBeenCalledWith(
					expect.objectContaining({ cardId: "fallback-id" }),
				);
			});
		});

		it("uses cardId when collectibleId is null", async () => {
			const user = userEvent.setup();
			renderForm({ collectibleId: null, cardId: "null-fallback" });

			await user.type(screen.getByPlaceholderText("10.00"), "5");
			await user.click(screen.getByRole("button", { name: "Create listing" }));

			await waitFor(() => {
				expect(mockCreateListing).toHaveBeenCalledWith(
					expect.objectContaining({ cardId: "null-fallback" }),
				);
			});
		});
	});
});
