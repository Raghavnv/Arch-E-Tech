import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import NewProject from './components/NewProject';
import Studio from './components/Studio';
import Auth from './components/Auth';
import OnboardingCinematic from './components/OnboardingCinematic';
import HowItWorks from './components/HowItWorks';
import RenderStudio from './components/RenderStudio';
import WarRoom from './components/WarRoom';
import ImmersiveView from './components/ImmersiveView';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-white selection:text-black">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/welcome" element={<OnboardingCinematic />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/new-project" element={<NewProject />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/render-studio" element={<RenderStudio />} />
          <Route path="/war-room" element={<WarRoom />} />
          <Route path="/immersive" element={<ImmersiveView />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
