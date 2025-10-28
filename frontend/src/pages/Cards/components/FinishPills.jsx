export default function FinishPills({ finishes, className = 'finish-list', empty }) {
  if (!finishes || finishes.length === 0) {
    return (
      <div className={className}>
        {empty ?? <span className="muted">—</span>}
      </div>
    );
  }

  return (
    <div className={className}>
      {finishes.map((finish) => (
        <span className="finish-pill" key={finish}>
          {finish}
        </span>
      ))}
    </div>
  );
}
