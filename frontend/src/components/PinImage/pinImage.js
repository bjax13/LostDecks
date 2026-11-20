/**
 * Pin photos are served from Firebase Hosting at
 * /pin-images/{id}-{size}.webp?v={version}
 * for sizes 96, 320, and 800. Hosting marks /pin-images/** immutable,
 * so a reshoot bumps the version in the query instead of reusing the URL.
 * A version of 0 or a missing image field means no photo: do not request a file.
 */
export const PIN_IMAGE_SIZES = [96, 320, 800];

const PIN_ID_RE = /^PIN-([A-Z0-9]{2,6})-\d{2,3}$/;

export function pinImageVersion(image) {
  if (typeof image !== "number" || !Number.isInteger(image) || image <= 0) {
    return 0;
  }
  return image;
}

export function pinSetCode(pinId) {
  const match = PIN_ID_RE.exec(typeof pinId === "string" ? pinId : "");
  return match ? match[1] : "";
}

export function pinImageHue(setCode) {
  const code = typeof setCode === "string" ? setCode : "";
  let hash = 0;
  for (let i = 0; i < code.length; i += 1) {
    hash = (hash + code.charCodeAt(i) * (i + 3)) % 120;
  }
  return 200 + hash;
}

export function pinImageUrl(pinId, size, version) {
  const resolved = pinImageVersion(version);
  if (!PIN_ID_RE.test(typeof pinId === "string" ? pinId : "") || !PIN_IMAGE_SIZES.includes(size)) {
    return null;
  }
  if (resolved <= 0) return null;
  return `/pin-images/${pinId}-${size}.webp?v=${resolved}`;
}

export function pinImageSrcSet(pinId, version, variant) {
  if (variant === "detail") {
    const medium = pinImageUrl(pinId, 320, version);
    const large = pinImageUrl(pinId, 800, version);
    if (!medium || !large) return null;
    return `${medium} 1x, ${large} 2x`;
  }
  const small = pinImageUrl(pinId, 96, version);
  const medium = pinImageUrl(pinId, 320, version);
  if (!small || !medium) return null;
  return `${small} 1x, ${medium} 2x`;
}
