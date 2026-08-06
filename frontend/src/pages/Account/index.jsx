import { useEffect, useState } from "react";
import AuthGuard from "../../components/Auth/AuthGuard";
import { useAuth } from "../../contexts/AuthContext";
import {
  DEFAULT_DISCORD_CHANNEL,
  DEFAULT_USER_PREFERENCES,
  isValidTradingEmail,
  MATCH_CONTACT_SHARING,
  MAX_DISCORD_CHANNEL_LENGTH,
  MAX_DISCORD_HANDLE_LENGTH,
  MAX_TRADING_EMAIL_LENGTH,
  subscribeUserPreferences,
  updateUserPreferences,
} from "../../lib/userPreferences";
import "./Account.css";

function AccountPage() {
  const { user, updateDisplayName } = useAuth();
  const [matchingOptOut, setMatchingOptOut] = useState(DEFAULT_USER_PREFERENCES.matchingOptOut);
  const [matchContactSharing, setMatchContactSharing] = useState(
    DEFAULT_USER_PREFERENCES.matchContactSharing,
  );
  const [tradingEmail, setTradingEmail] = useState(DEFAULT_USER_PREFERENCES.tradingEmail);
  const [discordHandle, setDiscordHandle] = useState(DEFAULT_USER_PREFERENCES.discordHandle);
  const [discordChannel, setDiscordChannel] = useState(DEFAULT_USER_PREFERENCES.discordChannel);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState(null);
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [displayNameSaving, setDisplayNameSaving] = useState(false);
  const [displayNameError, setDisplayNameError] = useState(null);
  const [displayNameSaved, setDisplayNameSaved] = useState(false);
  const [tradingEmailError, setTradingEmailError] = useState(null);
  const [discordError, setDiscordError] = useState(null);
  const [contactSharingError, setContactSharingError] = useState(null);
  const [contactSharingResetKey, setContactSharingResetKey] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setMatchingOptOut(DEFAULT_USER_PREFERENCES.matchingOptOut);
      setMatchContactSharing(DEFAULT_USER_PREFERENCES.matchContactSharing);
      setTradingEmail(DEFAULT_USER_PREFERENCES.tradingEmail);
      setDiscordHandle(DEFAULT_USER_PREFERENCES.discordHandle);
      setDiscordChannel(DEFAULT_USER_PREFERENCES.discordChannel);
      setPreferencesLoading(false);
      setPreferencesError(null);
      setTradingEmailError(null);
      setDiscordError(null);
      setContactSharingError(null);
      return undefined;
    }

    setPreferencesLoading(true);
    setPreferencesError(null);
    setContactSharingError(null);

    const unsubscribe = subscribeUserPreferences(
      user.uid,
      (preferences) => {
        setMatchingOptOut(Boolean(preferences.matchingOptOut));
        setMatchContactSharing(preferences.matchContactSharing);
        setTradingEmail(preferences.tradingEmail);
        setDiscordHandle(preferences.discordHandle);
        setDiscordChannel(preferences.discordChannel || DEFAULT_DISCORD_CHANNEL);
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

  const persistPreferences = async (updates, revert) => {
    if (!user?.uid) {
      return;
    }

    setPreferencesSaving(true);
    setPreferencesError(null);

    try {
      await updateUserPreferences(user.uid, updates);
    } catch (err) {
      console.error("Failed to update matching preference", err);
      revert?.();
      setPreferencesError(err);
    } finally {
      setPreferencesSaving(false);
    }
  };

  const handleMatchingToggleChange = async (event) => {
    const nextOptOut = !event.target.checked;
    const previousOptOut = matchingOptOut;
    setMatchingOptOut(nextOptOut);
    await persistPreferences({ matchingOptOut: nextOptOut }, () => {
      setMatchingOptOut(previousOptOut);
    });
  };

  const rejectIncompleteContactSharing = (previousSharing) => {
    setMatchContactSharing(previousSharing);
    // Remount radios so the browser's unchecked selection cannot stick.
    setContactSharingResetKey((value) => value + 1);
  };

  const handleContactSharingChange = async (event) => {
    const nextSharing = event.target.value;
    const previousSharing = matchContactSharing;

    if (nextSharing === MATCH_CONTACT_SHARING.TRADING_EMAIL) {
      const nextEmail = tradingEmail.trim();
      if (!nextEmail || !isValidTradingEmail(nextEmail)) {
        setTradingEmailError("Enter a trading email before selecting this option.");
        setContactSharingError(
          "Trading email is empty. Fill it in, then choose this option again.",
        );
        setDiscordError(null);
        rejectIncompleteContactSharing(previousSharing);
        return;
      }
    }

    if (nextSharing === MATCH_CONTACT_SHARING.DISCORD) {
      const nextHandle = discordHandle.trim();
      if (!nextHandle) {
        setDiscordError("Enter a Discord name before selecting this option.");
        setContactSharingError(
          "Discord information is incomplete. Add a Discord name, then choose this option again.",
        );
        setTradingEmailError(null);
        rejectIncompleteContactSharing(previousSharing);
        return;
      }
    }

    setContactSharingError(null);
    setTradingEmailError(null);
    setDiscordError(null);
    setMatchContactSharing(nextSharing);
    await persistPreferences({ matchContactSharing: nextSharing }, () => {
      setMatchContactSharing(previousSharing);
    });
  };

  const handleTradingEmailBlur = async () => {
    const nextEmail = tradingEmail.trim();
    setTradingEmail(nextEmail);

    if (!nextEmail) {
      setTradingEmailError(
        matchContactSharing === MATCH_CONTACT_SHARING.TRADING_EMAIL
          ? "Enter a trading email before selecting this option."
          : null,
      );
      if (matchContactSharing === MATCH_CONTACT_SHARING.TRADING_EMAIL) {
        setContactSharingError(
          "Trading email is empty. Fill it in, then choose this option again.",
        );
      }
      await persistPreferences({ tradingEmail: "" });
      return;
    }

    if (!isValidTradingEmail(nextEmail)) {
      setTradingEmailError("Enter a valid email address.");
      return;
    }

    setTradingEmailError(null);
    if (matchContactSharing === MATCH_CONTACT_SHARING.TRADING_EMAIL) {
      setContactSharingError(null);
    }
    await persistPreferences({ tradingEmail: nextEmail });
  };

  const handleDiscordHandleBlur = async () => {
    const nextHandle = discordHandle.trim();
    setDiscordHandle(nextHandle);

    if (!nextHandle) {
      setDiscordError(
        matchContactSharing === MATCH_CONTACT_SHARING.DISCORD
          ? "Enter a Discord name before selecting this option."
          : null,
      );
      if (matchContactSharing === MATCH_CONTACT_SHARING.DISCORD) {
        setContactSharingError(
          "Discord information is incomplete. Add a Discord name, then choose this option again.",
        );
      }
      await persistPreferences({ discordHandle: "" });
      return;
    }

    setDiscordError(null);
    if (matchContactSharing === MATCH_CONTACT_SHARING.DISCORD) {
      setContactSharingError(null);
    }
    await persistPreferences({ discordHandle: nextHandle });
  };

  const handleDiscordChannelBlur = async () => {
    const nextChannel = discordChannel.trim() || DEFAULT_DISCORD_CHANNEL;
    setDiscordChannel(nextChannel);
    await persistPreferences({ discordChannel: nextChannel });
  };

  const controlsDisabled = preferencesLoading;

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
                <span>{user.email}</span>
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
                disabled={controlsDisabled}
                onChange={handleMatchingToggleChange}
              />
              Include me in Matches
            </label>

            <fieldset
              key={contactSharingResetKey}
              className="account-contact-sharing"
              disabled={controlsDisabled}
            >
              <legend>When something I have matches someone else, share with them…</legend>

              <div className="account-radio-option">
                <input
                  id="match-contact-true-email"
                  type="radio"
                  name="matchContactSharing"
                  value={MATCH_CONTACT_SHARING.TRUE_EMAIL}
                  checked={matchContactSharing === MATCH_CONTACT_SHARING.TRUE_EMAIL}
                  onChange={handleContactSharingChange}
                />
                <div className="account-radio-option__body">
                  <label htmlFor="match-contact-true-email" className="account-radio-option__label">
                    My true email
                  </label>
                  <span className="account-radio-option__detail">{user.email || "Not set"}</span>
                </div>
              </div>

              <div className="account-radio-option">
                <input
                  id="match-contact-trading-email"
                  type="radio"
                  name="matchContactSharing"
                  value={MATCH_CONTACT_SHARING.TRADING_EMAIL}
                  checked={matchContactSharing === MATCH_CONTACT_SHARING.TRADING_EMAIL}
                  onChange={handleContactSharingChange}
                />
                <div className="account-radio-option__body">
                  <div className="account-radio-option__label-row">
                    <label
                      htmlFor="match-contact-trading-email"
                      className="account-radio-option__label"
                    >
                      My trading email
                    </label>
                    <button
                      type="button"
                      className="account-help"
                      title="When a match is found this private email is displayed instead of your true email"
                      aria-label="When a match is found this private email is displayed instead of your true email"
                    >
                      ?
                    </button>
                  </div>
                  <input
                    type="email"
                    className="account-inline-input"
                    value={tradingEmail}
                    maxLength={MAX_TRADING_EMAIL_LENGTH}
                    placeholder="trading@example.com"
                    aria-label="Trading email"
                    onChange={(event) => {
                      setTradingEmail(event.target.value);
                      setTradingEmailError(null);
                      setContactSharingError(null);
                    }}
                    onBlur={handleTradingEmailBlur}
                  />
                  {tradingEmailError ? (
                    <span className="account-field-error">{tradingEmailError}</span>
                  ) : null}
                </div>
              </div>

              <div className="account-radio-option">
                <input
                  id="match-contact-discord"
                  type="radio"
                  name="matchContactSharing"
                  value={MATCH_CONTACT_SHARING.DISCORD}
                  checked={matchContactSharing === MATCH_CONTACT_SHARING.DISCORD}
                  onChange={handleContactSharingChange}
                />
                <div className="account-radio-option__body">
                  <label htmlFor="match-contact-discord" className="account-radio-option__label">
                    My Discord information
                  </label>
                  <div className="account-discord-fields">
                    <label className="account-discord-field">
                      <span>Discord name</span>
                      <input
                        type="text"
                        className="account-inline-input"
                        value={discordHandle}
                        maxLength={MAX_DISCORD_HANDLE_LENGTH}
                        placeholder="username"
                        aria-label="Discord name"
                        onChange={(event) => {
                          setDiscordHandle(event.target.value);
                          setDiscordError(null);
                          setContactSharingError(null);
                        }}
                        onBlur={handleDiscordHandleBlur}
                      />
                    </label>
                    <label className="account-discord-field">
                      <span>Discord channel</span>
                      <input
                        type="text"
                        className="account-inline-input"
                        value={discordChannel}
                        maxLength={MAX_DISCORD_CHANNEL_LENGTH}
                        placeholder={DEFAULT_DISCORD_CHANNEL}
                        aria-label="Discord channel"
                        onChange={(event) => setDiscordChannel(event.target.value)}
                        onBlur={handleDiscordChannelBlur}
                      />
                    </label>
                  </div>
                  {discordError ? (
                    <span className="account-field-error">{discordError}</span>
                  ) : null}
                </div>
              </div>
            </fieldset>

            {contactSharingError ? <p className="account-error">{contactSharingError}</p> : null}
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
