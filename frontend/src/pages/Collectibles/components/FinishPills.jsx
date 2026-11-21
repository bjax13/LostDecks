import TradeFlagTag from "../../../components/TradeFlagTag.jsx";
import { normalizeTradeFlag } from "../../../lib/tradeFlag.js";

export default function FinishPills({
  finishes,
  className = "finish-list",
  empty,
  tradeFlagByFinish = {},
}) {
  if (!finishes || finishes.length === 0) {
    return <div className={className}>{empty ?? <span className="muted">—</span>}</div>;
  }

  return (
    <div className={className}>
      {finishes.map((finish) => {
        const flag = normalizeTradeFlag(tradeFlagByFinish?.[finish]);
        return (
          <span className="finish-pill-group" key={finish}>
            <span className="finish-pill">{finish}</span>
            {flag ? <TradeFlagTag flag={flag} /> : null}
          </span>
        );
      })}
    </div>
  );
}
