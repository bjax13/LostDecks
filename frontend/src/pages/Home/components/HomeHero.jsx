import { Link } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { useAuthModal } from "../../../contexts/AuthModalContext.jsx";

export default function HomeHero() {
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const isSignedIn = Boolean(user);

  return (
    <section className="home-hero" aria-labelledby="home-hero-heading">
      <div className="home-hero__content">
        <h1 id="home-hero-heading">Track your collectibles in one place.</h1>
        <p className="home-hero__subhead">
          Organize your collection, spot what is missing, and keep track of extras you own.
        </p>
        <div className="home-hero__actions">
          {!isSignedIn ? (
            <button
              type="button"
              className="home-cta home-cta--primary"
              onClick={() => openAuthModal({ reason: "home-sign-in" })}
            >
              Sign In
            </button>
          ) : null}
          <Link to="/collectibles" className="home-cta home-cta--secondary">
            View Collectibles
          </Link>
        </div>
        {isSignedIn ? (
          <p className="home-hero__welcome">
            Welcome back{user.displayName ? `, ${user.displayName}` : ""}.
          </p>
        ) : null}
      </div>
    </section>
  );
}
