import { useEffect, useState } from "react";
import AuthGuard from "../../components/Auth/AuthGuard";
import { useAuth } from "../../contexts/AuthContext";
import {
  DEFAULT_USER_PREFERENCES,
  subscribeUserPreferences,
  updateUserPreferences,
} from "../../lib/userPreferences";
import "./Account.css";

function AccountPage() {
  const { user } = useAuth();
  const [matchingOptOut, setMatchingOptOut] = useState(DEFAULT_USER_PREFERENCES.matchingOptOut);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState(null);

  useEffect(() => {
    if (!user?.uid) {
      setMatchingOptOut(DEFAULT_USER_PREFERENCES.matchingOptOut);
      setPreferencesLoading(false);
      setPreferencesError(null);
      return undefined;
    }

    setPreferencesLoading(true);
    setPreferencesError(null);

    const unsubscribe = subscribeUserPreferences(
      user.uid,
      (preferences) => {
        setMatchingOptOut(Boolean(preferences.matchingOptOut));
        setPreferencesLoading(false);
      },
      (err) => {
        console.error("Failed to load user preferences", err);
        setPreferencesError(err);
        setPreferencesLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const handleMatchingToggleChange = async (event) => {
    if (!user?.uid) {
      return;
    }

    const nextOptOut = !event.target.checked;
    const previousOptOut = matchingOptOut;
    setMatchingOptOut(nextOptOut);
    setPreferencesSaving(true);
    setPreferencesError(null);

    try {
      await updateUserPreferences(user.uid, { matchingOptOut: nextOptOut });
    } catch (err) {
      console.error("Failed to update matching preference", err);
      setMatchingOptOut(previousOptOut);
      setPreferencesError(err);
    } finally {
      setPreferencesSaving(false);
    }
  };

  return (
    <AuthGuard fallback={<p>Loading account…</p>}>
      <section className="account-page">
        <header className="account-header">
          <h1>Account Settings</h1>
          <p className="account-hint">View your account profile.</p>
        </header>

        {user ? (
          <section className="account-section">
            <h2>Profile overview</h2>
            <ul className="account-summary">
              <li>
                <span className="account-summary-label">Display name</span>
                <span>{user.displayName || "Not set"}</span>
              </li>
              <li>
                <span className="account-summary-label">Primary email</span>
                <span>{user.email}</span>
              </li>
            </ul>
          </section>
        ) : null}

        {user ? (
          <section className="account-section">
            <h2>Match preferences</h2>
            <p className="account-hint">
              Control whether your collection is included in trade match discovery.
            </p>
            <label className="account-toggle">
              <input
                type="checkbox"
                checked={!matchingOptOut}
                disabled={preferencesLoading || preferencesSaving}
                onChange={handleMatchingToggleChange}
              />
              Include me in Matches
            </label>
            {preferencesLoading ? <p className="account-status">Loading preferences…</p> : null}
            {preferencesSaving ? <p className="account-status">Saving preference…</p> : null}
            {preferencesError ? (
              <p className="account-error">Could not update preferences. Please try again.</p>
            ) : null}
          </section>
        ) : null}
      </section>
    </AuthGuard>
  );
}

export default AccountPage;
