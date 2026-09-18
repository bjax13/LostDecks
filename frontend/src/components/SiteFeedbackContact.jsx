import {
  SITE_FEEDBACK_CONTACTS,
  SITE_FEEDBACK_EMAIL,
  SITE_FEEDBACK_GUILD,
  SITE_FEEDBACK_MAILTO,
} from "../siteFeedback.js";

export default function SiteFeedbackContact() {
  return (
    <>
      <p>
        Email: <a href={SITE_FEEDBACK_MAILTO}>{SITE_FEEDBACK_EMAIL}</a>
      </p>
      <p>
        Discord: in the {SITE_FEEDBACK_GUILD}, message {SITE_FEEDBACK_CONTACTS[0]} or{" "}
        {SITE_FEEDBACK_CONTACTS[1]}.
      </p>
    </>
  );
}
