import { CalendarPlus, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { MatchList } from '../components/display';
import { SearchInput } from '../components/pickers';
import { Chips, Empty, PageHeader, Stat } from '../components/ui';
import { BRANDS, MATCH_TYPES, matchTypeLabel } from '../domain/constants';
import type { Match } from '../domain/schema';
import { sideLabel } from '../domain/stats';
import { matchesQuery } from '../domain/util';
import { useData, useDerived } from '../store/store';

const PAGE = 40;

export function MatchesPage() {
  const u = useData();
  const d = useDerived();
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as 'all' | 'completed' | 'scheduled') ?? 'all';
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('all');
  const [type, setType] = useState('all');
  const [gender, setGender] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [titleOnly, setTitleOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const types = useMemo(() => [...new Set([...MATCH_TYPES.map((m) => m.key), ...u.customMatchTypes, ...u.matches.map((m) => m.matchType)])], [u]);

  const list = useMemo(() => {
    const genderOf = (m: Match) => {
      const g = new Set(m.sides.flatMap((s) => s.superstarIds.map((id) => d.stars.get(id)?.gender)));
      return g.size > 1 ? 'mixed' : [...g][0];
    };
    return u.matches
      .filter(
        (m) =>
          (status === 'all' || m.status === status) &&
          (brand === 'all' || m.brand === brand) &&
          (type === 'all' || m.matchType === type) &&
          (gender === 'all' || genderOf(m) === gender) &&
          (!from || m.date >= from) &&
          (!to || m.date <= to) &&
          (!titleOnly || m.championshipIds.length > 0) &&
          matchesQuery(q, m.eventName, m.notes, m.result, ...m.sides.map((s) => sideLabel(d, s))),
      )
      .sort((a, b) => (status === 'scheduled' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
  }, [u.matches, d, status, brand, type, gender, from, to, titleOnly, q]);

  return (
    <div>
      <PageHeader
        eyebrow="Booking"
        title="Matches"
        sub="Every result and every booked match"
        actions={
          <>
            <Link className="btn" to="/matches/new?status=scheduled">
              <CalendarPlus size={16} /> Book match
            </Link>
            <Link className="btn btn-primary" to="/matches/new">
              <Plus size={16} /> Record result
            </Link>
          </>
        }
      />
      <div className="grid grid-stats mb">
        <Stat accent label="Completed" value={d.completed.length} />
        <Stat label="Scheduled" value={d.scheduled.length} />
        <Stat label="Title matches" value={d.completed.filter((m) => m.championshipIds.length).length} />
        <Stat label="Showing" value={list.length} />
      </div>
      <div className="filters">
        <SearchInput value={q} onChange={setQ} placeholder="Search superstar, team, event…" />
        <Chips
          value={status}
          onChange={(v) => (setParams(v === 'all' ? {} : { status: v }), setLimit(PAGE))}
          options={[
            { key: 'all', label: 'All' },
            { key: 'completed', label: 'Results' },
            { key: 'scheduled', label: 'Upcoming' },
          ]}
        />
      </div>
      <div className="filters">
        <select className="select" value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Brand">
          <option value="all">All brands</option>
          {BRANDS.map((b) => (
            <option key={b.key} value={b.key}>
              {b.short}
            </option>
          ))}
          <option value="none">Cross-brand</option>
        </select>
        <select className="select" value={gender} onChange={(e) => setGender(e.target.value)} aria-label="Division">
          <option value="all">All divisions</option>
          <option value="male">Men's</option>
          <option value="female">Women's</option>
          <option value="mixed">Mixed</option>
        </select>
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
        <label className="check small">
          <input type="checkbox" checked={titleOnly} onChange={(e) => setTitleOnly(e.target.checked)} /> Title matches only
        </label>
      </div>
      <div className="card">
        <MatchList
          matches={list.slice(0, limit)}
          empty={<Empty title={u.matches.length ? 'No matches fit these filters' : 'No matches yet'} action={!u.matches.length && <Link className="btn btn-primary" to="/matches/new">Record your first match</Link>} />}
        />
        {list.length > limit && (
          <div className="center" style={{ padding: 12 }}>
            <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>
              Show more ({list.length - limit} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
