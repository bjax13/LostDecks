import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Cards from './pages/Cards';
import CardDetail from './pages/CardDetail';
import NotFound from './pages/NotFound';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ForgotPassword from './pages/Auth/ForgotPassword';
import CollectionPage from './pages/Collection';
import OffersPage from './pages/Offers';
import AccountPage from './pages/Account';
import { useAuth } from './contexts/AuthContext';
import { useAuthModal } from './contexts/AuthModalContext.jsx';
import EmulatorBanner from './components/Dev/EmulatorBanner';

function App() {
  const { user, logout, loading } = useAuth();
  const { openAuthModal } = useAuthModal();

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Sign out failed', err);
    }
  };

  return (
    <BrowserRouter>
      <EmulatorBanner />
      <nav className="main-nav">
        <div className="main-nav__links">
          <Link to="/">Home</Link>
          <Link to="/cards">Cards</Link>
          <Link to="/collections">Collection</Link>
          <Link to="/offers">Offers</Link>
          <Link to="/account">Account</Link>
        </div>
        <div className="main-nav__auth">
          {loading ? (
            <span className="main-nav__welcome">Checking session…</span>
          ) : user ? (
            <>
              <span className="main-nav__welcome">Hi, {user.displayName || user.email}</span>
              <button type="button" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/auth/login">Sign in</Link>
              <button type="button" onClick={() => openAuthModal()}>
                Quick sign in
              </button>
            </>
          )}
        </div>
      </nav>
      <hr />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cards" element={<Cards />} />
        <Route path="/cards/:cardId" element={<CardDetail />} />
        <Route path="/cards/:cardId/:skuId" element={<CardDetail />} />
        <Route path="/collections" element={<CollectionPage />} />
        <Route path="/offers" element={<OffersPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />
        <Route path="/auth/forgot" element={<ForgotPassword />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
