import HomeCollectionSnapshot from "./components/HomeCollectionSnapshot";
import HomeFeatureTiles from "./components/HomeFeatureTiles";
import HomeFooterCta from "./components/HomeFooterCta";
import HomeHero from "./components/HomeHero";
import HomeSupportedCollections from "./components/HomeSupportedCollections";
import { useHomeCollectionStats } from "./hooks/useHomeCollectionStats";
import "./Home.css";

export default function Home() {
  const { loading, stats } = useHomeCollectionStats();

  return (
    <main className="home-page">
      <div className="home-page__inner">
        <HomeHero />
        <HomeSupportedCollections />
        <HomeFeatureTiles />
        <HomeCollectionSnapshot stats={stats} loading={loading} />
        <HomeFooterCta />
      </div>
    </main>
  );
}
