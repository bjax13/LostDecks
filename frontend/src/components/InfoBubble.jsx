import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import "./InfoBubble.css";

export default function InfoBubble({ label, children, placement = "start" }) {
  const tooltipId = useId();
  const rootRef = useRef(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = pinned || hovered || focused;
  const [panelBox, setPanelBox] = useState(null);

  useLayoutEffect(() => {
    if (!open || placement !== "end") {
      setPanelBox(null);
      return undefined;
    }

    const place = () => {
      const button = rootRef.current?.querySelector("button");
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const margin = 12;
      const width = Math.min(360, window.innerWidth - margin * 2);
      let left = rect.right - width;
      if (left < margin) left = margin;
      if (left + width > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - margin - width);
      }
      setPanelBox({ top: rect.bottom + 8, left, width });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, placement]);

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
      <span
        id={tooltipId}
        hidden={!open}
        className={
          placement === "end" ? "info-bubble__panel info-bubble__panel--end" : "info-bubble__panel"
        }
        style={
          panelBox
            ? {
                position: "fixed",
                top: panelBox.top,
                left: panelBox.left,
                width: panelBox.width,
                right: "auto",
              }
            : undefined
        }
      >
        {children}
      </span>
    </span>
  );
}
