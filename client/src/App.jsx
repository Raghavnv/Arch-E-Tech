import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import NewProject from './components/NewProject';
import Studio from './components/Studio';

function App() {
  return (
    <BrowserRouter>
      <div className="bg-black text-zinc-100 min-h-screen selection:bg-zinc-800 selection:text-white font-sans antialiased">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/new-project" element={<NewProject />} />
          <Route path="/studio" element={<Studio />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
