import { Link } from "react-router-dom";
import { SITE_NAME } from "../../brand.js";
import {
  SITE_FEEDBACK_CONTACTS,
  SITE_FEEDBACK_EMAIL,
  SITE_FEEDBACK_MAILTO,
  SITE_FEEDBACK_PLACES,
} from "../../siteFeedback.js";
import "./Legal.css";

/* TEMPLATE – Bryan must review before launch */
export default function Terms() {
  return (
    <main className="legal-page">
      <h1>Terms of Use</h1>
      <p className="legal-page__updated">Last updated: October 8, 2026</p>
      <div className="legal-page__body">
        <p>
          These template terms govern use of {SITE_NAME} (operated by Bryan Jackson) at
          shardstash.web.app. They are not legal advice. Questions:{" "}
          <a href={SITE_FEEDBACK_MAILTO}>{SITE_FEEDBACK_EMAIL}</a>, or Discord{" "}
          {SITE_FEEDBACK_CONTACTS[0]} / {SITE_FEEDBACK_CONTACTS[1]} in {SITE_FEEDBACK_PLACES[0]} or{" "}
          {SITE_FEEDBACK_PLACES[1]}.
        </p>

        <h2>Fan project</h2>
        <p>
          {SITE_NAME} is an unofficial fan project. It is not affiliated with, endorsed by, or
          sponsored by Dragonsteel Entertainment or related rightsholders. Card and pin names and
          artwork remain the property of their owners.
        </p>

        <h2>Your account</h2>
        <p>
          You are responsible for activity under your account. Provide accurate contact details if
          you participate in Matches. We may suspend or remove accounts that abuse the service,
          harass others, or attempt to break security or rate limits.
        </p>

        <h2>Trades</h2>
        <p>
          {SITE_NAME} helps collectors discover possible trades. Actual trades happen between users
          at their own risk. We do not broker, escrow, or guarantee trades, shipping, or payment.
        </p>

        <h2>No warranty</h2>
        <p>
          The service is provided “as is” without warranties of any kind. We may change or
          discontinue features. See our <Link to="/privacy">Privacy Policy</Link> for how we handle
          data and how to delete your account.
        </p>

        <h2>Contact</h2>
        <p>
          Reach the operator via the feedback email or Discord handles listed above and in the site
          footer.
        </p>
      </div>
    </main>
  );
}
