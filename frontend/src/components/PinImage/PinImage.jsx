import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  pinImageHue,
  pinImageSrcSet,
  pinImageUrl,
  pinImageVersion,
  pinSetCode,
} from "./pinImage.js";
import "./PinImage.css";

const SLOT_PX = {
  grid: 64,
  row: 40,
  match: 32,
  detail: 320,
};

function CameraCue() {
  return (
    <svg className="pin-image__camera" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M9.2 6.2 10.4 4.4h3.2l1.2 1.8h3.4A1.8 1.8 0 0 1 20 8v9.2a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 17.2V8a1.8 1.8 0 0 1 1.8-1.8h3.4Zm2.8 10.2a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
      />
    </svg>
  );
}

function EmptySlot({ variant, code, hue }) {
  if (variant === "detail") {
    return (
      <div className="pin-image pin-image--detail pin-image--empty" style={{ "--pin-hue": hue }}>
        <span className="pin-image__code">{code}</span>
        <p className="pin-image__cta">
          No photo yet. Have this pin? <Link to="/about">Send us a photo.</Link>
        </p>
      </div>
    );
  }

  return (
    <span
      className={`pin-image pin-image--${variant} pin-image--empty`}
      style={{ "--pin-hue": hue }}
      role="img"
      aria-label="no photo yet"
      title="no photo yet"
    >
      <span className="pin-image__code" aria-hidden="true">
        {code}
      </span>
      <CameraCue />
    </span>
  );
}

export default function PinImage({ pinId, name = "", image, variant = "row" }) {
  const version = pinImageVersion(image);
  const code = pinSetCode(pinId);
  const hue = pinImageHue(code);
  const px = SLOT_PX[variant] ?? SLOT_PX.row;
  const src = version > 0 ? pinImageUrl(pinId, variant === "detail" ? 320 : 96, version) : null;
  const srcSet = src ? pinImageSrcSet(pinId, version, variant) : null;
  const photoKey = `${pinId}:${version}:${variant}`;
  const [seenKey, setSeenKey] = useState(photoKey);
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  if (seenKey !== photoKey) {
    setSeenKey(photoKey);
    setShown(false);
    setFailed(false);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!src || !srcSet || failed) {
    return <EmptySlot variant={variant} code={code} hue={hue} />;
  }

  const photo = (
    <img
      className={shown ? "pin-image__photo pin-image__photo--shown" : "pin-image__photo"}
      src={src}
      srcSet={srcSet}
      alt=""
      width={px}
      height={px}
      decoding="async"
      draggable={false}
      ref={(node) => {
        if (node?.complete && node.naturalWidth > 0) {
          setShown(true);
        }
      }}
      onLoad={() => setShown(true)}
      onError={() => {
        setFailed(true);
        setOpen(false);
      }}
      {...(variant === "detail" ? { fetchPriority: "high" } : { loading: "lazy" })}
    />
  );

  if (variant === "detail") {
    return (
      <>
        <button
          type="button"
          className="pin-image pin-image--detail"
          style={{ "--pin-hue": hue }}
          aria-label={`View full size photo of ${name || code || "this pin"}`}
          onClick={() => setOpen(true)}
        >
          <span className="pin-image__placeholder" aria-hidden="true">
            <span className="pin-image__code">{code}</span>
          </span>
          {photo}
        </button>
        {open ? (
          <div
            className="pin-image__lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={`${name || code || "Pin"} photo`}
          >
            <button
              type="button"
              className="pin-image__lightbox-backdrop"
              aria-label="Close photo"
              onClick={() => setOpen(false)}
            />
            <img
              src={pinImageUrl(pinId, 800, version)}
              alt={name || code || "Pin photo"}
              width={800}
              height={800}
              decoding="async"
            />
            <button
              type="button"
              className="pin-image__lightbox-close"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <span className={`pin-image pin-image--${variant}`} style={{ "--pin-hue": hue }}>
      <span className="pin-image__placeholder" aria-hidden="true">
        <span className="pin-image__code">{code}</span>
      </span>
      {photo}
    </span>
  );
}
