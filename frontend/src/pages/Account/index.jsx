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
  const { user, updateDisplayName } = useAuth();
  const [matchingOptOut, setMatchingOptOut] = useState(DEFAULT_USER_PREFERENCES.matchingOptOut);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState(null);
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [displayNameSaving, setDisplayNameSaving] = useState(false);
  const [displayNameError, setDisplayNameError] = useState(null);
  const [displayNameSaved, setDisplayNameSaved] = useState(false);

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset editor when the signed-in user changes, not when displayName updates after save
  useEffect(() => {
    setIsEditingDisplayName(false);
    setDisplayNameDraft(user?.displayName || "");
    setDisplayNameError(null);
    setDisplayNameSaved(false);
  }, [user?.uid]);

  const startEditingDisplayName = () => {
    setDisplayNameDraft(user?.displayName || "");
    setDisplayNameError(null);
    setDisplayNameSaved(false);
    setIsEditingDisplayName(true);
  };

  const cancelEditingDisplayName = () => {
    setDisplayNameDraft(user?.displayName || "");
    setDisplayNameError(null);
    setIsEditingDisplayName(false);
  };

  const handleDisplayNameSave = async (event) => {
    event.preventDefault();
    const trimmed = displayNameDraft.trim();
    if (!trimmed) {
      setDisplayNameError(new Error("Display name cannot be empty."));
      setDisplayNameSaved(false);
      return;
    }

    if (trimmed === (user?.displayName || "").trim()) {
      setDisplayNameError(null);
      setDisplayNameSaved(false);
      setIsEditingDisplayName(false);
      return;
    }

    setDisplayNameSaving(true);
    setDisplayNameError(null);
    setDisplayNameSaved(false);

    try {
      await updateDisplayName(trimmed);
      setIsEditingDisplayName(false);
      setDisplayNameSaved(true);
    } catch (err) {
      console.error("Failed to update display name", err);
      setDisplayNameError(err);
    } finally {
      setDisplayNameSaving(false);
    }
  };

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
          <p className="account-hint">View and update your account profile.</p>
        </header>

        {user ? (
          <section className="account-section">
            <h2>Profile overview</h2>
            <ul className="account-summary">
              <li>
                <span className="account-summary-label" id="account-display-name-label">
                  Display name
                </span>
                {isEditingDisplayName ? (
                  <form className="account-display-name-form" onSubmit={handleDisplayNameSave}>
                    <input
                      id="account-display-name"
                      type="text"
                      name="displayName"
                      autoComplete="nickname"
                      value={displayNameDraft}
                      onChange={(event) => setDisplayNameDraft(event.target.value)}
                      aria-labelledby="account-display-name-label"
                      disabled={displayNameSaving}
                      required
                    />
                    <button type="submit" disabled={displayNameSaving}>
                      {displayNameSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditingDisplayName}
                      disabled={displayNameSaving}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <span className="account-display-name">
                    <span>{user.displayName || "Not set"}</span>
                    <button type="button" onClick={startEditingDisplayName}>
                      Edit
                    </button>
                  </span>
                )}
              </li>
              <li>
                <span className="account-summary-label">Primary email</span>
                <span>{user.email || (user.isAnonymous ? "Guest session" : "Not set")}</span>
              </li>
            </ul>
            {displayNameSaving ? <p className="account-status">Saving display name…</p> : null}
            {displayNameSaved ? <p className="account-status">Display name updated.</p> : null}
            {displayNameError ? (
              <p className="account-error">
                {displayNameError.message || "Could not update display name. Please try again."}
              </p>
            ) : null}
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
