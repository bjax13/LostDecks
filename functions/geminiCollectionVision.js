"use strict";

const EXTRACTION_PROMPT = `You identify individual Stormlight Lost Tales Story Deck trading cards and ChasmFriends enamel pins visible in collector photos.

Return JSON only. For each distinct card or pin you can see, output one object in "items" with:
- name: visible title or pin name text (string)
- printedId: hyphenated catalog id when visible, e.g. LT24-ELS-01-DUN or PIN-CF-01 (string or null)
- set: set code such as LT24 when visible (string or null)
- number: card or pin number as printed (string or null)
- finish: finish or foil such as DUN, FOIL, or null for pins (string or null)
- variant: nonsense or variant caption when visible (string or null)
- kind: "card" or "pin"
- confidence: 0 to 1 how sure you are about the identity fields you filled

Do not invent SKUs. If unsure, lower confidence and leave printedId null. Ignore sleeves, binders, and background clutter.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          printedId: { type: "string", nullable: true },
          set: { type: "string", nullable: true },
          number: { type: "string", nullable: true },
          finish: { type: "string", nullable: true },
          variant: { type: "string", nullable: true },
          kind: { type: "string", enum: ["card", "pin"] },
          confidence: { type: "number" },
        },
        required: ["name", "kind", "confidence"],
      },
    },
  },
  required: ["items"],
};

/**
 * @param {unknown} raw
 */
function normalizeExtractionItems(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.items)) {
    return [];
  }
  return raw.items
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const name = typeof item.name === "string" ? item.name.trim() : "";
      const kind = item.kind === "pin" ? "pin" : item.kind === "card" ? "card" : null;
      const confidence = Number(item.confidence);
      if (!name || !kind || !Number.isFinite(confidence)) {
        return null;
      }
      return {
        name,
        printedId:
          typeof item.printedId === "string" && item.printedId.trim()
            ? item.printedId.trim().toUpperCase()
            : null,
        set: typeof item.set === "string" && item.set.trim() ? item.set.trim().toUpperCase() : null,
        number: typeof item.number === "string" && item.number.trim() ? item.number.trim() : null,
        finish:
          typeof item.finish === "string" && item.finish.trim()
            ? item.finish.trim().toUpperCase()
            : null,
        variant:
          typeof item.variant === "string" && item.variant.trim() ? item.variant.trim() : null,
        kind,
        confidence: Math.max(0, Math.min(1, confidence)),
      };
    })
    .filter(Boolean);
}

/**
 * @param {{
 *   apiKey: string,
 *   model?: string,
 *   clientFactory?: (apiKey: string) => { getGenerativeModel: Function },
 * }} deps
 * @param {{ mimeType: string, dataBase64: string }[]} images
 */
async function extractCollectiblesFromImages(deps, images) {
  const modelName = deps.model || process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
  const factory =
    deps.clientFactory ||
    ((apiKey) => {
      // Lazy require so unit tests never load the SDK unless needed.
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      return new GoogleGenerativeAI(apiKey);
    });

  const client = factory(deps.apiKey);
  const model = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  });

  const parts = [
    {
      text: EXTRACTION_PROMPT,
    },
    ...images.map((image) => ({
      inlineData: {
        mimeType: image.mimeType,
        data: image.dataBase64,
      },
    })),
  ];

  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
  });
  const text = result?.response?.text?.() ?? "";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned non-JSON content.");
  }
  return {
    items: normalizeExtractionItems(parsed),
    model: modelName,
    rawTokenEstimate: {
      inputImages: images.length,
      outputItems: normalizeExtractionItems(parsed).length,
    },
  };
}

module.exports = {
  EXTRACTION_PROMPT,
  RESPONSE_SCHEMA,
  normalizeExtractionItems,
  extractCollectiblesFromImages,
};
