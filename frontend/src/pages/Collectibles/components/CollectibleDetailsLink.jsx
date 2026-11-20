import { Link } from "react-router-dom";
import { collectibleDetailPath } from "../../../lib/collectibleDetailPath";

export default function CollectibleDetailsLink({ collectibleId, skuId, name, className = "" }) {
  const to = collectibleDetailPath(collectibleId, skuId);
  if (!to) {
    return null;
  }
  const label = typeof name === "string" && name.trim() ? name.trim() : collectibleId;
  const classes = ["details-affordance", className].filter(Boolean).join(" ");

  return (
    <Link
      to={to}
      className={classes}
      aria-label={`View details for ${label}`}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      details ›
    </Link>
  );
}
