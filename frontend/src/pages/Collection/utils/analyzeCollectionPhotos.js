import { httpsCallable } from "firebase/functions";
import { functions } from "../../../lib/firebase";

/**
 * @param {{ mimeType: string, dataBase64: string }[]} images
 */
export async function analyzeCollectionPhotos(images) {
  if (!functions) {
    throw new Error("Cloud Functions are not configured.");
  }
  const callable = httpsCallable(functions, "analyzeCollectionPhotos", { timeout: 120_000 });
  const response = await callable({ images });
  return response.data;
}
