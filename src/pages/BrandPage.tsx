import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { NotFound } from '../App';
import { ChampionCard, MatchList } from '../components/display';
import { Avatar, Card, Empty, Form, Stat, Tabs } from '../components/ui';
import { BRANDS } from '../domain/constants';
import type { BrandKey, Gender } from '../domain/schema';
import { recordOf } from '../domain/stats';
import { useData, useDerived } from '../store/store';
import { RivalryList } from './Rivalries';
import { RosterView } from './RosterPage';
import { StorylineList } from './Storylines';
import { TeamGrid } from './TagTeams';

type Tab = 'overview' | 'male' | 'female' | 'teams' | 'titles' | 'rivalries' | 'storylines' | 'matches';

export function BrandPage() {
  const { brand } = useParams();
  const info = BRANDS.find((b) => b.key === brand);
  if (!info) return <NotFound />;
  return <BrandInner key={info.key} brand={info.key} />;
}

function BrandInner({ brand }: { brand: BrandKey }) {
  const u = useData();
  const d = useDerived();
  const nav = useNavigate();
  const info = BRANDS.find((b) => b.key === brand)!;
  const [tab, setTab] = useState<Tab>('overview');
  const roster = u.superstars.filter((s) => s.brand === brand && s.status !== 'released');
  const titles = u.championships.filter((c) => c.brand === brand && c.active).sort((a, b) => a.order - b.order);
  const matches = [...d.completed].filter((m) => m.brand === brand).reverse();
  const upcoming = d.scheduled.filter((m) => m.brand === brand);
  const rivalries = u.rivalries.filter((r) => r.brand === brand && r.status !== 'ended');
  const stories = u.storylines.filter((s) => s.brand === brand && (s.status === 'active' || s.status === 'planning'));
  const teams = u.tagTeams.filter((t) => t.brand === brand && t.status !== 'disbanded');

  const top = (g: Gender) =>
    roster
      .filter((s) => s.gender === g && d.rank.has(s.id))
      .sort((a, b) => d.rank.get(a.id)! - d.rank.get(b.id)!)
      .slice(0, 5);

  return (
    <div>
      <div className="hero brand-hero" style={{ background: `radial-gradient(900px 260px at 0% 0%, ${info.color}66, transparent 65%), linear-gradient(135deg, #16161c, #0b0b0f)` }}>
        <div className="eyebrow" style={{ color: info.color }}>
          Brand
        </div>
        <h1 className="metal-text">{info.name}</h1>
        <div className="sub">
          {roster.length} superstars · {titles.length} championships · {rivalries.length} ongoing rivalries
        </div>
        <div className="btn-group mt">
          <button className="btn btn-primary" onClick={() => nav('/matches/new', { state: null })}>
            <Plus size={16} /> Record match
          </button>
          <Link className="btn" to="/matchmaker">
            Matchmaker
          </Link>
        </div>
      </div>
      <div className="grid grid-stats mb">
        <Stat accent label="Men" value={roster.filter((s) => s.gender === 'male').length} />
        <Stat label="Women" value={roster.filter((s) => s.gender === 'female').length} />
        <Stat label="Injured" value={roster.filter((s) => s.status === 'injured').length} />
        <Stat label="Matches" value={matches.length} />
        <Stat label="Upcoming" value={upcoming.length} />
        <Stat label="Tag teams" value={teams.length} />
      </div>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'male', label: "Men's roster", count: roster.filter((s) => s.gender === 'male').length },
          { key: 'female', label: "Women's roster", count: roster.filter((s) => s.gender === 'female').length },
          { key: 'teams', label: 'Tag teams', count: teams.length },
          { key: 'titles', label: 'Championships', count: titles.length },
          { key: 'rivalries', label: 'Rivalries', count: rivalries.length },
          { key: 'storylines', label: 'Storylines', count: stories.length },
          { key: 'matches', label: 'Matches', count: matches.length + upcoming.length },
        ]}
      />
      {tab === 'overview' && (
        <div className="cols-main">
          <div className="stack">
            <Card title="Champions">
              {titles.length ? (
                <div className="grid grid-4">
                  {titles.map((c) => (
                    <ChampionCard key={c.id} c={c} d={d} />
                  ))}
                </div>
              ) : (
                <Empty title={`No ${info.short} championships`} />
              )}
            </Card>
            <Card title="Upcoming" flush>
              <MatchList matches={upcoming.slice(0, 5)} empty={<Empty title="Nothing booked" />} />
            </Card>
            <Card title="Recent results" flush>
              <MatchList matches={matches.slice(0, 6)} />
            </Card>
          </div>
          <div className="stack">
            {(['male', 'female'] as Gender[]).map((g) => (
              <Card key={g} title={`${g === 'male' ? "Men's" : "Women's"} top 5`} flush>
                {top(g).length ? (
                  <div className="list">
                    {top(g).map((s) => {
                      const rec = recordOf(d, s.id);
                      return (
                        <Link key={s.id} to={`/superstars/${s.id}`} className="list-item">
                          <span className="display muted" style={{ width: 24 }}>
                            #{d.rank.get(s.id)}
                          </span>
                          <Avatar name={s.ringName} src={s.imageUrl} brand={s.brand} size={30} />
                          <span className="grow strong truncate">{s.ringName}</span>
                          <Form form={rec.form.slice(0, 3)} />
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <Empty title="No active superstars" />
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
      {tab === 'male' && <RosterView gender="male" brand={brand} />}
      {tab === 'female' && <RosterView gender="female" brand={brand} />}
      {tab === 'teams' && <TeamGrid brand={brand} />}
      {tab === 'titles' && (
        <div className="stack">
          {(['male', 'female'] as Gender[]).map((g) => {
            const list = titles.filter((c) => c.gender === g);
            return (
              <Card key={g} title={`${g === 'male' ? "Men's" : "Women's"} championships`}>
                {list.length ? (
                  <div className="grid grid-4">
                    {list.map((c) => (
                      <ChampionCard key={c.id} c={c} d={d} />
                    ))}
                  </div>
                ) : (
                  <Empty title="None" />
                )}
              </Card>
            );
          })}
        </div>
      )}
      {tab === 'rivalries' && <RivalryList brand={brand} />}
      {tab === 'storylines' && <StorylineList brand={brand} />}
      {tab === 'matches' && (
        <div className="stack">
          {upcoming.length > 0 && (
            <Card title="Upcoming" flush>
              <MatchList matches={upcoming} />
            </Card>
          )}
          <Card title="Results" flush>
            <MatchList matches={matches} limit={100} />
          </Card>
        </div>
      )}
    </div>
  );
}
