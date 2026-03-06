import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import { useWindowState } from './hooks/useWindowState';
import Launchpad from './pages/Launchpad';
import AreaPage from './pages/AreaPage';
import SkillPage from './pages/SkillPage';
import MarketplacePage from './pages/MarketplacePage';


/**
 * ARCHIVED LEGACY SYSTEM STUBS
 * These components are part of the legacy system and have been moved to src/legacy_archive.
 * They are stubbed here to allow the router to function without reintroducing legacy dependency chains.
 */
const ArchivedPage = ({ name }) => (
  <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontFamily: 'sans-serif' }}>
    <h2 style={{ marginBottom: '10px' }}>{name} (Archived)</h2>
    <p>This component was moved to <code>src/legacy_archive</code> during the V2 refactor.</p>

  </div>
);

import JournalPage from './pages/JournalPage';
import FocusPage from './pages/FocusPage';

const Home = () => <ArchivedPage name="Home" />;
const AreaDetail = () => <AreaPage />;
const SkillDetail = () => <SkillPage />;
const Marketplace = () => <MarketplacePage />;
const Journal = () => <JournalPage />;
const Calendar = () => <ArchivedPage name="Calendar" />;
const Settings = () => <ArchivedPage name="Settings" />;
const WarheadChatPage = () => <ArchivedPage name="Warhead Chat" />;
const StoreProvider = ({ children }) => <>{children}</>;
const WarheadChat = () => null;
const WarheadPulse = () => null;
const WarheadPrompt = () => null;
const Manifesting = () => <ArchivedPage name="Manifesting" />;
const Wealth = () => <ArchivedPage name="Wealth" />;
const WealthItemDetail = () => <ArchivedPage name="Wealth Item Detail" />;
const GenericTracker = () => <ArchivedPage name="Generic Tracker" />;
const BeliefDetail = () => <ArchivedPage name="Belief Detail" />;
const SatsLogger = () => null;
const DailyRituals = () => null;

const LegacyApp = () => (
  <StoreProvider>
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Launchpad />} />
        <Route path="launchpad" element={<Launchpad />} />
        <Route path="home" element={<Home />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="journal" element={<Journal />} />
        <Route path="settings" element={<Settings />} />
        <Route path="warhead" element={<WarheadChatPage />} />
        <Route path="area/:id" element={<AreaDetail />} />
        <Route path="skill/:id" element={<SkillDetail />} />
        {/* System Trackers */}
        <Route path="beliefs/:id" element={<BeliefDetail />} />
        <Route path="trackers/manifesting" element={<Manifesting />} />
        <Route path="trackers/wealth" element={<Wealth />} />
        <Route path="wealth/:id" element={<WealthItemDetail />} />
        <Route path="trackers/:trackerId" element={<GenericTracker />} />

      </Route>
    </Routes>
    <DailyRituals />
    <WarheadPulse />
    <WarheadPrompt />
    <WarheadChat />
    <SatsLogger />
  </StoreProvider>
);

import { ThemeProvider } from './context/ThemeContext';

function App() {
  useWindowState();
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/focus" element={<FocusPage />} />
          {/* LEGACY APPLICATION */}
          <Route path="/*" element={<LegacyApp />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}


export default App;
