import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';
import BackgroundPattern from './components/BackgroundPattern';
import ErrorBoundary from './components/ErrorBoundary';
import { useLocation } from 'react-router-dom';

// pages load when first visited, so the landing page and sign-in don't download the 3D engine and every tool
const Dashboard = lazy(() => import('./components/Dashboard'));
const NewProject = lazy(() => import('./components/NewProject'));
const Studio = lazy(() => import('./components/Studio'));
const OnboardingCinematic = lazy(() => import('./components/OnboardingCinematic'));
const HowItWorks = lazy(() => import('./components/HowItWorks'));
const RenderStudio = lazy(() => import('./components/RenderStudio'));
const Overview = lazy(() => import('./components/Overview'));
const WarRoom = lazy(() => import('./components/WarRoom'));
const ImmersiveView = lazy(() => import('./components/ImmersiveView'));
const SharedProject = lazy(() => import('./components/SharedProject'));
const RoomDesigner = lazy(() => import('./components/RoomDesigner'));
const ARView = lazy(() => import('./components/ARView'));
const ConstructionTracker = lazy(() => import('./components/ConstructionTracker'));

// a fresh boundary per page, so leaving a crashed page clears the error
function RoutedBoundary({ children }) {
  const location = useLocation();
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-transparent text-zinc-100 font-sans selection:bg-white selection:text-black">
        <BackgroundPattern />
        <RoutedBoundary>
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-300" /></div>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/welcome" element={<OnboardingCinematic />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/new-project" element={<NewProject />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/render-studio" element={<RenderStudio />} />
          <Route path="/room-designer" element={<RoomDesigner />} />
          <Route path="/ar" element={<ARView />} />
          <Route path="/tracker" element={<ConstructionTracker />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/war-room" element={<WarRoom />} />
          <Route path="/immersive" element={<ImmersiveView />} />
          <Route path="/shared/:token" element={<SharedProject />} />
        </Routes>
        </Suspense>
        </RoutedBoundary>
      </div>
    </Router>
  );
}

export default App;
