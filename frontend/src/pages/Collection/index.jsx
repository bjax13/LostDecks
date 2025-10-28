import AuthGuard from '../../components/Auth/AuthGuard';

function CollectionPage() {
  return (
    <AuthGuard fallback={<p>Loading collection…</p>}>
      <section>
        <h1>Your Collection</h1>
        <p>Track and manage your Lost Tales cards here.</p>
      </section>
    </AuthGuard>
  );
}

export default CollectionPage;
