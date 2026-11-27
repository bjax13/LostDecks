"use strict";

const MAX_EXTRACTION_ITEMS = 50;
const MAX_STRING_LENGTH = {
  name: 200,
  printedId: 64,
  set: 16,
  number: 32,
  finish: 16,
  variant: 200,
};

function clampString(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

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
      maxItems: MAX_EXTRACTION_ITEMS,
      items: {
        type: "object",
        properties: {
          name: { type: "string", maxLength: MAX_STRING_LENGTH.name },
          printedId: { type: "string", nullable: true, maxLength: MAX_STRING_LENGTH.printedId },
          set: { type: "string", nullable: true, maxLength: MAX_STRING_LENGTH.set },
          number: { type: "string", nullable: true, maxLength: MAX_STRING_LENGTH.number },
          finish: { type: "string", nullable: true, maxLength: MAX_STRING_LENGTH.finish },
          variant: { type: "string", nullable: true, maxLength: MAX_STRING_LENGTH.variant },
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
    .slice(0, MAX_EXTRACTION_ITEMS)
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const name = clampString(item.name, MAX_STRING_LENGTH.name);
      const kind = item.kind === "pin" ? "pin" : item.kind === "card" ? "card" : null;
      const confidence = Number(item.confidence);
      if (!name || !kind || !Number.isFinite(confidence)) {
        return null;
      }
      const printedIdRaw = clampString(item.printedId, MAX_STRING_LENGTH.printedId);
      const setRaw = clampString(item.set, MAX_STRING_LENGTH.set);
      const numberRaw = clampString(item.number, MAX_STRING_LENGTH.number);
      const finishRaw = clampString(item.finish, MAX_STRING_LENGTH.finish);
      const variantRaw = clampString(item.variant, MAX_STRING_LENGTH.variant);
      return {
        name,
        printedId: printedIdRaw ? printedIdRaw.toUpperCase() : null,
        set: setRaw ? setRaw.toUpperCase() : null,
        number: numberRaw || null,
        finish: finishRaw ? finishRaw.toUpperCase() : null,
        variant: variantRaw || null,
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
  MAX_EXTRACTION_ITEMS,
  MAX_STRING_LENGTH,
  normalizeExtractionItems,
  extractCollectiblesFromImages,
};
