export default function BinderInfo({ binder, layout }) {
  if (!binder) {
    if (layout === 'grid') {
      return <p className="muted">Not in binder mosaic</p>;
    }
    return <span className="muted">—</span>;
  }

  if (layout === 'grid') {
    return (
      <ul>
        <li>Page {binder.page}</li>
        <li>Row {binder.row} · Col {binder.col}</li>
        <li>Slot {binder.position}</li>
      </ul>
    );
  }

  return (
    <div className="binder-info">
      <span>Page {binder.page}</span>
      <span>
        Row {binder.row}, Col {binder.col}
      </span>
      <span>Slot {binder.position}</span>
    </div>
  );
}
