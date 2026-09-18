import { useEffect, useId, useRef, useState } from "react";

export const SITE_FEEDBACK_GUILD = "Sanderson Collectors Guild";
export const SITE_FEEDBACK_CONTACTS = ["gimpy_12", "1bjax"];

export default function SiteFeedback() {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    dialogRef.current?.focus();

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <footer className="site-footer">
      <button type="button" className="site-footer__feedback" onClick={() => setOpen(true)}>
        Feedback
      </button>
      {open ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismisses on pointer click
        // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes via window listener
        <div className="site-feedback-modal__backdrop" onClick={close}>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: click only stops backdrop dismiss; Escape handled on window */}
          <div
            ref={dialogRef}
            className="site-feedback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId}>Send site feedback</h2>
            <div id={descriptionId} className="site-feedback-modal__body">
              <p>
                This is for product and site feedback (bugs and ideas), not trade match contact.
              </p>
              <p>
                In the {SITE_FEEDBACK_GUILD} Discord, message {SITE_FEEDBACK_CONTACTS[0]} or{" "}
                {SITE_FEEDBACK_CONTACTS[1]}.
              </p>
            </div>
            <button type="button" className="site-feedback-modal__close" onClick={close}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </footer>
  );
}
