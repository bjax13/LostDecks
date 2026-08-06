import { Link } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";

export default function HomeFooterCta() {
  const { user } = useAuth();
  const isSignedIn = Boolean(user);

  return (
    <section className="home-footer-cta" aria-labelledby="home-footer-cta-heading">
      <h2 id="home-footer-cta-heading">Start tracking your collection</h2>
      <div className="home-footer-cta__actions">
        <Link to="/getting-started" className="home-cta home-cta--primary">
          Getting Started
        </Link>
        {isSignedIn ? (
          <Link to="/collections" className="home-cta home-cta--secondary">
            View Collection
          </Link>
        ) : null}
        <Link to="/collectibles" className="home-cta home-cta--secondary">
          Browse Items
        </Link>
      </div>
    </section>
  );
}
