import { useEffect } from 'react';
import { HashRouter, Link, Route, Routes } from 'react-router';
import { FeedbackProvider } from './components/feedback';
import { Layout } from './components/Layout';
import { Empty } from './components/ui';
import { BrandPage } from './pages/BrandPage';
import { ChampionshipPage, ChampionshipsPage } from './pages/Championships';
import { Dashboard } from './pages/Dashboard';
import { DataPage } from './pages/DataPage';
import { MatchFormPage } from './pages/MatchForm';
import { MatchesPage } from './pages/MatchesPage';
import { MatchmakerPage } from './pages/Matchmaker';
import { RivalriesPage, RivalryPage } from './pages/Rivalries';
import { RosterPage } from './pages/RosterPage';
import { StatsPage } from './pages/StatsPage';
import { StorylinePage, StorylinesPage } from './pages/Storylines';
import { SuperstarPage } from './pages/SuperstarPage';
import { TagTeamPage, TagTeamsPage } from './pages/TagTeams';
import { Welcome } from './pages/Welcome';
import { initStore, useStore } from './store/store';

export function App() {
  const { loaded, data, loadError } = useStore();
  useEffect(() => {
    void initStore();
  }, []);

  if (!loaded) {
    return (
      <div className="welcome">
        <div className="muted">Loading your universe…</div>
      </div>
    );
  }
  return (
    <FeedbackProvider>
      {!data ? (
        <Welcome loadError={loadError} />
      ) : (
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      )}
    </FeedbackProvider>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="brand/:brand" element={<BrandPage />} />
        <Route path="roster/:gender" element={<RosterPage />} />
        <Route path="superstars/:id" element={<SuperstarPage />} />
        <Route path="tag-teams" element={<TagTeamsPage />} />
        <Route path="tag-teams/:id" element={<TagTeamPage />} />
        <Route path="championships" element={<ChampionshipsPage />} />
        <Route path="championships/:id" element={<ChampionshipPage />} />
        <Route path="matches" element={<MatchesPage />} />
        <Route path="matches/new" element={<MatchFormPage />} />
        <Route path="matches/:id/edit" element={<MatchFormPage />} />
        <Route path="matchmaker" element={<MatchmakerPage />} />
        <Route path="rivalries" element={<RivalriesPage />} />
        <Route path="rivalries/:id" element={<RivalryPage />} />
        <Route path="storylines" element={<StorylinesPage />} />
        <Route path="storylines/:id" element={<StorylinePage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="data" element={<DataPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <Empty
      title={`That ${what} doesn't exist`}
      text="It may have been deleted, or the link is wrong."
      action={
        <Link to="/" className="btn">
          Back to dashboard
        </Link>
      }
    />
  );
}
