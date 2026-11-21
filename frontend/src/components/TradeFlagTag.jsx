import { tradeFlagLabel } from "../lib/tradeFlag.js";
import "./TradeFlagTag.css";

export default function TradeFlagTag({ flag, label }) {
  const text = label || tradeFlagLabel(flag);
  if (!text) return null;
  const kind = flag === "uft" || flag === "iso" ? flag : "mixed";
  return <span className={`trade-flag-tag trade-flag-tag--${kind}`}>{text}</span>;
}
