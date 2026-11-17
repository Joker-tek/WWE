import { LayoutGrid, List, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { NotFound } from '../App';
import { StarCard } from '../components/display';
import { SuperstarForm } from '../components/forms';
import { SearchInput } from '../components/pickers';
import { AlignmentBadge, Avatar, BrandBadge, Chips, type Column, DataTable, Empty, Form, PageHeader, RecordText, Stat, StatusBadge, Streak } from '../components/ui';
import { ALIGNMENT_LABEL, BRANDS, DIVISION_LABEL, GENDER_LABEL, STATUS_LABEL } from '../domain/constants';
import type { BrandKey, Gender, Superstar } from '../domain/schema';
import { recordOf } from '../domain/stats';
import { matchesQuery, pct } from '../domain/util';
import { useData, useDerived } from '../store/store';

export function RosterPage() {
  const { gender } = useParams();
  if (gender !== 'male' && gender !== 'female') return <NotFound />;
  return <RosterPageInner key={gender} gender={gender} />;
}

function RosterPageInner({ gender }: { gender: Gender }) {
  const u = useData();
  const d = useDerived();
  const [adding, setAdding] = useState(false);
  const roster = u.superstars.filter((s) => s.gender === gender);
  const active = roster.filter((s) => s.status === 'active');
  const champs = roster.filter((s) => (d.heldTitles.get(s.id) ?? []).length);
  const matches = roster.reduce((a, s) => a + recordOf(d, s.id).matches, 0);
  return (
    <div>
      <PageHeader
        eyebrow="Roster"
        title={`${GENDER_LABEL[gender]} Division`}
        sub={`Every ${gender === 'male' ? 'male' : 'female'} superstar across RAW, SmackDown and NXT`}
        actions={
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <UserPlus size={16} /> Add superstar
          </button>
        }
      />
      <div className="grid grid-stats mb">
        <Stat accent label="Roster" value={roster.length} foot={`${active.length} active`} />
        {BRANDS.map((b) => (
          <Stat key={b.key} label={b.short} value={roster.filter((s) => s.brand === b.key && s.status !== 'released').length} foot="superstars" />
        ))}
        <Stat label="Injured" value={roster.filter((s) => s.status === 'injured').length} />
        <Stat label="Champions" value={champs.length} />
        <Stat label="Matches" value={matches} foot="appearances" />
      </div>
      <RosterView gender={gender} />
      {adding && <SuperstarForm defaults={{ gender }} onClose={() => setAdding(false)} />}
    </div>
  );
}

type SortKey = 'rank' | 'name' | 'wins' | 'pct' | 'popularity' | 'matches';

export function RosterView({ gender, brand: fixedBrand }: { gender: Gender; brand?: BrandKey }) {
  const u = useData();
  const d = useDerived();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState<BrandKey | 'all'>(fixedBrand ?? 'all');
  const [status, setStatus] = useState<string>('current');
  const [alignment, setAlignment] = useState<string>('all');
  const [division, setDivision] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('rank');
  const [view, setView] = useState<'grid' | 'table'>(() => {
    try {
      return (localStorage.getItem('rosterView') as 'grid' | 'table') || 'grid';
    } catch {
      return 'grid';
    }
  });
  const changeView = (v: 'grid' | 'table') => {
    setView(v);
    try {
      localStorage.setItem('rosterView', v);
    } catch {
      /* ignore */
    }
  };

  const list = useMemo(() => {
    const out = u.superstars.filter(
      (s) =>
        s.gender === gender &&
        (brand === 'all' || s.brand === brand) &&
        (status === 'all' || (status === 'current' ? s.status !== 'released' : s.status === status)) &&
        (alignment === 'all' || s.alignment === alignment) &&
        (division === 'all' || s.division === division) &&
        matchesQuery(q, s.ringName, s.realName, s.hometown),
    );
    const key: Record<SortKey, (s: Superstar) => number | string> = {
      rank: (s) => d.rank.get(s.id) ?? 9999,
      name: (s) => s.ringName,
      wins: (s) => -recordOf(d, s.id).wins,
      pct: (s) => -recordOf(d, s.id).winPct,
      popularity: (s) => -s.popularity,
      matches: (s) => -recordOf(d, s.id).matches,
    };
    const k = key[sort];
    return out.sort((a, b) => {
      const va = k(a);
      const vb = k(b);
      return typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
    });
  }, [u.superstars, gender, brand, status, alignment, division, q, sort, d]);

  const columns: Column<Superstar>[] = [
    { key: 'rank', label: '#', render: (s) => d.rank.get(s.id) ?? '—', sort: (s) => d.rank.get(s.id) ?? 9999, num: true },
    {
      key: 'name',
      label: 'Superstar',
      sort: (s) => s.ringName,
      render: (s) => (
        <div className="row">
          <Avatar name={s.ringName} src={s.imageUrl} brand={s.brand} size={32} />
          <div>
            <div className="strong">{s.ringName}</div>
            <div className="tiny muted">{(d.heldTitles.get(s.id) ?? []).map((t) => t.name).join(', ') || DIVISION_LABEL[s.division]}</div>
          </div>
        </div>
      ),
    },
    { key: 'brand', label: 'Brand', render: (s) => <BrandBadge brand={s.brand} />, sort: (s) => s.brand },
    { key: 'align', label: 'Alignment', render: (s) => <AlignmentBadge alignment={s.alignment} />, sort: (s) => s.alignment },
    { key: 'status', label: 'Status', render: (s) => <StatusBadge status={s.status} />, sort: (s) => s.status },
    { key: 'rec', label: 'W-L-D', render: (s) => <RecordText rec={recordOf(d, s.id)} />, sort: (s) => recordOf(d, s.id).wins, num: true },
    { key: 'pct', label: 'Win %', render: (s) => (recordOf(d, s.id).matches ? pct(recordOf(d, s.id).winPct) : '—'), sort: (s) => recordOf(d, s.id).winPct, num: true },
    { key: 'streak', label: 'Streak', render: (s) => <Streak rec={recordOf(d, s.id)} />, num: true },
    { key: 'form', label: 'Form', render: (s) => <Form form={recordOf(d, s.id).form} /> },
    { key: 'pop', label: 'Pop.', render: (s) => s.popularity, sort: (s) => s.popularity, num: true },
  ];

  return (
    <div>
      <div className="filters">
        <SearchInput value={q} onChange={setQ} placeholder="Search by name or hometown…" />
        {!fixedBrand && (
          <Chips
            value={brand}
            onChange={setBrand}
            options={[{ key: 'all', label: 'All brands' }, ...BRANDS.map((b) => ({ key: b.key, label: b.short })), { key: 'none', label: 'Free agents' }]}
          />
        )}
      </div>
      <div className="filters">
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="current">Current roster</option>
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select className="select" value={alignment} onChange={(e) => setAlignment(e.target.value)} aria-label="Alignment">
          <option value="all">All alignments</option>
          {Object.entries(ALIGNMENT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select className="select" value={division} onChange={(e) => setDivision(e.target.value)} aria-label="Card position">
          <option value="all">All card positions</option>
          {Object.entries(DIVISION_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {view === 'grid' && (
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
            <option value="rank">Sort: Power rank</option>
            <option value="name">Sort: Name</option>
            <option value="wins">Sort: Most wins</option>
            <option value="pct">Sort: Win %</option>
            <option value="matches">Sort: Most matches</option>
            <option value="popularity">Sort: Popularity</option>
          </select>
        )}
        <div className="grow" />
        <span className="muted small">{list.length} shown</span>
        <div className="row" style={{ gap: 4 }}>
          <button className={`btn btn-sm icon-btn ${view === 'grid' ? '' : 'btn-ghost'}`} onClick={() => changeView('grid')} aria-label="Grid view" title="Grid view">
            <LayoutGrid size={15} />
          </button>
          <button className={`btn btn-sm icon-btn ${view === 'table' ? '' : 'btn-ghost'}`} onClick={() => changeView('table')} aria-label="Table view" title="Table view">
            <List size={15} />
          </button>
        </div>
      </div>
      {!list.length ? (
        <Empty icon={<Users size={20} />} title="No superstars match these filters" />
      ) : view === 'grid' ? (
        <div className="grid grid-4">
          {list.map((s) => (
            <StarCard key={s.id} s={s} d={d} />
          ))}
        </div>
      ) : (
        <div className="card">
          <DataTable rows={list} columns={columns} rowKey={(s) => s.id} onRowClick={(s) => nav(`/superstars/${s.id}`)} />
        </div>
      )}
    </div>
  );
}
