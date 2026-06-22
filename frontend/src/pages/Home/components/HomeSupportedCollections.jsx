import { Link } from "react-router-dom";
import { datasetMeta } from "../../../data/collectibles";

export default function HomeSupportedCollections() {
  return (
    <section className="home-supported" aria-labelledby="home-supported-heading">
      <h2 id="home-supported-heading">Supported Collections</h2>
      <div className="home-supported__grid">
        <Link to="/collectibles" className="home-supported__tile home-supported__tile--active">
          <span className="home-supported__tile-label">Story Deck Cards</span>
          <span className="home-supported__tile-meta">{datasetMeta.setName}</span>
          <span className="home-supported__tile-action">Browse catalog</span>
        </Link>
        <div className="home-supported__tile home-supported__tile--disabled" aria-disabled="true">
          <span className="home-supported__badge">Coming soon</span>
          <span className="home-supported__tile-label">Chasm Friend Pins</span>
          <span className="home-supported__tile-meta">Pin series tracking</span>
        </div>
      </div>
    </section>
  );
}
