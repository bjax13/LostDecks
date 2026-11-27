"use strict";

const { defineSecret } = require("firebase-functions/params");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { enforceCallCooldown } = require("./rateLimit");
const { loadAiPhotoImportCaps, ESTIMATED_USD_PER_IMAGE } = require("./aiPhotoImportConfig");
const { enforceAiPhotoImportCaps } = require("./aiPhotoImportCaps");
const { validateAnalyzeImagesInput } = require("./aiPhotoImportValidation");
const { extractCollectiblesFromImages } = require("./geminiCollectionVision");

const geminiApiKey = defineSecret("GEMINI_API_KEY");

const RUNNING_IN_EMULATOR = process.env.FUNCTIONS_EMULATOR === "true";
const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === "true" && !RUNNING_IN_EMULATOR;

/** @type {((images: { mimeType: string, dataBase64: string }[]) => Promise<{ items: unknown[] }>) | null} */
let visionExtractOverride = null;

function uidOrEmpty(value) {
  return typeof value === "string" ? value : "";
}

/**
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 */
async function analyzeCollectionPhotosHandler(request, admin) {
  const callerUid = uidOrEmpty(request.auth?.uid);
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Sign in to use AI photo import.");
  }

  const images = validateAnalyzeImagesInput(request.data?.images);
  const db = admin.firestore();

  await enforceCallCooldown(db, callerUid, {
    minIntervalMs: 2000,
    maxPerWindow: 30,
    windowMs: 3_600_000,
  });

  const caps = await loadAiPhotoImportCaps(db);
  await enforceAiPhotoImportCaps(db, callerUid, images.length, Date.now(), { caps });

  let extraction;
  if (visionExtractOverride) {
    extraction = await visionExtractOverride(images);
  } else {
    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "AI photo import is not configured yet. Try again later.",
      );
    }
    try {
      extraction = await extractCollectiblesFromImages({ apiKey }, images);
    } catch (err) {
      console.error("analyzeCollectionPhotos: vision failed", { uid: callerUid, err });
      throw new HttpsError("internal", "Could not analyze photos. Please try again.");
    }
  }

  const estimatedCostUsd = Number((images.length * ESTIMATED_USD_PER_IMAGE).toFixed(4));

  return {
    extractions: extraction.items,
    meta: {
      imageCount: images.length,
      itemCount: extraction.items.length,
      estimatedCostUsd,
      model: extraction.model ?? null,
    },
  };
}

const analyzeCollectionPhotos = onCall(
  {
    secrets: [geminiApiKey],
    enforceAppCheck: ENFORCE_APP_CHECK,
    maxInstances: 5,
    timeoutSeconds: 120,
  },
  async (request) => {
    const admin = require("firebase-admin");
    try {
      console.info(request.app ? "appcheck:ok" : "appcheck:missing");
      return await analyzeCollectionPhotosHandler(request, admin);
    } catch (err) {
      if (err instanceof HttpsError) {
        throw err;
      }
      console.error("analyzeCollectionPhotos failed", { err });
      throw new HttpsError("internal", "Could not analyze photos. Please try again.");
    }
  },
);

module.exports = {
  analyzeCollectionPhotos,
  analyzeCollectionPhotosHandler,
  geminiApiKey,
  __test: {
    setVisionExtractOverride(fn) {
      visionExtractOverride = typeof fn === "function" ? fn : null;
    },
    validateAnalyzeImagesInput,
  },
};
