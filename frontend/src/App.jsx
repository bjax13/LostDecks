import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Cards from './pages/Cards';
import MarketMaker from './pages/MarketMaker';
import MarketTaker from './pages/MarketTaker';
import NotFound from './pages/NotFound';

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Home</Link> |{' '}
        <Link to="/cards">Cards</Link> |{' '}
        <Link to="/maker">Market Maker</Link> |{' '}
        <Link to="/taker">Market Taker</Link>
      </nav>
      <hr />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cards" element={<Cards />} />
        <Route path="/maker" element={<MarketMaker />} />
        <Route path="/taker" element={<MarketTaker />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

