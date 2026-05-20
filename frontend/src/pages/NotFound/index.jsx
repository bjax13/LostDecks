import { Link } from "react-router-dom";
import "./NotFound.css";

export default function NotFound() {
  return (
    <section className="not-found-page">
      <h1>Page not found</h1>
      <p>We could not find that page. It may have moved, or the link might be out of date.</p>
      <Link className="not-found-page__link" to="/">
        Back to Home
      </Link>
    </section>
  );
}
