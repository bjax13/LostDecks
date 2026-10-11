import { SITE_FEEDBACK_MAILTO } from "../../siteFeedback.js";
import "./ServerError.css";

export default function ServerError({ error = null }) {
  const showDetail = import.meta.env.DEV && error?.message;

  return (
    <section className="server-error-page">
      <h1>Something went wrong</h1>
      <p>This page hit an error. Your collection is safe. Try reloading, or head home.</p>
      {showDetail ? <p className="server-error-page__detail">{error.message}</p> : null}
      <div className="server-error-page__actions">
        <button
          type="button"
          className="server-error-page__link"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
        <a className="server-error-page__link" href="/">
          Back to Home
        </a>
        <a className="server-error-page__link" href={SITE_FEEDBACK_MAILTO}>
          Tell us what happened
        </a>
      </div>
    </section>
  );
}
