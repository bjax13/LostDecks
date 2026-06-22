import { Link } from "react-router-dom";

const features = [
  {
    title: "Track What You Own",
    description: "Log every item in your collection and keep quantities up to date.",
    to: "/collections",
  },
  {
    title: "See What's Missing",
    description: "Compare what you have against the full catalog to spot gaps.",
    to: "/collections",
  },
];

export default function HomeFeatureTiles() {
  return (
    <section className="home-features" aria-labelledby="home-features-heading">
      <h2 id="home-features-heading">What You Can Do Today</h2>
      <div className="home-features__grid">
        {features.map((feature) => (
          <Link key={feature.title} to={feature.to} className="home-features__card">
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
