import AuthGuard from '../../components/Auth/AuthGuard';

function OffersPage() {
  return (
    <AuthGuard fallback={<p>Loading offers…</p>}>
      <section>
        <h1>Marketplace Offers</h1>
        <p>View and manage your trade offers once you are authenticated.</p>
      </section>
    </AuthGuard>
  );
}

export default OffersPage;
