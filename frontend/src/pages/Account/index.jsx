import { useState } from 'react';
import AuthGuard from '../../components/Auth/AuthGuard';
import { useAuth } from '../../contexts/AuthContext';
import './Account.css';

function AccountPage() {
  const { user } = useAuth();
  const [additionalInfo, setAdditionalInfo] = useState({
    phoneNumber: '',
    address: '',
    backupEmailPrimary: '',
    backupEmailSecondary: '',
  });
  const [additionalInfoSaved, setAdditionalInfoSaved] = useState(false);

  const handleAdditionalInfoChange = (event) => {
    const { name, value } = event.target;
    setAdditionalInfo((previousInfo) => ({ ...previousInfo, [name]: value }));
    setAdditionalInfoSaved(false);
  };

  const handleAdditionalInfoSubmit = (event) => {
    event.preventDefault();
    // TODO: Connect to persistence layer when account profile storage is available.
    setAdditionalInfoSaved(true);
  };

  return (
    <AuthGuard fallback={<p>Loading account…</p>}>
      <section className="account-page">
        <header className="account-header">
          <h1>Account Settings</h1>
          <p className="account-hint">
            Keep your contact details up to date so trading partners can reach you.
          </p>
        </header>

        {user ? (
          <section className="account-section">
            <h2>Profile overview</h2>
            <ul className="account-summary">
              <li>
                <span className="account-summary-label">Display name</span>
                <span>{user.displayName || 'Not set'}</span>
              </li>
              <li>
                <span className="account-summary-label">Primary email</span>
                <span>{user.email}</span>
              </li>
            </ul>
          </section>
        ) : null}

        <section className="account-section">
          <h2>Additional contact information</h2>
          <form className="account-form" onSubmit={handleAdditionalInfoSubmit}>
            <div className="form-grid">
              <label htmlFor="account-phone" className="form-field">
                <span className="form-label">Phone number</span>
                <input
                  id="account-phone"
                  name="phoneNumber"
                  type="tel"
                  value={additionalInfo.phoneNumber}
                  onChange={handleAdditionalInfoChange}
                  placeholder="Add a phone number"
                />
              </label>

              <label htmlFor="account-address" className="form-field form-field-full">
                <span className="form-label">Mailing address</span>
                <textarea
                  id="account-address"
                  name="address"
                  rows={3}
                  value={additionalInfo.address}
                  onChange={handleAdditionalInfoChange}
                  placeholder="Street, city, state, ZIP"
                />
              </label>

              <label htmlFor="account-backup-primary" className="form-field">
                <span className="form-label">Backup email (primary)</span>
                <input
                  id="account-backup-primary"
                  name="backupEmailPrimary"
                  type="email"
                  value={additionalInfo.backupEmailPrimary}
                  onChange={handleAdditionalInfoChange}
                  placeholder="Add a backup email"
                />
              </label>

              <label htmlFor="account-backup-secondary" className="form-field">
                <span className="form-label">Backup email (secondary)</span>
                <input
                  id="account-backup-secondary"
                  name="backupEmailSecondary"
                  type="email"
                  value={additionalInfo.backupEmailSecondary}
                  onChange={handleAdditionalInfoChange}
                  placeholder="Optional additional backup email"
                />
              </label>
            </div>

            <div className="form-actions">
              <button type="submit">Save contact info</button>
              {additionalInfoSaved ? (
                <span className="form-feedback">Saved locally — sync options coming soon.</span>
              ) : null}
            </div>
          </form>
        </section>

        <section className="account-section">
          <h2>Notification preferences</h2>
          <p className="account-hint">
            We are designing notification controls for trade activity alerts.
            Expect options like the ones below in an upcoming release.
          </p>
          <fieldset className="notification-preview" disabled>
            <legend className="sr-only">Notification controls preview</legend>
            <label className="notification-option">
              <input type="checkbox" checked readOnly />
              Email me when cards I need are offered for trade
            </label>
            <label className="notification-option">
              <input type="checkbox" readOnly />
              Notify me about upcoming community events
            </label>
            <label className="notification-option">
              <input type="checkbox" readOnly />
              Alerts for direct trade messages
            </label>
          </fieldset>
        </section>
      </section>
    </AuthGuard>
  );
}

export default AccountPage;
