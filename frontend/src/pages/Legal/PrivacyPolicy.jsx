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
export default function PrivacyPolicy() {
  return (
    <main className="legal-page">
      <h1>Privacy Policy</h1>
      <p className="legal-page__updated">Last updated: October 8, 2026</p>
      <div className="legal-page__body">
        <p>
          This template describes how {SITE_NAME} (operated by Bryan Jackson) handles information
          when you use the site at shardstash.web.app. It is not legal advice. Contact us at{" "}
          <a href={SITE_FEEDBACK_MAILTO}>{SITE_FEEDBACK_EMAIL}</a>, or ping{" "}
          {SITE_FEEDBACK_CONTACTS[0]} or {SITE_FEEDBACK_CONTACTS[1]} in the{" "}
          {SITE_FEEDBACK_PLACES[0]} or {SITE_FEEDBACK_PLACES[1]} Discord.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            Account email and display name (and Google profile name if you use Google sign-in).
          </li>
          <li>Passwords are handled by Firebase Authentication; we never see your password.</li>
          <li>Collection quantities and notes you save.</li>
          <li>
            Match preferences: trading email, Discord handle/channel, lanes, keep counts, and
            whether you opt out of matching.
          </li>
        </ul>

        <h2>Sharing with other users</h2>
        <p>
          When your collection matches another collector, they can see your display name and the
          contact method you chose in Account. By default that contact is your{" "}
          <strong>account email</strong>. You can switch to a trading email or Discord handle, or
          opt out of matching entirely under Account → Match preferences.
        </p>

        <h2>Processors</h2>
        <ul>
          <li>
            Google Firebase (Authentication, Firestore, Cloud Functions, Hosting at
            shardstash.web.app). Google reCAPTCHA / App Check may apply when that feature is
            enabled.
          </li>
          <li>
            PostHog (US cloud by default): page views, product events, surveys, and person identify
            with your Firebase uid plus email and display name when signed in. Session data may be
            collected if enabled in PostHog.{" "}
            {/* TODO(plan-02): Bryan — decide whether to drop email/name from identify (plan item 7a)
                or keep them and delete PostHog persons manually on request (7b). */}
            Deleting your {SITE_NAME} account does not automatically delete your PostHog person
            profile; contact us if you want that removed as well.
          </li>
        </ul>

        <h2>Cookies and local storage</h2>
        <p>
          We use Firebase Auth persistence in the browser (`browserLocalPersistence`), PostHog
          cookies/localStorage for analytics, and may store temporary onboarding picks in
          localStorage for growth flows. We do not sell your data and we do not run ads.
        </p>

        <h2>Retention and deletion</h2>
        <p>
          You can delete your account any time under Account → Danger zone. That removes your
          Firestore collection entries and preferences and deletes your Firebase Auth user. Backups
          (when enabled) may retain copies for up to about 7 days — confirm the live retention
          window in ops docs after backups are configured.
        </p>

        <h2>Children</h2>
        <p>{SITE_NAME} is not directed at children under 13.</p>

        <h2>Changes</h2>
        <p>
          We may update this page. The “Last updated” date above will change when we do. See also
          our <Link to="/terms">Terms of Use</Link>.
        </p>
      </div>
    </main>
  );
}
