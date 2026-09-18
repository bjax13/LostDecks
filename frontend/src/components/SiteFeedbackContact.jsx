import {
  SITE_FEEDBACK_CONTACTS,
  SITE_FEEDBACK_EMAIL,
  SITE_FEEDBACK_MAILTO,
  SITE_FEEDBACK_PLACES,
} from "../siteFeedback.js";

export default function SiteFeedbackContact() {
  return (
    <>
      <p>
        Email: <a href={SITE_FEEDBACK_MAILTO}>{SITE_FEEDBACK_EMAIL}</a>
      </p>
      <p>
        Discord: ping {SITE_FEEDBACK_CONTACTS[0]} or {SITE_FEEDBACK_CONTACTS[1]} in{" "}
        {SITE_FEEDBACK_PLACES[0]} or {SITE_FEEDBACK_PLACES[1]}.
      </p>
    </>
  );
}
