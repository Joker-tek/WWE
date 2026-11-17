import { AlertTriangle, Bell, Brain, CalendarClock, CheckCircle2, Flame, Info, Plus, Swords, Trophy, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChampionCard, MatchList, RefList } from '../components/display';
import { SuperstarForm } from '../components/forms';
import { Avatar, BrandBadge, Card, Empty, Form, Meter, Stat } from '../components/ui';
import { BRANDS } from '../domain/constants';
import { buildNotices } from '../domain/notifications';
import type { Gender } from '../domain/schema';
import { recordOf } from '../domain/stats';
import { formatDate, plural } from '../domain/util';
import { useData, useDerived, useStore } from '../store/store';

export function Dashboard() {
  const u = useData();
  const d = useDerived();
  const nav = useNavigate();
  const fileWrittenAt = useStore((s) => s.fileWrittenAt);
  const [adding, setAdding] = useState(false);

  const men = u.superstars.filter((s) => s.gender === 'male' && s.status !== 'released');
  const women = u.superstars.filter((s) => s.gender === 'female' && s.status !== 'released');
  const activeRivalries = u.rivalries.filter((r) => r.status === 'active').sort((a, b) => b.intensity - a.intensity);
  const activeStories = u.storylines.filter((s) => s.status === 'active');
  const activeTitles = u.championships.filter((c) => c.active).sort((a, b) => a.order - b.order);
  const filled = activeTitles.filter((c) => d.currentReign.has(c.id)).length;
  const recent = [...d.completed].reverse().slice(0, 6);
  const notices = buildNotices(u, d, fileWrittenAt);
  const totals = d.completed.reduce(
    (acc, m) => {
      if (m.outcome === 'win') acc.decisive++;
      else acc.draws++;
      if (m.titleChanged) acc.changes++;
      return acc;
    },
    { decisive: 0, draws: 0, changes: 0 },
  );

  return (
    <div>
      <div className="hero">
        <div className="eyebrow">Universe dashboard · {formatDate(d.today)}</div>
        <h1 className="metal-text">{u.meta.universeName}</h1>
        <div className="sub">
          {plural(u.superstars.length, 'superstar')} · {plural(u.championships.length, 'championship')} · {plural(d.completed.length, 'match', 'matches')} recorded
        </div>
        <div className="btn-group mt">
          <button className="btn btn-primary" onClick={() => nav('/matches/new')}>
            <Plus size={16} /> Record match
          </button>
          <button className="btn" onClick={() => nav('/matchmaker')}>
            <Brain size={16} /> Matchmaker
          </button>
          <button className="btn" onClick={() => setAdding(true)}>
            <UserPlus size={16} /> Add superstar
          </button>
        </div>
      </div>

      <div className="grid grid-stats mb">
        <Stat accent label="Superstars" value={men.length + women.length} foot={`${men.length} men · ${women.length} women`} to="/roster/male" />
        <Stat label="Champions" value={`${filled}/${activeTitles.length}`} foot={`${activeTitles.length - filled} vacant`} to="/championships" />
        <Stat label="Active rivalries" value={activeRivalries.length} foot={`${u.rivalries.length} total`} to="/rivalries" />
        <Stat label="Storylines" value={activeStories.length} foot="active" to="/storylines" />
        <Stat label="Matches" value={d.completed.length} foot={`${totals.decisive} decisive · ${totals.draws} draws/NC`} to="/matches" />
        <Stat label="Upcoming" value={d.scheduled.length} foot="booked matches" to="/matches?status=scheduled" />
        <Stat label="Title changes" value={totals.changes} foot="in recorded matches" to="/championships" />
      </div>

      <div className="grid grid-3 mb">
        {BRANDS.map((b) => {
          const roster = u.superstars.filter((s) => s.brand === b.key && s.status !== 'released');
          const titles = activeTitles.filter((c) => c.brand === b.key);
          const lastMatch = [...d.completed].reverse().find((m) => m.brand === b.key);
          const top = roster.filter((s) => d.rank.has(s.id)).sort((x, y) => d.rank.get(x.id)! - d.rank.get(y.id)!)[0];
          return (
            <Link key={b.key} to={`/brand/${b.key}`} className="card hoverable" style={{ borderTop: `3px solid ${b.color}` }}>
              <div className="card-pad stack-sm">
                <div className="row between">
                  <h3 className="display" style={{ fontSize: 20 }}>
                    {b.name}
                  </h3>
                  <BrandBadge brand={b.key} />
                </div>
                <div className="row wrap small muted" style={{ gap: 14 }}>
                  <span>{roster.filter((s) => s.gender === 'male').length} men</span>
                  <span>{roster.filter((s) => s.gender === 'female').length} women</span>
                  <span>{titles.filter((c) => d.currentReign.has(c.id)).length}/{titles.length} titles held</span>
                  <span>{u.rivalries.filter((r) => r.brand === b.key && r.status === 'active').length} rivalries</span>
                </div>
                <div className="small">
                  {top ? (
                    <>
                      Top star: <strong>{top.ringName}</strong>
                    </>
                  ) : (
                    <span className="muted">No active roster</span>
                  )}
                </div>
                <div className="tiny muted">{lastMatch ? `Last match ${formatDate(lastMatch.date)}` : 'No matches yet'}</div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="cols-main">
        <div className="stack">
          <Card title="Current champions" icon={<Trophy size={16} />} actions={<Link className="btn btn-sm btn-ghost" to="/championships">All titles</Link>}>
            {activeTitles.length ? (
              <div className="grid grid-4">
                {activeTitles.map((c) => (
                  <ChampionCard key={c.id} c={c} d={d} />
                ))}
              </div>
            ) : (
              <Empty title="No championships yet" action={<Link className="btn" to="/championships">Create one</Link>} />
            )}
          </Card>
          <Card title="Upcoming matches" icon={<CalendarClock size={16} />} flush actions={<Link className="btn btn-sm btn-ghost" to="/matches/new?status=scheduled">Book match</Link>}>
            <MatchList matches={d.scheduled.slice(0, 6)} empty={<Empty title="Nothing booked" text="Book matches yourself or approve suggestions from the Matchmaker." />} />
          </Card>
          <Card title="Recent results" icon={<CheckCircle2 size={16} />} flush actions={<Link className="btn btn-sm btn-ghost" to="/matches">All matches</Link>}>
            <MatchList matches={recent} empty={<Empty title="No results yet" action={<Link className="btn btn-primary" to="/matches/new">Record your first match</Link>} />} />
          </Card>
        </div>
        <div className="stack">
          <Card title="Notifications" icon={<Bell size={16} />} flush>
            {notices.length ? (
              notices.slice(0, 10).map((n) => {
                const body = (
                  <div className={`notice ${n.level}`}>
                    <span className="ico">{n.level === 'danger' || n.level === 'warning' ? <AlertTriangle size={16} /> : n.level === 'success' ? <Trophy size={16} /> : <Info size={16} />}</span>
                    <div className="grow">
                      <div className="strong">{n.title}</div>
                      <div className="small muted">{n.text}</div>
                    </div>
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} to={n.link} style={{ display: 'block' }}>
                    {body}
                  </Link>
                ) : (
                  <div key={n.id}>{body}</div>
                );
              })
            ) : (
              <Empty title="All clear" text="No alerts right now." />
            )}
          </Card>
          <Card title="Active rivalries" icon={<Swords size={16} />} flush actions={<Link className="btn btn-sm btn-ghost" to="/rivalries">All</Link>}>
            {activeRivalries.length ? (
              <div className="list">
                {activeRivalries.slice(0, 6).map((r) => (
                  <Link key={r.id} to={`/rivalries/${r.id}`} className="list-item">
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="strong truncate">{r.name}</div>
                      <div className="small muted truncate">
                        <RefList refs={r.participants} d={d} plain />
                      </div>
                    </div>
                    <Meter value={r.intensity} />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty title="No active rivalries" />
            )}
          </Card>
          <TopPerformers gender="male" />
          <TopPerformers gender="female" />
        </div>
      </div>
      {adding && <SuperstarForm onClose={() => setAdding(false)} />}
    </div>
  );
}

function TopPerformers({ gender }: { gender: Gender }) {
  const u = useData();
  const d = useDerived();
  const top = u.superstars
    .filter((s) => s.gender === gender && d.rank.has(s.id))
    .sort((a, b) => d.rank.get(a.id)! - d.rank.get(b.id)!)
    .slice(0, 5);
  return (
    <Card title={`${gender === 'male' ? "Men's" : "Women's"} top 5`} icon={<Flame size={16} />} flush actions={<Link className="btn btn-sm btn-ghost" to="/stats">Rankings</Link>}>
      {top.length ? (
        <div className="list">
          {top.map((s) => {
            const rec = recordOf(d, s.id);
            return (
              <Link key={s.id} to={`/superstars/${s.id}`} className="list-item">
                <span className="display muted" style={{ width: 22 }}>
                  {d.rank.get(s.id)}
                </span>
                <Avatar name={s.ringName} src={s.imageUrl} brand={s.brand} size={32} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="strong truncate">{s.ringName}</div>
                  <div className="tiny muted">
                    {rec.wins}-{rec.losses}-{rec.draws}
                  </div>
                </div>
                <Form form={rec.form.slice(0, 3)} />
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty title="No active superstars" />
      )}
    </Card>
  );
}
