import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProfileProvider, useProfile } from './context/ProfileContext';

const AppLayout = lazy(() =>
  import('./layout/AppLayout').then((module) => ({ default: module.AppLayout })),
);
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const BloodPage = lazy(() =>
  import('./pages/BloodPage').then((module) => ({ default: module.BloodPage })),
);
const SleepPage = lazy(() =>
  import('./pages/SleepPage').then((module) => ({ default: module.SleepPage })),
);
const HeartPage = lazy(() =>
  import('./pages/HeartPage').then((module) => ({ default: module.HeartPage })),
);
const HealthGuidesPage = lazy(() =>
  import('./pages/HealthGuidesPage').then((module) => ({ default: module.HealthGuidesPage })),
);
const ImportPage = lazy(() =>
  import('./pages/ImportPage').then((module) => ({ default: module.ImportPage })),
);
const ProfilesPage = lazy(() =>
  import('./pages/ProfilesPage').then((module) => ({ default: module.ProfilesPage })),
);
const DailyCheckInPage = lazy(() =>
  import('./pages/DailyCheckInPage').then((module) => ({ default: module.DailyCheckInPage })),
);
const TrendsPage = lazy(() =>
  import('./pages/TrendsPage').then((module) => ({ default: module.TrendsPage })),
);
const BodyExplorerPage = lazy(() =>
  import('./pages/BodyExplorerPage').then((module) => ({ default: module.BodyExplorerPage })),
);
const HealthAssistantPage = lazy(() =>
  import('./pages/HealthAssistantPage').then((module) => ({ default: module.HealthAssistantPage })),
);
const ResearchPage = lazy(() =>
  import('./pages/ResearchPage').then((module) => ({ default: module.ResearchPage })),
);
const WelcomePage = lazy(() =>
  import('./pages/WelcomePage').then((module) => ({ default: module.WelcomePage })),
);

function Routing() {
  const { ready, profiles, initializationError } = useProfile();

  if (!ready) {
    return (
      <div className="grid h-full place-items-center bg-[#040914] text-sm text-slate-400">
        Initializing local database…
      </div>
    );
  }

  if (initializationError) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#040914] p-6 text-slate-100">
        <section role="alert" className="max-w-xl rounded-xl border border-rose-700/60 bg-rose-950/40 p-6">
          <h1 className="text-xl font-semibold">Local database unavailable</h1>
          <p className="mt-3 text-sm leading-relaxed">
            TUMI-HEALT could not open IndexedDB. Check that browser storage is enabled and available, then reload. No data was sent elsewhere.
          </p>
          <p className="mt-3 break-words text-sm text-rose-200">{initializationError}</p>
        </section>
      </main>
    );
  }

  const hasAnyProfile = profiles.length > 0;

  return (
    <Suspense
      fallback={
        <div className="grid h-full place-items-center bg-[#040914] text-sm text-slate-400">
          Loading TUMI-HEALT…
        </div>
      }
    >
      <Routes>
        <Route path="welcome" element={<WelcomePage />} />
        <Route
          element={hasAnyProfile ? <AppLayout /> : <Navigate to="/welcome" replace />}
        >
          <Route index element={<DashboardPage />} />
          <Route path="check-in" element={<DailyCheckInPage />} />
          <Route path="blood" element={<BloodPage />} />
          <Route path="sleep" element={<SleepPage />} />
          <Route path="cardiovascular" element={<HeartPage />} />
          <Route path="trends" element={<TrendsPage />} />
          <Route path="body" element={<BodyExplorerPage />} />
          <Route path="assistant" element={<HealthAssistantPage />} />
          <Route path="guides" element={<HealthGuidesPage />} />
          <Route path="hazards" element={<Navigate to="/guides?tab=risks" replace />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="research" element={<ResearchPage />} />
          <Route path="profiles" element={<ProfilesPage />} />
          <Route path="*" element={<Navigate to={hasAnyProfile ? '/' : '/welcome'} replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export function App() {
  return (
    <ProfileProvider>
      <Routing />
    </ProfileProvider>
  );
}
