"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { HttpsError } = require("firebase-functions/v2/https");
const { evaluateAiPhotoImportCaps, utcDayKey } = require("./aiPhotoImportCaps");
const { validateAnalyzeImagesInput } = require("./aiPhotoImportValidation");
const { normalizeExtractionItems } = require("./geminiCollectionVision");
const { resolveCapsFromConfig } = require("./aiPhotoImportConfig");
const { analyzeCollectionPhotosHandler, __test: aiPhotoImportTest } = require("./aiPhotoImport");

const tinyPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const caps = resolveCapsFromConfig(null);

test("validateAnalyzeImagesInput accepts one small png", () => {
  const images = validateAnalyzeImagesInput([{ mimeType: "image/png", dataBase64: tinyPng }]);
  assert.equal(images.length, 1);
});

test("validateAnalyzeImagesInput rejects unsupported mime type", () => {
  assert.throws(() => validateAnalyzeImagesInput([{ mimeType: "image/gif", dataBase64: tinyPng }]));
});

test("validateAnalyzeImagesInput rejects more than six images", () => {
  const many = Array.from({ length: 7 }, () => ({
    mimeType: "image/png",
    dataBase64: tinyPng,
  }));
  assert.throws(() => validateAnalyzeImagesInput(many));
});

test("evaluateAiPhotoImportCaps blocks global cap and marks disabled", () => {
  const now = Date.UTC(2026, 10, 27, 12, 0, 0);
  const result = evaluateAiPhotoImportCaps({
    caps,
    userState: null,
    globalState: {
      dailyDate: utcDayKey(now),
      dailyCount: caps.globalDailyCap,
      featureDisabled: false,
    },
    now,
    imageCount: 1,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "global-daily-cap");
  assert.equal(result.nextGlobalState.featureDisabled, true);
});

test("evaluateAiPhotoImportCaps re-enables on the next UTC day after global latch", () => {
  const dayN = Date.UTC(2026, 10, 27, 23, 0, 0);
  const dayNPlus1 = Date.UTC(2026, 10, 28, 1, 0, 0);
  const latchedGlobal = {
    dailyDate: utcDayKey(dayN),
    dailyCount: caps.globalDailyCap,
    featureDisabled: true,
  };

  const blocked = evaluateAiPhotoImportCaps({
    caps,
    userState: null,
    globalState: latchedGlobal,
    now: dayN,
    imageCount: 1,
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "global-daily-cap");

  const nextDay = evaluateAiPhotoImportCaps({
    caps,
    userState: null,
    globalState: latchedGlobal,
    now: dayNPlus1,
    imageCount: 1,
  });
  assert.equal(nextDay.allowed, true);
  assert.equal(nextDay.nextGlobalState.dailyDate, utcDayKey(dayNPlus1));
  assert.equal(nextDay.nextGlobalState.dailyCount, 1);
  assert.equal(nextDay.nextGlobalState.featureDisabled, false);
});

test("evaluateAiPhotoImportCaps blocks user daily cap", () => {
  const now = Date.UTC(2026, 10, 27, 12, 0, 0);
  const result = evaluateAiPhotoImportCaps({
    caps,
    userState: {
      dailyDate: utcDayKey(now),
      dailyCount: caps.perUserDailyCap,
      monthlyMonth: "2026-11",
      monthlyCount: 1,
    },
    globalState: { dailyDate: utcDayKey(now), dailyCount: 0, featureDisabled: false },
    now,
    imageCount: 1,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "user-daily-cap");
});

test("normalizeExtractionItems filters invalid rows", () => {
  const items = normalizeExtractionItems({
    items: [
      { name: "Elsecaller #01", kind: "card", confidence: 0.8, printedId: "LT24-ELS-01-DUN" },
      { name: "", kind: "card", confidence: 0.5 },
      { name: "Pin", kind: "pin", confidence: 2 },
    ],
  });
  assert.equal(items.length, 2);
  assert.equal(items[0].printedId, "LT24-ELS-01-DUN");
});

describe("analyzeCollectionPhotosHandler", () => {
  test("requires auth", async () => {
    await assert.rejects(
      () => analyzeCollectionPhotosHandler({ auth: null, data: {} }, { firestore: () => ({}) }),
      (err) => err instanceof HttpsError && err.code === "unauthenticated",
    );
  });

  test("returns extractions when vision and caps succeed", async () => {
    aiPhotoImportTest.setVisionExtractOverride(async () => ({
      items: [{ name: "Test", kind: "card", confidence: 0.9, printedId: "LT24-ELS-01-DUN" }],
      model: "test-model",
    }));

    const store = new Map();
    const docRef = (collection, id) => ({ path: `${collection}/${id}` });
    const runTransaction = async (fn) => {
      await fn({
        get: async (ref) => {
          const data = store.get(ref.path);
          return {
            exists: data != null,
            data: () => data,
          };
        },
        set: (ref, data) => {
          store.set(ref.path, data);
        },
      });
    };
    const db = {
      collection: (name) => ({
        doc: (id) => docRef(name, id),
        get: async () => ({ exists: false }),
      }),
      runTransaction,
    };
    db.collection = (name) => {
      if (name === "config") {
        return {
          doc: () => ({
            get: async () => ({ exists: false }),
          }),
        };
      }
      return {
        doc: (id) => docRef(name, id),
      };
    };

    const admin = {
      firestore: () => db,
    };

    const response = await analyzeCollectionPhotosHandler(
      {
        auth: { uid: "user-1" },
        data: { images: [{ mimeType: "image/png", dataBase64: tinyPng }] },
        app: {},
      },
      admin,
    );

    assert.equal(response.extractions.length, 1);
    assert.equal(response.meta.imageCount, 1);
    assert.ok(response.meta.estimatedCostUsd > 0);

    aiPhotoImportTest.setVisionExtractOverride(null);
  });
});
