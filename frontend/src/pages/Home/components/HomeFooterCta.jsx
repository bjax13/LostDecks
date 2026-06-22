import { Link } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { useAuthModal } from "../../../contexts/AuthModalContext.jsx";

export default function HomeFooterCta() {
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const isSignedIn = Boolean(user);

  return (
    <section className="home-footer-cta" aria-labelledby="home-footer-cta-heading">
      <h2 id="home-footer-cta-heading">Start tracking your collection</h2>
      <div className="home-footer-cta__actions">
        {isSignedIn ? (
          <Link to="/collections" className="home-cta home-cta--primary">
            View Collection
          </Link>
        ) : (
          <button
            type="button"
            className="home-cta home-cta--primary"
            onClick={() => openAuthModal({ reason: "home-get-started" })}
          >
            Get Started
          </button>
        )}
        <Link to="/collectibles" className="home-cta home-cta--secondary">
          Browse Items
        </Link>
      </div>
    </section>
  );
}
