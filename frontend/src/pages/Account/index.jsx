import AuthGuard from '../../components/Auth/AuthGuard';
import { useAuth } from '../../contexts/AuthContext';

function AccountPage() {
  const { user } = useAuth();

  return (
    <AuthGuard fallback={<p>Loading account…</p>}>
      <section>
        <h1>Account Settings</h1>
        {user ? (
          <ul>
            <li>Display name: {user.displayName || 'Not set'}</li>
            <li>Email: {user.email}</li>
          </ul>
        ) : null}
        <p>More account preferences coming soon.</p>
      </section>
    </AuthGuard>
  );
}

export default AccountPage;
