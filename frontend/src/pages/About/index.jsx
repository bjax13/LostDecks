import {
  SITE_FEEDBACK_CONTACTS,
  SITE_FEEDBACK_EMAIL,
  SITE_FEEDBACK_GUILD,
  SITE_FEEDBACK_MAILTO,
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
          It started as a side project for Corby and Bryan — finishing a Story Deck set and trading
          grab-bag ChasmFriends toward a full pin set.
        </p>
        <p>
          We’re all ears. Email ideas or bugs to{" "}
          <a href={SITE_FEEDBACK_MAILTO}>{SITE_FEEDBACK_EMAIL}</a>, or message{" "}
          {SITE_FEEDBACK_CONTACTS[0]} or {SITE_FEEDBACK_CONTACTS[1]} in the {SITE_FEEDBACK_GUILD}{" "}
          Discord.
        </p>
      </div>
    </main>
  );
}
