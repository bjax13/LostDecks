import AuthGuard from "../../components/Auth/AuthGuard";
import { useAuth } from "../../contexts/AuthContext";
import "./Account.css";

function AccountPage() {
  const { user } = useAuth();

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
      </section>
    </AuthGuard>
  );
}

export default AccountPage;
