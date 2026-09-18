import {
  SITE_FEEDBACK_CONTACTS,
  SITE_FEEDBACK_EMAIL,
  SITE_FEEDBACK_MAILTO,
  SITE_FEEDBACK_PLACES,
} from "../../siteFeedback.js";
import "./About.css";

export default function AboutPage() {
  return (
    <main className="about-page">
      <h1>About</h1>
      <div className="about-page__body">
        <p>
          ShardStash has two jobs: track what you own, and make it easy to trade extras for what
          you’re missing.
        </p>
        <p>
          It started as a side project for Corby and Bryan to finish their Story Deck set and trade
          grab-bag ChasmFriends for a full pin set.
        </p>
        <p>
          We’re all ears. Email ideas or bugs to{" "}
          <a href={SITE_FEEDBACK_MAILTO}>{SITE_FEEDBACK_EMAIL}</a>, or ping{" "}
          {SITE_FEEDBACK_CONTACTS[0]} or {SITE_FEEDBACK_CONTACTS[1]} in the{" "}
          {SITE_FEEDBACK_PLACES[0]} or {SITE_FEEDBACK_PLACES[1]} Discord.
        </p>
      </div>
    </main>
  );
}
