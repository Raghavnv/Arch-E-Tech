import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import BackgroundPattern from './components/BackgroundPattern';
import SharedView from './components/SharedView';

// pages behind the login: without a token, go to /auth and come back afterwards
function RequireAuth({ children }) {
  const location = useLocation();
  if (!localStorage.getItem('token')) {
    return <Navigate to="/auth" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-transparent text-zinc-100 font-sans selection:bg-white selection:text-black">
        <BackgroundPattern />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/welcome" element={<RequireAuth><OnboardingCinematic /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/new-project" element={<RequireAuth><NewProject /></RequireAuth>} />
          <Route path="/studio" element={<RequireAuth><Studio /></RequireAuth>} />
          <Route path="/render-studio" element={<RequireAuth><RenderStudio /></RequireAuth>} />
          <Route path="/war-room" element={<RequireAuth><WarRoom /></RequireAuth>} />
          <Route path="/shared/:token" element={<SharedView />} />
          <Route path="/immersive" element={<RequireAuth><ImmersiveView /></RequireAuth>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
