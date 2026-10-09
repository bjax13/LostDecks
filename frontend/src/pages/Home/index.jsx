import { useLocation } from "react-router-dom";
import HomeCollectionSnapshot from "./components/HomeCollectionSnapshot";
import HomeFeatureTiles from "./components/HomeFeatureTiles";
import HomeFooterCta from "./components/HomeFooterCta";
import HomeHero from "./components/HomeHero";
import HomeSupportedCollections from "./components/HomeSupportedCollections";
import { useHomeCollectionStats } from "./hooks/useHomeCollectionStats";
import "./Home.css";

export default function Home() {
  const { loading, stats } = useHomeCollectionStats();
  const location = useLocation();
  const flashMessage =
    typeof location.state?.flash === "string" && location.state.flash.trim()
      ? location.state.flash.trim()
      : null;

  return (
    <main className="home-page">
      <div className="home-page__inner">
        {flashMessage ? (
          <p className="home-page__flash" role="status">
            {flashMessage}
          </p>
        ) : null}
        <HomeHero />
        <HomeSupportedCollections />
        <HomeFeatureTiles />
        <HomeCollectionSnapshot stats={stats} loading={loading} />
        <HomeFooterCta />
      </div>
    </main>
  );
}
