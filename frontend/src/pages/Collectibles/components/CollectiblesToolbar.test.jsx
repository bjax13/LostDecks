import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { sortOptions } from "../constants.js";
import CollectiblesToolbar from "./CollectiblesToolbar.jsx";

const stories = [
  { code: "red", title: "Red Riding Hood" },
  { code: "snow", title: "Snow White" },
];

const rarityOptions = ["Common", "Uncommon", "Rare", "Epic"];

function renderToolbar(overrides = {}) {
  const props = {
    searchTerm: "",
    onSearchChange: vi.fn(),
    categoryFilter: "all",
    onCategoryChange: vi.fn(),
    storyFilter: "all",
    onStoryChange: vi.fn(),
    rarityFilter: "all",
    onRarityChange: vi.fn(),
    sortField: "number",
    onSortFieldChange: vi.fn(),
    sortDirection: "asc",
    onToggleSortDirection: vi.fn(),
    rarityOptions,
    stories,
    resultCount: 42,
    totalCount: 100,
    onReset: vi.fn(),
    ...overrides,
  };
  return {
    ...props,
    ...render(<CollectiblesToolbar {...props} />),
  };
}

describe("CollectiblesToolbar", () => {
  describe("structure and layout", () => {
    it("renders a section with cards-toolbar class", () => {
      const { container } = renderToolbar();
      const section = container.querySelector("section.cards-toolbar");
      expect(section).toBeInTheDocument();
    });

    it("renders search input with correct id, type, and placeholder", () => {
      renderToolbar();
      const input = screen.getByLabelText("Search");
      expect(input).toHaveAttribute("id", "collectible-search");
      expect(input).toHaveAttribute("type", "search");
      expect(input).toHaveAttribute("placeholder", "Search by ID, story, or variant");
    });

    it("renders filter controls with correct ids for accessibility", () => {
      renderToolbar();
      expect(screen.getByLabelText("Category")).toHaveAttribute("id", "category-filter");
      expect(screen.getByLabelText("Story")).toHaveAttribute("id", "story-filter");
      expect(screen.getByLabelText("Rarity")).toHaveAttribute("id", "rarity-filter");
      expect(screen.getByLabelText("Sort by")).toHaveAttribute("id", "sort-by");
    });

    it("renders sort direction button with descriptive aria-label", () => {
      renderToolbar({ sortDirection: "asc" });
      expect(screen.getByRole("button", { name: "Sort ascending" })).toBeInTheDocument();

      renderToolbar({ sortDirection: "desc" });
      expect(screen.getByRole("button", { name: "Sort descending" })).toBeInTheDocument();
    });
  });

  describe("search input", () => {
    it("renders with the current search term", () => {
      renderToolbar({ searchTerm: "dragon" });
      expect(screen.getByLabelText("Search")).toHaveValue("dragon");
    });

    it("calls onSearchChange with the typed value", async () => {
      const user = userEvent.setup();
      const props = renderToolbar();
      const input = screen.getByLabelText("Search");

      await user.type(input, "hello");
      expect(props.onSearchChange).toHaveBeenCalledWith("h");
      expect(props.onSearchChange).toHaveBeenCalledTimes(5);
    });

    it("clears search via the native clear action", async () => {
      const user = userEvent.setup();
      const props = renderToolbar({ searchTerm: "old" });
      const input = screen.getByLabelText("Search");

      await user.clear(input);
      expect(props.onSearchChange).toHaveBeenCalledWith("");
    });
  });

  describe("category filter", () => {
    it("renders all category options", () => {
      renderToolbar();
      const select = screen.getByLabelText("Category");
      const options = within(select).getAllByRole("option");

      expect(options.map((o) => o.value)).toEqual(["all", "story", "herald", "nonsense"]);
    });

    it("reflects the current category", () => {
      renderToolbar({ categoryFilter: "herald" });
      expect(screen.getByLabelText("Category")).toHaveValue("herald");
    });

    it("renders category option labels", () => {
      renderToolbar();
      const select = screen.getByLabelText("Category");
      const options = within(select).getAllByRole("option");
      expect(options[0]).toHaveTextContent("All categories");
      expect(options[1]).toHaveTextContent("Story cards");
      expect(options[2]).toHaveTextContent("Heralds");
      expect(options[3]).toHaveTextContent("Nonsense variants");
    });

    it("calls onCategoryChange when selection changes", async () => {
      const user = userEvent.setup();
      const props = renderToolbar();

      await user.selectOptions(screen.getByLabelText("Category"), "nonsense");
      expect(props.onCategoryChange).toHaveBeenCalledWith("nonsense");
    });

    it("calls onCategoryChange for story, herald, and all", async () => {
      const user = userEvent.setup();
      const props = renderToolbar();

      await user.selectOptions(screen.getByLabelText("Category"), "story");
      expect(props.onCategoryChange).toHaveBeenCalledWith("story");

      await user.selectOptions(screen.getByLabelText("Category"), "herald");
      expect(props.onCategoryChange).toHaveBeenCalledWith("herald");

      await user.selectOptions(screen.getByLabelText("Category"), "all");
      expect(props.onCategoryChange).toHaveBeenCalledWith("all");
    });
  });

  describe("story filter", () => {
    it("renders dynamic story options plus static ones", () => {
      renderToolbar();
      const select = screen.getByLabelText("Story");
      const options = within(select).getAllByRole("option");

      expect(options).toHaveLength(stories.length + 2);
      expect(options[0]).toHaveTextContent("All stories");
      expect(options[1]).toHaveTextContent("Red Riding Hood");
      expect(options[2]).toHaveTextContent("Snow White");
      expect(options[options.length - 1]).toHaveTextContent("Heralds only");
    });

    it("reflects the current story filter", () => {
      renderToolbar({ storyFilter: "snow" });
      expect(screen.getByLabelText("Story")).toHaveValue("snow");
    });

    it("calls onStoryChange when selection changes", async () => {
      const user = userEvent.setup();
      const props = renderToolbar();

      await user.selectOptions(screen.getByLabelText("Story"), "red");
      expect(props.onStoryChange).toHaveBeenCalledWith("red");
    });

    it("calls onStoryChange for Heralds only option", async () => {
      const user = userEvent.setup();
      const props = renderToolbar();

      await user.selectOptions(screen.getByLabelText("Story"), "heralds");
      expect(props.onStoryChange).toHaveBeenCalledWith("heralds");
    });

    it("reflects heralds filter when selected", () => {
      renderToolbar({ storyFilter: "heralds" });
      expect(screen.getByLabelText("Story")).toHaveValue("heralds");
    });
  });

  describe("rarity filter", () => {
    it("renders dynamic rarity options plus static ones", () => {
      renderToolbar();
      const select = screen.getByLabelText("Rarity");
      const options = within(select).getAllByRole("option");

      expect(options).toHaveLength(rarityOptions.length + 2);
      expect(options[0]).toHaveTextContent("All rarities");
      expect(options[options.length - 1]).toHaveTextContent("No rarity (nonsense)");
    });

    it("reflects the current rarity filter", () => {
      renderToolbar({ rarityFilter: "Rare" });
      expect(screen.getByLabelText("Rarity")).toHaveValue("Rare");
    });

    it("calls onRarityChange when selection changes", async () => {
      const user = userEvent.setup();
      const props = renderToolbar();

      await user.selectOptions(screen.getByLabelText("Rarity"), "Epic");
      expect(props.onRarityChange).toHaveBeenCalledWith("Epic");
    });

    it("calls onRarityChange for No rarity (nonsense) option", async () => {
      const user = userEvent.setup();
      const props = renderToolbar();

      await user.selectOptions(screen.getByLabelText("Rarity"), "none");
      expect(props.onRarityChange).toHaveBeenCalledWith("none");
    });

    it("reflects none filter when selected", () => {
      renderToolbar({ rarityFilter: "none" });
      expect(screen.getByLabelText("Rarity")).toHaveValue("none");
    });
  });

  describe("sort controls", () => {
    it("renders all sort options from constants", () => {
      renderToolbar();
      const select = screen.getByLabelText("Sort by");
      const options = within(select).getAllByRole("option");

      expect(options.map((o) => o.value)).toEqual(sortOptions.map((o) => o.value));
      expect(options.map((o) => o.textContent)).toEqual(sortOptions.map((o) => o.label));
    });

    it("reflects the current sort field", () => {
      renderToolbar({ sortField: "rarity" });
      expect(screen.getByLabelText("Sort by")).toHaveValue("rarity");
    });

    it("calls onSortFieldChange when selection changes", async () => {
      const user = userEvent.setup();
      const props = renderToolbar();

      await user.selectOptions(screen.getByLabelText("Sort by"), "story");
      expect(props.onSortFieldChange).toHaveBeenCalledWith("story");
    });

    it("calls onSortFieldChange for each sort option from constants", async () => {
      const user = userEvent.setup();
      for (let i = 0; i < sortOptions.length; i++) {
        cleanup();
        const option = sortOptions[i];
        const prevOption = sortOptions[(i + 1) % sortOptions.length];
        const onSortFieldChange = vi.fn();
        renderToolbar({
          onSortFieldChange,
          sortField: prevOption.value,
        });
        await user.selectOptions(screen.getByLabelText("Sort by"), option.value);
        expect(onSortFieldChange).toHaveBeenCalledWith(option.value);
      }
    });

    it("sort direction button has sort-direction class", () => {
      renderToolbar();
      const button = screen.getByRole("button", {
        name: "Sort ascending",
      });
      expect(button).toHaveClass("sort-direction");
    });

    it("shows ascending arrow and label when sortDirection is asc", () => {
      renderToolbar({ sortDirection: "asc" });
      const button = screen.getByRole("button", {
        name: "Sort ascending",
      });
      expect(button).toHaveTextContent("↑");
    });

    it("shows descending arrow and label when sortDirection is desc", () => {
      renderToolbar({ sortDirection: "desc" });
      const button = screen.getByRole("button", {
        name: "Sort descending",
      });
      expect(button).toHaveTextContent("↓");
    });

    it("calls onToggleSortDirection when the direction button is clicked", async () => {
      const user = userEvent.setup();
      const props = renderToolbar();

      await user.click(screen.getByRole("button", { name: "Sort ascending" }));
      expect(props.onToggleSortDirection).toHaveBeenCalledOnce();
    });
  });

  describe("toolbar footer", () => {
    it("displays result and total counts", () => {
      renderToolbar({ resultCount: 7, totalCount: 250 });
      expect(screen.getByText(/showing/i).textContent).toBe("Showing 7 of 250 collectibles");
    });

    it("calls onReset when the reset button is clicked", async () => {
      const user = userEvent.setup();
      const props = renderToolbar();

      await user.click(screen.getByRole("button", { name: /reset filters/i }));
      expect(props.onReset).toHaveBeenCalledOnce();
    });

    it("reset button has reset-button class", () => {
      renderToolbar();
      const button = screen.getByRole("button", {
        name: /reset filters/i,
      });
      expect(button).toHaveClass("reset-button");
    });
  });

  describe("edge cases", () => {
    it("renders with empty stories and rarityOptions", () => {
      renderToolbar({ stories: [], rarityOptions: [] });

      const storyOptions = within(screen.getByLabelText("Story")).getAllByRole("option");
      expect(storyOptions).toHaveLength(2);

      const rarityOpts = within(screen.getByLabelText("Rarity")).getAllByRole("option");
      expect(rarityOpts).toHaveLength(2);
    });

    it("renders zero counts", () => {
      renderToolbar({ resultCount: 0, totalCount: 0 });
      expect(screen.getByText(/showing/i).textContent).toBe("Showing 0 of 0 collectibles");
    });

    it("displays counts with strong emphasis", () => {
      renderToolbar({ resultCount: 5, totalCount: 100 });
      const resultStrong = screen.getByText("5").closest("strong");
      const totalStrong = screen.getByText("100").closest("strong");
      expect(resultStrong).toBeInTheDocument();
      expect(totalStrong).toBeInTheDocument();
    });
  });

  describe("onChange handler behavior", () => {
    it("onSearchChange receives event.target.value (typed character)", async () => {
      const user = userEvent.setup();
      const onSearchChange = vi.fn();
      renderToolbar({ onSearchChange });

      await user.type(screen.getByLabelText("Search"), "x");
      expect(onSearchChange).toHaveBeenLastCalledWith("x");
    });

    it("all callback props are invoked with correct values", async () => {
      const user = userEvent.setup();
      const callbacks = {
        onSearchChange: vi.fn(),
        onCategoryChange: vi.fn(),
        onStoryChange: vi.fn(),
        onRarityChange: vi.fn(),
        onSortFieldChange: vi.fn(),
        onToggleSortDirection: vi.fn(),
        onReset: vi.fn(),
      };
      renderToolbar(callbacks);

      await user.type(screen.getByLabelText("Search"), "test");
      expect(callbacks.onSearchChange).toHaveBeenCalled();

      await user.selectOptions(screen.getByLabelText("Category"), "story");
      expect(callbacks.onCategoryChange).toHaveBeenCalledWith("story");

      await user.selectOptions(screen.getByLabelText("Story"), "red");
      expect(callbacks.onStoryChange).toHaveBeenCalledWith("red");

      await user.selectOptions(screen.getByLabelText("Rarity"), "Common");
      expect(callbacks.onRarityChange).toHaveBeenCalledWith("Common");

      await user.selectOptions(screen.getByLabelText("Sort by"), "id");
      expect(callbacks.onSortFieldChange).toHaveBeenCalledWith("id");

      await user.click(screen.getByRole("button", { name: "Sort ascending" }));
      expect(callbacks.onToggleSortDirection).toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: /reset filters/i }));
      expect(callbacks.onReset).toHaveBeenCalled();
    });
  });
});
