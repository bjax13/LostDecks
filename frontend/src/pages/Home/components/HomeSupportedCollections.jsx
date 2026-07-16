import { Link } from "react-router-dom";
import { datasetMeta, pinDatasetMeta } from "../../../data/collectibles";

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
        <Link
          to="/collectibles"
          className="home-supported__tile home-supported__tile--active"
          state={{ categoryFilter: "pin" }}
        >
          <span className="home-supported__tile-label">Chasm Friend Pins</span>
          <span className="home-supported__tile-meta">{pinDatasetMeta.setName}</span>
          <span className="home-supported__tile-action">Browse pins</span>
        </Link>
      </div>
    </section>
  );
}
