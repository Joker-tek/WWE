import { Download } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { MatchList } from '../components/display';
import { SuperstarPicker } from '../components/pickers';
import { Avatar, BrandBadge, Card, Chips, type Column, DataTable, Empty, Form, PageHeader, RecordText, Streak, Tabs } from '../components/ui';
import { BRANDS, MATCH_TYPES, matchTypeLabel } from '../domain/constants';
import { toCsv } from '../domain/csv';
import type { BrandKey, Gender, Superstar } from '../domain/schema';
import { buildRecords, type CompetitorRecord, EMPTY_RECORD, headToHead, holderName, reignDays } from '../domain/stats';
import { formatDate, pct, realToday } from '../domain/util';
import { downloadText } from '../store/persistence';
import { useData, useDerived } from '../store/store';

type Tab = 'leaders' | 'rankings' | 'brands' | 'h2h' | 'types';

export function StatsPage() {
  const u = useData();
  const d = useDerived();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('leaders');
  const [brand, setBrand] = useState<BrandKey | 'all'>('all');
  const [gender, setGender] = useState<Gender | 'all'>('all');
  const [type, setType] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const minMatches = u.settings.minMatchesForPct;

  const matches = useMemo(
    () => d.completed.filter((m) => (type === 'all' || m.matchType === type) && (!from || m.date >= from) && (!to || m.date <= to)),
    [d.completed, type, from, to],
  );
  const records = useMemo(() => buildRecords(matches, 'superstar'), [matches]);
  const stars = u.superstars.filter((s) => (brand === 'all' || s.brand === brand) && (gender === 'all' || s.gender === gender));
  const rec = (s: Superstar): CompetitorRecord => records.get(s.id) ?? EMPTY_RECORD;
  const withMatches = stars.filter((s) => rec(s).matches > 0);
  const reigns = u.reigns.filter((r) => {
    if ((from && r.startDate < from) || (to && r.startDate > to)) return false;
    const t = d.titles.get(r.championshipId);
    if (!t || (gender !== 'all' && t.gender !== gender) || (brand !== 'all' && t.brand !== brand)) return false;
    return true;
  });
  const types = [...new Set([...MATCH_TYPES.map((m) => m.key), ...u.customMatchTypes])];

  const leader = (title: string, list: Superstar[], value: (s: Superstar) => number, fmt: (s: Superstar) => ReactNode = (s) => value(s)) => {
    const top = list
      .filter((s) => value(s) > 0)
      .sort((a, b) => value(b) - value(a))
      .slice(0, 10);
    return (
      <Card title={title} flush>
        {top.length ? (
          <div className="list">
            {top.map((s, i) => (
              <Link key={s.id} to={`/superstars/${s.id}`} className="list-item">
                <span className="display muted" style={{ width: 22 }}>
                  {i + 1}
                </span>
                <Avatar name={s.ringName} src={s.imageUrl} brand={s.brand} size={28} />
                <span className="grow strong truncate">{s.ringName}</span>
                <span className="display mono">{fmt(s)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <Empty title="No data yet" />
        )}
      </Card>
    );
  };

  const reignCount = (s: Superstar) => reigns.filter((r) => r.memberIds.includes(s.id)).length;

  const exportCsv = () => {
    const rows = stars.map((s) => {
      const r = rec(s);
      return [s.ringName, s.brand, s.gender, r.matches, r.wins, r.losses, r.draws, r.matches ? (r.winPct * 100).toFixed(1) : '', r.longestWin, r.longestLoss, reignCount(s)];
    });
    downloadText(
      `stats-${realToday()}.csv`,
      toCsv(['Superstar', 'Brand', 'Gender', 'Matches', 'Wins', 'Losses', 'Draws', 'Win %', 'Longest win streak', 'Longest losing streak', 'Title reigns'], rows),
      'text/csv',
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="Records"
        title="Stats & Rankings"
        sub="Every number is calculated live from your match history"
        actions={
          <button className="btn" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </button>
        }
      />
      <div className="filters">
        <Chips value={brand} onChange={setBrand} options={[{ key: 'all', label: 'All brands' }, ...BRANDS.map((b) => ({ key: b.key, label: b.short })), { key: 'none', label: 'Free agents' }]} />
        <Chips value={gender} onChange={setGender} options={[{ key: 'all', label: 'All' }, { key: 'male', label: "Men's" }, { key: 'female', label: "Women's" }]} />
      </div>
      <div className="filters">
        <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Match type">
          <option value="all">All match types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {matchTypeLabel(t)}
            </option>
          ))}
        </select>
        <label className="row small muted">
          From <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="row small muted">
          To <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {(from || to || type !== 'all') && (
          <button className="btn btn-ghost btn-sm" onClick={() => (setFrom(''), setTo(''), setType('all'))}>
            Clear filters
          </button>
        )}
        <span className="muted small">
          {matches.length} matches · brand filter uses each superstar's current brand
        </span>
      </div>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'leaders', label: 'Leaderboards' },
          { key: 'rankings', label: 'Power rankings' },
          { key: 'brands', label: 'Brand comparison' },
          { key: 'h2h', label: 'Head-to-head' },
          { key: 'types', label: 'Match types' },
        ]}
      />

      {tab === 'leaders' && (
        <div className="grid grid-3">
          {leader('Most wins', stars, (s) => rec(s).wins)}
          {leader('Most losses', stars, (s) => rec(s).losses)}
          {leader(`Highest win % (min ${minMatches})`, withMatches.filter((s) => rec(s).matches >= minMatches), (s) => rec(s).winPct + 1e-9, (s) => pct(rec(s).winPct))}
          {leader('Longest winning streak', stars, (s) => rec(s).longestWin)}
          {leader('Longest losing streak', stars, (s) => rec(s).longestLoss)}
          {leader('Most matches', stars, (s) => rec(s).matches)}
          {leader('Most championships won', stars, reignCount)}
          <Card title="Longest title reigns" flush>
            {reigns.length ? (
              <div className="list">
                {[...reigns]
                  .sort((a, b) => reignDays(b, d.today) - reignDays(a, d.today))
                  .slice(0, 10)
                  .map((r, i) => (
                    <Link key={r.id} to={`/championships/${r.championshipId}`} className="list-item">
                      <span className="display muted" style={{ width: 22 }}>
                        {i + 1}
                      </span>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="strong truncate">{holderName(d, r)}</div>
                        <div className="tiny muted truncate">
                          {d.titles.get(r.championshipId)?.name} · {formatDate(r.startDate)}
                          {r.endDate ? '' : ' · current'}
                        </div>
                      </div>
                      <span className="display mono">{reignDays(r, d.today)}d</span>
                    </Link>
                  ))}
              </div>
            ) : (
              <Empty title="No reigns yet" />
            )}
          </Card>
          {leader('Current win streak', stars, (s) => (rec(s).streak?.type === 'W' ? rec(s).streak!.count : 0), (s) => `W${rec(s).streak?.count}`)}
        </div>
      )}

      {tab === 'rankings' && (
        <div className="stack">
          <p className="small muted">
            Power score = popularity + card position + win % (weighted toward 50% for small samples) + last five results + current streak + gold held. Only active superstars are ranked. Rankings always use the full match history; the filters above only narrow who is shown.
          </p>
          {(gender === 'all' ? (['male', 'female'] as Gender[]) : [gender]).map((g) => (
            <Card key={g} title={`${g === 'male' ? "Men's" : "Women's"} power rankings`} flush>
              <DataTable
                rows={stars.filter((s) => s.gender === g && d.rank.has(s.id)).sort((a, b) => d.rank.get(a.id)! - d.rank.get(b.id)!)}
                rowKey={(s) => s.id}
                onRowClick={(s) => nav(`/superstars/${s.id}`)}
                limit={25}
                columns={rankingColumns(d)}
              />
            </Card>
          ))}
        </div>
      )}

      {tab === 'brands' && (
        <div className="grid grid-3">
          {BRANDS.map((b) => {
            const bm = matches.filter((m) => m.brand === b.key);
            const roster = u.superstars.filter((s) => s.brand === b.key && s.status !== 'released' && (gender === 'all' || s.gender === gender));
            const best = roster.filter((s) => rec(s).matches > 0).sort((x, y) => rec(y).wins - rec(x).wins)[0];
            const rated = bm.filter((m) => m.rating !== undefined);
            const avgRating = rated.length ? rated.reduce((a, m) => a + (m.rating ?? 0), 0) / rated.length : 0;
            const rows: [string, ReactNode][] = [
              ['Roster', roster.length],
              ['Matches', bm.length],
              ['Title matches', bm.filter((m) => m.championshipIds.length).length],
              ['Title changes', bm.filter((m) => m.titleChanged).length],
              ['Active rivalries', u.rivalries.filter((r) => r.brand === b.key && r.status === 'active').length],
              ['Average match rating', rated.length ? `${avgRating.toFixed(2)} ★` : '—'],
              ['Most wins', best ? `${best.ringName} (${rec(best).wins})` : '—'],
            ];
            return (
              <Card key={b.key} title={<><BrandBadge brand={b.key} /> {b.name}</>}>
                <table className="table">
                  <tbody>
                    {rows.map(([k, v]) => (
                      <tr key={k}>
                        <td className="muted">{k}</td>
                        <td className="num strong">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'h2h' && <HeadToHead />}

      {tab === 'types' && (
        <div className="grid grid-2">
          <Card title="Matches by type">
            <BarList items={countBy(matches.map((m) => matchTypeLabel(m.matchType)))} />
          </Card>
          <Card title="Finishes">
            <BarList items={countBy(matches.map((m) => (m.outcome === 'draw' ? 'Draw' : m.outcome === 'no_contest' ? 'No Contest' : m.finish || 'Unspecified')))} />
          </Card>
        </div>
      )}
    </div>
  );
}

function rankingColumns(d: ReturnType<typeof useDerived>): Column<Superstar>[] {
  const r = (s: Superstar) => d.starRecords.get(s.id) ?? EMPTY_RECORD;
  return [
    { key: 'rank', label: '#', render: (s) => d.rank.get(s.id), num: true },
    {
      key: 'name',
      label: 'Superstar',
      render: (s) => (
        <div className="row">
          <Avatar name={s.ringName} src={s.imageUrl} brand={s.brand} size={28} />
          <span className="strong">{s.ringName}</span>
        </div>
      ),
    },
    { key: 'brand', label: 'Brand', render: (s) => <BrandBadge brand={s.brand} /> },
    { key: 'score', label: 'Score', render: (s) => d.power.get(s.id), num: true },
    { key: 'rec', label: 'W-L-D', render: (s) => <RecordText rec={r(s)} />, num: true },
    { key: 'pct', label: 'Win %', render: (s) => (r(s).matches ? pct(r(s).winPct) : '—'), num: true },
    { key: 'streak', label: 'Streak', render: (s) => <Streak rec={r(s)} />, num: true },
    { key: 'form', label: 'Form', render: (s) => <Form form={r(s).form} /> },
    { key: 'gold', label: 'Gold', render: (s) => <span className="small" style={{ color: 'var(--gold)' }}>{(d.heldTitles.get(s.id) ?? []).map((t) => t.name).join(', ')}</span> },
  ];
}

function countBy(values: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function BarList({ items }: { items: [string, number][] }) {
  if (!items.length) return <Empty title="No matches yet" />;
  const max = Math.max(...items.map((i) => i[1]));
  return (
    <div className="bar-chart">
      {items.map(([k, v]) => (
        <div key={k} className="bar-row">
          <span className="truncate">{k}</span>
          <div className="bar">
            <span style={{ width: `${(v / max) * 100}%` }} />
          </div>
          <span className="mono strong">{v}</span>
        </div>
      ))}
    </div>
  );
}

function HeadToHead() {
  const d = useDerived();
  const [a, setA] = useState<string[]>([]);
  const [b, setB] = useState<string[]>([]);
  const h = a[0] && b[0] ? headToHead(d.completed, { type: 'superstar', id: a[0] }, { type: 'superstar', id: b[0] }) : null;
  return (
    <div className="stack">
      <div className="grid grid-2">
        <Card title="Superstar A">
          <SuperstarPicker value={a} onChange={setA} max={1} filter={{ includeInactive: true, exclude: b }} />
        </Card>
        <Card title="Superstar B">
          <SuperstarPicker value={b} onChange={setB} max={1} filter={{ includeInactive: true, exclude: a }} />
        </Card>
      </div>
      {h ? (
        <>
          <div className="card card-pad">
            <div className="h2h">
              <div>
                <div className="big" style={{ color: h.aWins > h.bWins ? 'var(--success)' : undefined }}>
                  {h.aWins}
                </div>
                <div className="strong">{d.stars.get(a[0])?.ringName}</div>
              </div>
              <div className="muted">
                <div className="display">VS</div>
                <div className="small">
                  {h.matches.length} meetings · {h.draws} draws
                  {h.other ? ` · ${h.other} won by others` : ''}
                </div>
              </div>
              <div>
                <div className="big" style={{ color: h.bWins > h.aWins ? 'var(--success)' : undefined }}>
                  {h.bWins}
                </div>
                <div className="strong">{d.stars.get(b[0])?.ringName}</div>
              </div>
            </div>
          </div>
          <Card title="Meetings" flush>
            <MatchList matches={[...h.matches].reverse()} focusId={a[0]} empty={<Empty title="They have never met" />} />
          </Card>
        </>
      ) : (
        <Empty title="Pick two superstars to compare" />
      )}
    </div>
  );
}
