import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Test from './pages/Test';
import Learning from './pages/Learning';
import History from './pages/History';

import Footer from './components/Footer';

function App() {
  return (
    <Router>
      <div className="nav-header">
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>Wordlist Trainer</Link>
      </div>
      <div className="container" style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/test" element={<Test />} />
          <Route path="/learning" element={<Learning />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </div>
      <Footer />
    </Router>
  );
}

export default App;
