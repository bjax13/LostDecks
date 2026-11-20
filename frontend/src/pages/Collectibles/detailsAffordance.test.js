import { describe, expect, it } from "vitest";
import "../Collection/Collection.css";
import "./Collectibles.css";

function mediaRulesCoveringPhone() {
  const matched = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = [...sheet.cssRules];
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (rule.type !== CSSRule.MEDIA_RULE) {
        continue;
      }
      const media = rule.conditionText || rule.media?.mediaText || "";
      const max = /max-width:\s*(\d+)px/.exec(media);
      if (!max || Number(max[1]) < 390) {
        continue;
      }
      matched.push(rule);
    }
  }
  return matched;
}

function declaredMinHeightPx(selectorPart) {
  let found = 0;
  for (const media of mediaRulesCoveringPhone()) {
    for (const inner of media.cssRules) {
      if (!inner.selectorText?.includes(selectorPart) || !inner.style?.minHeight) {
        continue;
      }
      const raw = inner.style.minHeight;
      const value = raw.endsWith("rem") ? Number.parseFloat(raw) * 16 : Number.parseFloat(raw);
      found = Math.max(found, value);
    }
  }
  return found;
}

function declaredOrder(selectorPart) {
  for (const media of mediaRulesCoveringPhone()) {
    for (const inner of media.cssRules) {
      if (inner.selectorText?.includes(selectorPart) && inner.style?.order) {
        return Number(inner.style.order);
      }
    }
  }
  return null;
}

describe("details affordance on a phone", () => {
  it("keeps the details link at least 44px tall at 390px", () => {
    expect(declaredMinHeightPx(".card-details-link")).toBeGreaterThanOrEqual(44);
    expect(declaredMinHeightPx(".details-affordance")).toBeGreaterThanOrEqual(44);
  });

  it("places the collection details link ahead of the quantity buttons", () => {
    const detailsOrder = declaredOrder("collection-table__details");
    const actionsOrder = declaredOrder('data-label="Actions"');
    expect(detailsOrder).not.toBeNull();
    expect(actionsOrder).not.toBeNull();
    expect(detailsOrder).toBeLessThan(actionsOrder);
  });

  it("gives the phone collection details cell the full card width", () => {
    let width = null;
    for (const media of mediaRulesCoveringPhone()) {
      for (const inner of media.cssRules) {
        if (
          inner.selectorText?.includes("collection-table__details") &&
          inner.style?.maxWidth === "100%"
        ) {
          width = inner.style.maxWidth;
        }
      }
    }
    expect(width).toBe("100%");
  });
});
