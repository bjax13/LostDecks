import { httpsCallable } from "firebase/functions";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import * as firebaseClient from "../../lib/firebase";
import { CollectionSummary, CollectionTable } from "../Collection/collectionPresentation.jsx";
import { buildCollectionSummary, decorateCollectionEntries } from "../Collection/collectionSummary";
import { useUserCollection } from "../Collection/hooks/useUserCollection";
import "../Collection/Collection.css";
import "./Admin.css";

function useAdminCollectors(enabled) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setUsers([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    if (!firebaseClient.functions) {
      setUsers([]);
      setLoading(false);
      setError(new Error("Firebase is not configured, so collector collections cannot be loaded."));
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    const callable = httpsCallable(firebaseClient.functions, "listAdminCollectors");
    callable()
      .then((result) => {
        if (cancelled) {
          return;
        }
        const nextUsers = Array.isArray(result?.data?.users) ? result.data.users : [];
        setUsers(nextUsers);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        console.error("Failed to load admin collector list", err);
        setError(err instanceof Error ? err : new Error("Failed to load collectors."));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { users, loading, error };
}

function formatCollectorStats(user) {
  const distinctItems = Number.isFinite(user.distinctItems) ? user.distinctItems : 0;
  const totalQuantity = Number.isFinite(user.totalQuantity) ? user.totalQuantity : 0;
  const dunCount = Number.isFinite(user.dunCount) ? user.dunCount : 0;
  const foilCount = Number.isFinite(user.foilCount) ? user.foilCount : 0;
  return `${distinctItems} owned · ${totalQuantity} copies · ${dunCount} dun · ${foilCount} foil`;
}

function AdminGate({ children }) {
  const { user, loading, isAdmin, adminLoading } = useAuth();
  const location = useLocation();

  if (loading || (user && adminLoading)) {
    return (
      <section className="collection-page">
        <p>Checking access…</p>
      </section>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }

  if (!isAdmin) {
    return (
      <section className="collection-page">
        <h1>Admin</h1>
        <p>You are not authorized to view collector collections.</p>
      </section>
    );
  }

  return children;
}

function AdminDirectory() {
  const { users, loading, error } = useAdminCollectors(true);

  return (
    <section className="collection-page">
      <header className="collection-page__header">
        <h1>Admin</h1>
        <p>Every collector’s saved collection. Opening a person is read-only.</p>
      </header>
      {error ? (
        <div className="collection-page__error">
          Failed to load collectors. {error.message ?? "Please try again in a moment."}
        </div>
      ) : null}
      {loading ? (
        <p>Loading collectors…</p>
      ) : users.length === 0 && !error ? (
        <p>No collectors yet.</p>
      ) : (
        <ul className="admin-directory" aria-label="Collectors">
          {users.map((collector) => (
            <li key={collector.uid}>
              <Link to={`/admin/${encodeURIComponent(collector.uid)}`}>
                <span className="admin-directory__name">
                  {collector.displayName || collector.email || collector.uid}
                </span>
                <span className="admin-directory__email">{collector.email || "No email"}</span>
                <span className="admin-directory__stats">{formatCollectorStats(collector)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AdminUserCollection({ uid }) {
  const { users, loading: directoryLoading } = useAdminCollectors(true);
  const { entries, loading, error } = useUserCollection(uid);
  const collector = users.find((user) => user.uid === uid) ?? null;
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }),
    [],
  );
  const decoratedEntries = useMemo(
    () => decorateCollectionEntries(entries, dateFormatter),
    [entries, dateFormatter],
  );
  const summary = useMemo(() => buildCollectionSummary(decoratedEntries), [decoratedEntries]);
  const title = collector?.displayName || (directoryLoading ? "Loading collector…" : "Collector");

  return (
    <section className="collection-page">
      <header className="collection-page__header">
        <Link className="admin-page__back" to="/admin">
          All collectors
        </Link>
        <h1>{title}</h1>
        <p className="admin-page__note">
          {collector?.email || (directoryLoading ? "Loading profile…" : uid)}
        </p>
        <p className="admin-page__note">Read-only. This collection cannot be edited here.</p>
      </header>

      {error ? (
        <div className="collection-page__error">
          Failed to load this collection. {error.message ?? "Please try again in a moment."}
        </div>
      ) : null}

      {loading ? (
        <div className="collection-page__loading">
          <div className="collection-page__loading-spinner" aria-hidden="true" />
          <p>Fetching collectibles…</p>
        </div>
      ) : decoratedEntries.length === 0 ? (
        <div className="collection-page__empty">
          <strong>No collectibles saved for this collector</strong>
        </div>
      ) : (
        <>
          <CollectionSummary summary={summary} />
          <CollectionTable entries={decoratedEntries} readOnly />
        </>
      )}
    </section>
  );
}

export default function AdminPage() {
  const { uid } = useParams();
  return <AdminGate>{uid ? <AdminUserCollection uid={uid} /> : <AdminDirectory />}</AdminGate>;
}
