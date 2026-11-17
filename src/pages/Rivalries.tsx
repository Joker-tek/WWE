import { CalendarPlus, Flag, Minus, Pause, Pencil, Play, Plus, Swords, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { NotFound } from '../App';
import { MatchList, RefLink, RefList, Timeline, type TimelineEntry } from '../components/display';
import { useFeedback, useMutation } from '../components/feedback';
import { EndRivalryForm, LogEntryForm, RivalryForm } from '../components/forms';
import { SearchInput } from '../components/pickers';
import { BrandBadge, Card, Chips, Empty, Meter, PageHeader, Stat, StatusBadge } from '../components/ui';
import { BRANDS, RIVALRY_STATUS_LABEL, matchTypeLabel } from '../domain/constants';
import { deleteRivalry } from '../domain/actions';
import type { BookingDraft } from '../domain/matchmaking';
import type { BrandKey, LogEntry, Rivalry } from '../domain/schema';
import { type Derived, refName, resultForRef, rivalryMatches, shortSideLabel } from '../domain/stats';
import { daysBetween, formatDate, matchesQuery, plural } from '../domain/util';
import { useData, useDerived } from '../store/store';

export function RivalriesPage() {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <PageHeader
        eyebrow="Booking"
        title="Rivalries"
        sub="Feuds, grudges and wars, from first confrontation to blow-off"
        actions={
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Start rivalry
          </button>
        }
      />
      <RivalryList />
      {adding && <RivalryForm onClose={() => setAdding(false)} />}
    </div>
  );
}

export function RivalryList({ brand: fixedBrand }: { brand?: BrandKey }) {
  const u = useData();
  const d = useDerived();
  const [status, setStatus] = useState<'open' | Rivalry['status'] | 'all'>('open');
  const [brand, setBrand] = useState<BrandKey | 'all'>(fixedBrand ?? 'all');
  const [q, setQ] = useState('');
  const list = u.rivalries
    .filter(
      (r) =>
        (status === 'all' || (status === 'open' ? r.status !== 'ended' : r.status === status)) &&
        (brand === 'all' || r.brand === brand) &&
        matchesQuery(q, r.name, r.description, ...r.participants.map((p) => refName(d, p))),
    )
    .sort((a, b) => Number(a.status === 'ended') - Number(b.status === 'ended') || b.intensity - a.intensity);
  return (
    <div>
      <div className="filters">
        <SearchInput value={q} onChange={setQ} placeholder="Search rivalries or participants…" />
        <Chips
          value={status}
          onChange={setStatus}
          options={[
            { key: 'open', label: 'Ongoing' },
            { key: 'active', label: 'Active' },
            { key: 'paused', label: 'Paused' },
            { key: 'planned', label: 'Planned' },
            { key: 'ended', label: 'Ended' },
            { key: 'all', label: 'All' },
          ]}
        />
        {!fixedBrand && <Chips value={brand} onChange={setBrand} options={[{ key: 'all', label: 'All brands' }, ...BRANDS.map((b) => ({ key: b.key, label: b.short })), { key: 'none', label: 'Cross-brand' }]} />}
      </div>
      {list.length ? (
        <div className="grid grid-3">
          {list.map((r) => (
            <RivalryCard key={r.id} r={r} d={d} />
          ))}
        </div>
      ) : (
        <Empty icon={<Swords size={20} />} title="No rivalries here" text="Start one yourself, or let the Matchmaker suggest new feuds." />
      )}
    </div>
  );
}

function RivalryCard({ r, d }: { r: Rivalry; d: Derived }) {
  const ms = rivalryMatches(d, r).filter((m) => m.status === 'completed');
  return (
    <Link to={`/rivalries/${r.id}`} className="card hoverable card-pad stack-sm">
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="strong" style={{ fontSize: 15 }}>
          {r.name}
        </div>
        <StatusBadge status={r.status} label={RIVALRY_STATUS_LABEL[r.status]} />
      </div>
      <div className="small">
        <RefList refs={r.participants} d={d} plain />
      </div>
      <div className="row between">
        <Meter value={r.intensity} />
        <BrandBadge brand={r.brand} context="event" />
      </div>
      <div className="tiny muted">
        Since {formatDate(r.startDate)} · {plural(ms.length, 'match', 'matches')}
        {r.status === 'ended' && r.winner && ` · Won by ${refName(d, r.winner)}`}
      </div>
    </Link>
  );
}

export function RivalryPage() {
  const { id = '' } = useParams();
  const d = useDerived();
  const nav = useNavigate();
  const run = useMutation();
  const { confirm } = useFeedback();
  const [modal, setModal] = useState<null | 'edit' | 'end' | 'log' | LogEntry>(null);
  const r = d.rivalries.get(id);
  if (!r) return <NotFound what="rivalry" />;
  const ms = rivalryMatches(d, r).sort((a, b) => b.date.localeCompare(a.date));
  const done = ms.filter((m) => m.status === 'completed');
  const lastActivity = [...done.map((m) => m.date), ...r.history.map((h) => h.date), r.startDate].sort().pop()!;
  const duration = daysBetween(r.startDate, r.endDate || d.today);
  const storyline = r.storylineId ? d.storylines.get(r.storylineId) : undefined;

  const update = (fn: (x: Rivalry) => void, msg: string) =>
    run((u) => {
      const x = u.rivalries.find((y) => y.id === r.id);
      if (!x) throw new Error('Rivalry not found.');
      fn(x);
      x.updatedAt = new Date().toISOString();
    }, msg);

  const book = () => {
    const sides = r.participants.slice(0, Math.max(2, r.participants.length)).map((p) => ({
      teamId: p.type === 'team' ? p.id : undefined,
      superstarIds: p.type === 'team' ? (d.teams.get(p.id)?.memberIds.slice(0, 2) ?? []) : [p.id],
    }));
    const isTeam = r.participants.every((p) => p.type === 'team');
    const n = sides.length;
    const booking: BookingDraft = {
      brand: r.brand,
      matchType: n === 3 ? 'triple_threat' : n === 4 ? 'fatal_4_way' : isTeam ? 'tag' : 'singles',
      sides,
      championshipIds: [],
      rivalryId: r.id,
      storylineId: r.storylineId,
    };
    nav('/matches/new', { state: { booking } });
  };

  const timeline: TimelineEntry[] = [
    ...r.history.map((h) => ({
      key: h.id,
      date: h.date,
      title: h.title,
      text: h.text,
      actions: (
        <div className="row" style={{ gap: 2 }}>
          <button className="btn btn-ghost btn-sm icon-btn" aria-label="Edit entry" onClick={() => setModal(h)}>
            <Pencil size={13} />
          </button>
          <button className="btn btn-ghost btn-sm icon-btn" aria-label="Delete entry" onClick={() => update((x) => (x.history = x.history.filter((e) => e.id !== h.id)), 'Entry deleted')}>
            <Trash2 size={13} />
          </button>
        </div>
      ),
    })),
    ...ms.map((m) => {
      const w = m.sides.find((s) => s.id === m.winnerSideId);
      return {
        key: m.id,
        date: m.date,
        kind: (m.status === 'scheduled' ? 'planned' : 'match') as TimelineEntry['kind'],
        title: `${matchTypeLabel(m.matchType)}: ${m.sides.map((s) => shortSideLabel(d, s)).join(' vs. ')}`,
        text: m.status === 'scheduled' ? `Booked${m.eventName ? ` for ${m.eventName}` : ''}` : w ? `${shortSideLabel(d, w)} won${m.finish ? ` by ${m.finish.toLowerCase()}` : ''}` : m.outcome === 'draw' ? 'Draw' : 'No contest',
      };
    }),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div className="hero">
        <div className="eyebrow">
          Rivalry · {formatDate(r.startDate)} → {r.endDate ? formatDate(r.endDate) : 'present'}
        </div>
        <h1 className="metal-text">{r.name}</h1>
        <div className="row wrap mt-sm" style={{ gap: 8 }}>
          <StatusBadge status={r.status} label={RIVALRY_STATUS_LABEL[r.status]} />
          <BrandBadge brand={r.brand} context="event" />
          {storyline && (
            <Link className="badge" to={`/storylines/${storyline.id}`}>
              Storyline: {storyline.title}
            </Link>
          )}
        </div>
        {r.description && <p className="sub pre" style={{ maxWidth: 800 }}>{r.description}</p>}
        <div className="btn-group mt">
          {r.status !== 'ended' && (
            <button className="btn btn-primary" onClick={book}>
              <CalendarPlus size={15} /> Book a match
            </button>
          )}
          <button className="btn" onClick={() => setModal('log')}>
            <Plus size={15} /> Add moment
          </button>
          {r.status === 'active' && (
            <button className="btn" onClick={() => update((x) => (x.status = 'paused', x.history.push({ id: `log_${Date.now()}`, date: d.today, title: 'Rivalry paused', text: '' })), 'Rivalry paused')}>
              <Pause size={15} /> Pause
            </button>
          )}
          {(r.status === 'paused' || r.status === 'planned') && (
            <button className="btn" onClick={() => update((x) => (x.status = 'active', x.history.push({ id: `log_${Date.now()}`, date: d.today, title: r.status === 'paused' ? 'Rivalry resumed' : 'Rivalry kicked off', text: '' })), 'Rivalry active')}>
              <Play size={15} /> {r.status === 'paused' ? 'Resume' : 'Activate'}
            </button>
          )}
          {r.status !== 'ended' ? (
            <button className="btn" onClick={() => setModal('end')}>
              <Flag size={15} /> End rivalry
            </button>
          ) : (
            <button className="btn" onClick={() => update((x) => ((x.status = 'active'), (x.endDate = ''), (x.winner = null)), 'Rivalry reopened')}>
              <Play size={15} /> Reopen
            </button>
          )}
          <button className="btn" onClick={() => setModal('edit')}>
            <Pencil size={15} /> Edit
          </button>
          <button
            className="btn btn-danger icon-btn"
            aria-label="Delete rivalry"
            onClick={async () => {
              if (await confirm({ title: 'Delete rivalry?', text: 'Matches stay in the history but are unlinked from this rivalry.', confirmLabel: 'Delete', danger: true })) {
                if (run((u) => deleteRivalry(u, r.id), 'Rivalry deleted')) nav('/rivalries');
              }
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="grid grid-stats mb">
        <div className="stat accent">
          <div className="label">Intensity</div>
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn btn-sm icon-btn" aria-label="Lower intensity" disabled={r.intensity <= 1} onClick={() => update((x) => void (x.intensity = Math.max(1, x.intensity - 1)), 'Intensity lowered')}>
              <Minus size={14} />
            </button>
            <span className="value" style={{ margin: 0 }}>
              {r.intensity}
            </span>
            <button className="btn btn-sm icon-btn" aria-label="Raise intensity" disabled={r.intensity >= 10} onClick={() => update((x) => void (x.intensity = Math.min(10, x.intensity + 1)), 'Intensity raised')}>
              <Plus size={14} />
            </button>
          </div>
          <div className="mt-sm">
            <Meter value={r.intensity} />
          </div>
        </div>
        <Stat label="Matches" value={done.length} foot={`${ms.length - done.length} upcoming`} />
        <Stat label="Duration" value={`${duration}d`} foot={r.endDate ? 'ended' : 'and counting'} />
        <Stat label="Last activity" value={`${daysBetween(lastActivity, d.today)}d ago`} foot={formatDate(lastActivity)} />
        {r.winner && <Stat label="Winner" value={<span style={{ fontSize: 18 }}>{refName(d, r.winner)}</span>} foot={r.outcome} />}
      </div>

      <div className="cols-main">
        <div className="stack">
          <Card title="Rivalry timeline" icon={<Swords size={16} />}>
            <Timeline entries={timeline} empty={<Empty title="Nothing yet" text="Book a match or add a moment to start the story." />} />
          </Card>
          <Card title="Matches" flush>
            <MatchList matches={ms} />
          </Card>
        </div>
        <div className="stack">
          <Card title="Participants" flush>
            <div className="list">
              {r.participants.map((p) => {
                const wins = done.filter((m) => resultForRef(m, p) === 'W').length;
                const losses = done.filter((m) => resultForRef(m, p) === 'L').length;
                const draws = done.filter((m) => resultForRef(m, p) === 'D').length;
                return (
                  <div key={p.type + p.id} className="list-item">
                    <div className="grow">
                      <RefLink r={p} d={d} />
                      {p.type === 'team' && <span className="badge" style={{ marginLeft: 6 }}>Team</span>}
                    </div>
                    <span className="mono small">
                      {wins}W {losses}L {draws}D
                    </span>
                    {r.winner?.id === p.id && <span className="badge badge-gold">Winner</span>}
                  </div>
                );
              })}
            </div>
          </Card>
          {r.outcome && (
            <Card title="Outcome">
              <p className="pre small">{r.outcome}</p>
            </Card>
          )}
        </div>
      </div>

      {modal === 'edit' && <RivalryForm initial={r} onClose={() => setModal(null)} />}
      {modal === 'end' && <EndRivalryForm rivalry={r} onClose={() => setModal(null)} />}
      {(modal === 'log' || (modal && typeof modal === 'object')) && (
        <LogEntryForm
          heading={typeof modal === 'object' ? 'Edit moment' : 'Add rivalry moment'}
          initial={typeof modal === 'object' ? modal : undefined}
          defaultDate={d.today}
          titlePlaceholder="e.g. Attacked backstage before RAW"
          onClose={() => setModal(null)}
          onSave={(e) =>
            update((x) => {
              const i = x.history.findIndex((h) => h.id === e.id);
              if (i >= 0) x.history[i] = e;
              else x.history.push(e);
            }, 'Moment saved')
          }
        />
      )}
    </div>
  );
}
