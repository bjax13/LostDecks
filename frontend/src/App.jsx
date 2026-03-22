import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { useAuthModal } from "./contexts/AuthModalContext.jsx";
import AccountPage from "./pages/Account";
import ForgotPassword from "./pages/Auth/ForgotPassword";
import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";
import CollectibleDetailPage from "./pages/CollectibleDetail";
import CollectiblesPage from "./pages/Collectibles";
import CollectionPage from "./pages/Collection";
import Home from "./pages/Home";
import MarketPage from "./pages/Market";
import NotFound from "./pages/NotFound";
import { ROUTER_FUTURE_FLAGS } from "./routerFuture.js";

function App() {
  const { user, logout, loading } = useAuth();
  const { openAuthModal } = useAuthModal();

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Sign out failed", err);
    }
  };

  return (
    <BrowserRouter future={ROUTER_FUTURE_FLAGS}>
      <nav className="main-nav">
        <div className="main-nav__links">
          <Link to="/">Home</Link>
          <Link to="/collectibles">Collectibles</Link>
          <Link to="/collections">Collection</Link>
          <Link to="/market">Market</Link>
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
        <Route path="/collectibles" element={<CollectiblesPage />} />
        <Route path="/collectibles/:collectibleId" element={<CollectibleDetailPage />} />
        <Route path="/collectibles/:collectibleId/:skuId" element={<CollectibleDetailPage />} />
        <Route path="/collections" element={<CollectionPage />} />
        <Route path="/market" element={<MarketPage />} />
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
