import { useEffect, useId, useRef, useState } from "react";
import "./InfoBubble.css";

export default function InfoBubble({ label, children }) {
  const tooltipId = useId();
  const rootRef = useRef(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = pinned || hovered || focused;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setPinned(false);
        setHovered(false);
        setFocused(false);
        rootRef.current?.querySelector("button")?.blur();
      }
    };

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setPinned(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <span className="info-bubble" ref={rootRef}>
      <button
        type="button"
        className="info-bubble__trigger"
        aria-label={label}
        aria-expanded={open}
        aria-controls={tooltipId}
        onClick={() => setPinned((value) => !value)}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget)) {
            setFocused(false);
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span aria-hidden="true">i</span>
      </button>
      <span id={tooltipId} hidden={!open} className="info-bubble__panel">
        {children}
      </span>
    </span>
  );
}
