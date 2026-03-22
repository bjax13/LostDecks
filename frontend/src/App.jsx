import { useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { PostHogPageviews } from "./analytics/PostHogPageviews.jsx";
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

function MainNav() {
  const { user, logout, loading } = useAuth();
  const { openAuthModal } = useAuthModal();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset menu when the route changes (body only calls stable setState)
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Sign out failed", err);
    }
  };

  const panelClassName = menuOpen ? "main-nav__panel main-nav__panel--open" : "main-nav__panel";

  return (
    <nav className="main-nav" aria-label="Primary">
      <button
        type="button"
        className="main-nav__menu-toggle"
        aria-expanded={menuOpen}
        aria-controls="main-nav-panel"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className="main-nav__menu-toggle-bars" aria-hidden="true">
          <span className="main-nav__menu-toggle-bar" />
          <span className="main-nav__menu-toggle-bar" />
          <span className="main-nav__menu-toggle-bar" />
        </span>
        <span className="main-nav__menu-toggle-label">{menuOpen ? "Close" : "Menu"}</span>
      </button>
      <div className={panelClassName} id="main-nav-panel">
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
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter future={ROUTER_FUTURE_FLAGS}>
      <PostHogPageviews />
      <MainNav />
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
