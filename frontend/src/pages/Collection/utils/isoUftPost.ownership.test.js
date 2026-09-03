import { describe, expect, it } from "vitest";
import { buildIsoUftPost, buildIsoUftPostTree, formatIsoUftPost } from "./isoUftPost.js";

const CHASM_TITLE = "The Chasmfriends get a Pet!";

function numberedItems(line) {
  const [, list] = line.split(": ");
  return (list ?? "")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value));
}

describe("isoUftPost ownership (#107)", () => {
  it("builds a Chasm Dun want list from a single owned SKU instead of dumping the catalog", () => {
    const { tree } = buildIsoUftPostTree([{ skuId: "LT24-CHM-01-DUN", quantity: 1 }]);
    const iso = tree.find((node) => node.id === "iso");
    const uft = tree.find((node) => node.id === "uft");

    expect(iso.children.map((section) => section.id)).toEqual(["iso:story-dun"]);
    expect(uft.children).toHaveLength(0);

    const chasmDun = iso.children[0].children.find((leaf) => leaf.label === CHASM_TITLE);
    expect(chasmDun).toBeDefined();
    const wantedNumbers = numberedItems(chasmDun.line);
    expect(wantedNumbers).not.toContain(1);
    expect(wantedNumbers).toContain(2);
    expect(wantedNumbers.length).toBeGreaterThan(1);

    const text = formatIsoUftPost(tree);
    expect(text).toContain("ISO:");
    expect(text).toContain("Story Dun:");
    expect(text).not.toContain("Story Foils:");
    expect(text).not.toContain("Heralds");
    expect(text).not.toContain("Nonsense");
    expect(text).not.toContain("Pins");
    expect(text).not.toContain("Elsecaller");
    expect(text).not.toContain("King Lopen");
    expect(text.split("\n").length).toBeLessThan(20);
    expect(text).toContain("UFT:");
    expect(text).toContain("None available yet.");
  });

  it("matches owned SKUs case-insensitively and still omits other finishes of that card", () => {
    const { tree, text } = (() => {
      const built = buildIsoUftPostTree([{ skuId: "lt24-chm-01-dun", quantity: "1" }]);
      return { tree: built.tree, text: formatIsoUftPost(built.tree) };
    })();

    expect(tree[0].children.map((section) => section.id)).toEqual(["iso:story-dun"]);
    const chasmDun = tree[0].children[0].children.find((leaf) => leaf.label === CHASM_TITLE);
    expect(numberedItems(chasmDun.line)).not.toContain(1);
    expect(text).not.toContain("Story Foils:");
  });

  it("excludes every finish of an owned card from ISO even when that finish section is started", () => {
    const { text } = buildIsoUftPost([
      { skuId: "LT24-CHM-01-DUN", quantity: 1 },
      { skuId: "LT24-CHM-02-FOIL", quantity: 1 },
    ]);
    const [isoBlock] = text.split("UFT:");
    const dunLine = isoBlock.split("\n").find((line) => line.startsWith(`${CHASM_TITLE} Dun:`));
    const foilLine = isoBlock.split("\n").find((line) => line.startsWith(`${CHASM_TITLE} Foils:`));

    expect(numberedItems(dunLine)).not.toContain(1);
    expect(numberedItems(dunLine)).not.toContain(2);
    expect(numberedItems(foilLine)).not.toContain(1);
    expect(numberedItems(foilLine)).not.toContain(2);
  });

  it("lists only duplicate SKUs as UFT and excludes those SKUs from ISO", () => {
    const { text } = buildIsoUftPost([
      { skuId: "LT24-CHM-01-DUN", quantity: 1 },
      { skuId: "LT24-CHM-02-DUN", quantity: 3 },
    ]);
    const [isoBlock, uftBlock] = text.split("UFT:");
    const isoNumbers = numberedItems(
      isoBlock.split("\n").find((line) => line.startsWith(`${CHASM_TITLE} Dun:`)),
    );
    const uftNumbers = numberedItems(
      uftBlock.split("\n").find((line) => line.startsWith(`${CHASM_TITLE} Dun:`)),
    );

    expect(isoNumbers).not.toContain(1);
    expect(isoNumbers).not.toContain(2);
    expect(isoNumbers).toContain(3);
    expect(uftNumbers).toEqual([2]);
  });
});
