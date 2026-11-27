const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Downscale a photo for upload; returns base64 without the data URL prefix.
 * @param {File} file
 */
export async function preparePhotoForAiImport(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare the photo.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Could not encode the photo."))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return {
    mimeType: "image/jpeg",
    dataBase64: btoa(binary),
    byteLength: bytes.length,
  };
}
