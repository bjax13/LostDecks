"use strict";

const { HttpsError } = require("firebase-functions/v2/https");

const MAX_IMAGES_PER_REQUEST = 6;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/** Total decoded payload across all images (stays under callable body limits). */
const MAX_TOTAL_DECODED_BYTES = 7 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * @param {unknown} images
 * @returns {{ mimeType: string, dataBase64: string }[]}
 */
function validateAnalyzeImagesInput(images) {
  if (!Array.isArray(images)) {
    throw new HttpsError("invalid-argument", "images must be a non-empty array.");
  }
  if (images.length < 1) {
    throw new HttpsError("invalid-argument", "Upload at least one photo.");
  }
  if (images.length > MAX_IMAGES_PER_REQUEST) {
    throw new HttpsError(
      "invalid-argument",
      `You can send at most ${MAX_IMAGES_PER_REQUEST} photos per request.`,
    );
  }

  /** @type {{ mimeType: string, dataBase64: string }[]} */
  const normalized = [];
  let totalDecodedBytes = 0;

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    if (!image || typeof image !== "object") {
      throw new HttpsError("invalid-argument", `Image ${index + 1} is invalid.`);
    }
    const mimeType = typeof image.mimeType === "string" ? image.mimeType.trim().toLowerCase() : "";
    const dataBase64 = typeof image.dataBase64 === "string" ? image.dataBase64.trim() : "";
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new HttpsError("invalid-argument", `Image ${index + 1} must be JPEG, PNG, or WebP.`);
    }
    if (!dataBase64 || !/^[A-Za-z0-9+/=]+$/.test(dataBase64)) {
      throw new HttpsError("invalid-argument", `Image ${index + 1} payload is invalid.`);
    }
    let bytes;
    try {
      bytes = Buffer.from(dataBase64, "base64");
    } catch {
      throw new HttpsError("invalid-argument", `Image ${index + 1} could not be decoded.`);
    }
    if (!bytes.length) {
      throw new HttpsError("invalid-argument", `Image ${index + 1} is empty.`);
    }
    if (bytes.length > MAX_IMAGE_BYTES) {
      throw new HttpsError(
        "invalid-argument",
        `Image ${index + 1} exceeds the ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB size limit.`,
      );
    }
    totalDecodedBytes += bytes.length;
    if (totalDecodedBytes > MAX_TOTAL_DECODED_BYTES) {
      throw new HttpsError(
        "invalid-argument",
        `Total photo size exceeds the ${Math.round(MAX_TOTAL_DECODED_BYTES / (1024 * 1024))}MB limit for one request. Send fewer or smaller photos.`,
      );
    }
    normalized.push({ mimeType, dataBase64 });
  }

  return normalized;
}

module.exports = {
  MAX_IMAGES_PER_REQUEST,
  MAX_IMAGE_BYTES,
  MAX_TOTAL_DECODED_BYTES,
  ALLOWED_MIME_TYPES,
  validateAnalyzeImagesInput,
};
