import { collectionBackupFilename, createCollectionBackupCsv } from "../utils/collectionBackupCsv";

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function CollectionBackupDownload({ ownerUid, entries, disabled }) {
  const handleDownload = () => {
    if (!ownerUid || disabled) {
      return;
    }

    const csv = createCollectionBackupCsv({ entries: entries ?? [] });
    downloadCsv(collectionBackupFilename(new Date()), csv);
  };

  return (
    <section className="collection-backup" aria-label="Download my collection">
      <div className="collection-backup__header">
        <h2>Download my collection</h2>
        <p>
          Everything you own on ShardStash, including cards, pins, and any sets we add later. This
          is a backup and spreadsheet copy, not the bulk upload format.
        </p>
      </div>
      <div className="collection-backup__actions">
        <button
          type="button"
          className="collection-backup__button"
          onClick={handleDownload}
          disabled={!ownerUid || disabled}
        >
          Download CSV
        </button>
      </div>
    </section>
  );
}
