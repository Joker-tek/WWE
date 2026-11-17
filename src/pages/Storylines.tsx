import { BookOpen, CalendarPlus, Check, ChevronsRight, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { NotFound } from '../App';
import { MatchList, StarLink, Timeline, type TimelineEntry } from '../components/display';
import { useFeedback, useMutation } from '../components/feedback';
import { LogEntryForm, StorylineForm } from '../components/forms';
import { SearchInput } from '../components/pickers';
import { Avatar, BrandBadge, Card, Chips, Empty, Field, Modal, PageHeader, Stat, StatusBadge } from '../components/ui';
import { BRANDS, STORYLINE_STATUS_LABEL, matchTypeLabel } from '../domain/constants';
import { deleteStoryline } from '../domain/actions';
import type { BrandKey, LogEntry, PlannedEvent, Storyline } from '../domain/schema';
import { shortSideLabel } from '../domain/stats';
import { daysBetween, formatDate, matchesQuery, nowIso, plural, uid } from '../domain/util';
import { useData, useDerived } from '../store/store';

export function StorylinesPage() {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <PageHeader
        eyebrow="Booking"
        title="Storylines"
        sub="Long-term sagas and short angles, chapter by chapter"
        actions={
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> New storyline
          </button>
        }
      />
      <StorylineList />
      {adding && <StorylineForm onClose={() => setAdding(false)} />}
    </div>
  );
}

export function StorylineList({ brand: fixedBrand }: { brand?: BrandKey }) {
  const u = useData();
  const d = useDerived();
  const [status, setStatus] = useState<'open' | Storyline['status'] | 'all'>('open');
  const [length, setLength] = useState<'all' | 'short' | 'long'>('all');
  const [brand, setBrand] = useState<BrandKey | 'all'>(fixedBrand ?? 'all');
  const [q, setQ] = useState('');
  const list = u.storylines
    .filter(
      (s) =>
        (status === 'all' || (status === 'open' ? s.status === 'active' || s.status === 'planning' || s.status === 'paused' : s.status === status)) &&
        (length === 'all' || s.length === length) &&
        (brand === 'all' || s.brand === brand) &&
        matchesQuery(q, s.title, s.description, ...s.superstarIds.map((x) => d.stars.get(x)?.ringName)),
    )
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  return (
    <div>
      <div className="filters">
        <SearchInput value={q} onChange={setQ} placeholder="Search storylines or superstars…" />
        <Chips
          value={status}
          onChange={setStatus}
          options={[
            { key: 'open', label: 'Ongoing' },
            { key: 'active', label: 'Active' },
            { key: 'planning', label: 'Planning' },
            { key: 'paused', label: 'Paused' },
            { key: 'concluded', label: 'Concluded' },
            { key: 'all', label: 'All' },
          ]}
        />
      </div>
      <div className="filters">
        <Chips value={length} onChange={setLength} options={[{ key: 'all', label: 'Any length' }, { key: 'short', label: 'Short-term' }, { key: 'long', label: 'Long-term' }]} />
        {!fixedBrand && <Chips value={brand} onChange={setBrand} options={[{ key: 'all', label: 'All brands' }, ...BRANDS.map((b) => ({ key: b.key, label: b.short })), { key: 'none', label: 'Cross-brand' }]} />}
      </div>
      {list.length ? (
        <div className="grid grid-3">
          {list.map((s) => {
            const open = s.plannedEvents.filter((e) => !e.done).length;
            return (
              <Link key={s.id} to={`/storylines/${s.id}`} className="card hoverable card-pad stack-sm">
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <div className="strong" style={{ fontSize: 15 }}>
                    {s.title}
                  </div>
                  <StatusBadge status={s.status} label={STORYLINE_STATUS_LABEL[s.status]} />
                </div>
                {s.currentChapter && <div className="small" style={{ color: 'var(--accent-2)' }}>{s.currentChapter}</div>}
                <div className="row" style={{ gap: 4 }}>
                  {s.superstarIds.slice(0, 6).map((id) => {
                    const st = d.stars.get(id);
                    return st ? <Avatar key={id} name={st.ringName} src={st.imageUrl} brand={st.brand} size={28} /> : null;
                  })}
                  {s.superstarIds.length > 6 && <span className="small muted">+{s.superstarIds.length - 6}</span>}
                </div>
                <div className="row between">
                  <span className="tiny muted">
                    {s.length === 'long' ? 'Long-term' : 'Short-term'} · {plural(s.moments.length, 'moment')} · {open} planned
                  </span>
                  <BrandBadge brand={s.brand} context="event" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty icon={<Sparkles size={20} />} title="No storylines here" />
      )}
    </div>
  );
}

function PlannedEventForm({ initial, defaultDate, onSave, onClose }: { initial?: PlannedEvent; defaultDate: string; onSave: (e: PlannedEvent) => boolean; onClose: () => void }) {
  const [e, setE] = useState<PlannedEvent>(initial ?? { id: uid('plan'), date: defaultDate, title: '', description: '', done: false });
  const [error, setError] = useState('');
  return (
    <Modal
      title={initial ? 'Edit planned event' : 'Plan an event'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (!e.title.trim()) return setError('A title is required.');
              if (onSave({ ...e, title: e.title.trim() })) onClose();
            }}
          >
            Save
          </button>
        </>
      }
    >
      <div className="stack">
        <Field label="Planned date" hint="Leave empty if not scheduled yet">
          <input className="input" type="date" value={e.date} onChange={(x) => setE({ ...e, date: x.target.value })} />
        </Field>
        <Field label="What should happen? *" error={error}>
          <input className="input" value={e.title} onChange={(x) => (setE({ ...e, title: x.target.value }), setError(''))} placeholder="e.g. Betrayal at Survivor Series" autoFocus />
        </Field>
        <Field label="Details">
          <textarea className="textarea" value={e.description} onChange={(x) => setE({ ...e, description: x.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

export function StorylinePage() {
  const { id = '' } = useParams();
  const u = useData();
  const d = useDerived();
  const nav = useNavigate();
  const run = useMutation();
  const { confirm } = useFeedback();
  const [modal, setModal] = useState<null | 'edit' | 'moment' | 'plan' | 'chapter' | { moment: LogEntry } | { plan: PlannedEvent }>(null);
  const [nextChapter, setNextChapter] = useState('');
  const s = d.storylines.get(id);
  if (!s) return <NotFound what="storyline" />;
  const matches = [...d.completed, ...d.scheduled].filter((m) => m.storylineId === s.id).sort((a, b) => b.date.localeCompare(a.date));
  const rivalries = u.rivalries.filter((r) => r.storylineId === s.id);

  const update = (fn: (x: Storyline) => void, msg: string) =>
    run((x) => {
      const t = x.storylines.find((y) => y.id === s.id);
      if (!t) throw new Error('Storyline not found.');
      fn(t);
      t.updatedAt = nowIso();
    }, msg);

  const timeline: TimelineEntry[] = [
    ...s.moments.map((mo) => ({
      key: mo.id,
      date: mo.date,
      title: mo.title,
      text: mo.text,
      actions: (
        <div className="row" style={{ gap: 2 }}>
          <button className="btn btn-ghost btn-sm icon-btn" aria-label="Edit moment" onClick={() => setModal({ moment: mo })}>
            <Pencil size={13} />
          </button>
          <button className="btn btn-ghost btn-sm icon-btn" aria-label="Delete moment" onClick={() => update((x) => (x.moments = x.moments.filter((y) => y.id !== mo.id)), 'Moment deleted')}>
            <Trash2 size={13} />
          </button>
        </div>
      ),
    })),
    ...matches.map((m) => {
      const w = m.sides.find((x) => x.id === m.winnerSideId);
      return {
        key: m.id,
        date: m.date,
        kind: (m.status === 'scheduled' ? 'planned' : 'match') as TimelineEntry['kind'],
        title: `${matchTypeLabel(m.matchType)}: ${m.sides.map((x) => shortSideLabel(d, x)).join(' vs. ')}`,
        text: m.status === 'scheduled' ? 'Booked' : w ? `${shortSideLabel(d, w)} won` : 'No winner',
      };
    }),
    ...s.plannedEvents.filter((e) => !e.done && e.date).map((e) => ({ key: e.id, date: e.date, kind: 'planned' as const, title: `Planned: ${e.title}`, text: e.description })),
    { key: 'start', date: s.startDate, title: 'Storyline began', text: '' },
    ...(s.endDate ? [{ key: 'end', date: s.endDate, title: 'Storyline ended', text: s.outcome }] : []),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const plans = [...s.plannedEvents].sort((a, b) => Number(a.done) - Number(b.done) || (a.date || '9999').localeCompare(b.date || '9999'));

  return (
    <div>
      <div className="hero">
        <div className="eyebrow">
          {s.length === 'long' ? 'Long-term' : 'Short-term'} storyline · since {formatDate(s.startDate)}
        </div>
        <h1 className="metal-text">{s.title}</h1>
        <div className="row wrap mt-sm" style={{ gap: 8 }}>
          <StatusBadge status={s.status} label={STORYLINE_STATUS_LABEL[s.status]} />
          <BrandBadge brand={s.brand} context="event" />
          {s.currentChapter && <span className="badge">Now: {s.currentChapter}</span>}
        </div>
        {s.description && <p className="sub pre" style={{ maxWidth: 800 }}>{s.description}</p>}
        <div className="btn-group mt">
          <button className="btn btn-primary" onClick={() => setModal('moment')}>
            <Plus size={15} /> Add moment
          </button>
          <button className="btn" onClick={() => (setNextChapter(''), setModal('chapter'))}>
            <ChevronsRight size={15} /> Next chapter
          </button>
          <button className="btn" onClick={() => setModal('plan')}>
            <CalendarPlus size={15} /> Plan event
          </button>
          <button className="btn" onClick={() => setModal('edit')}>
            <Pencil size={15} /> Edit / conclude
          </button>
          <button
            className="btn btn-danger icon-btn"
            aria-label="Delete storyline"
            onClick={async () => {
              if (await confirm({ title: 'Delete storyline?', text: 'Matches and rivalries are kept but unlinked from it.', confirmLabel: 'Delete', danger: true })) {
                if (run((x) => deleteStoryline(x, s.id), 'Storyline deleted')) nav('/storylines');
              }
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="grid grid-stats mb">
        <Stat accent label="Participants" value={s.superstarIds.length + s.teamIds.length} />
        <Stat label="Moments" value={s.moments.length} />
        <Stat label="Matches" value={matches.length} />
        <Stat label="Planned" value={s.plannedEvents.filter((e) => !e.done).length} foot={`${s.plannedEvents.filter((e) => e.done).length} done`} />
        <Stat label="Running" value={`${daysBetween(s.startDate, s.endDate || d.today)}d`} />
      </div>

      <div className="cols-main">
        <div className="stack">
          <Card title="Storyline timeline" icon={<BookOpen size={16} />}>
            <Timeline entries={timeline} />
          </Card>
          <Card title="Connected matches" flush>
            <MatchList matches={matches} empty={<Empty title="No matches linked" text="Pick this storyline in the match form to connect matches." />} />
          </Card>
        </div>
        <div className="stack">
          <Card title="Planned events" actions={<button className="btn btn-sm" onClick={() => setModal('plan')}><Plus size={14} /> Add</button>} flush>
            {plans.length ? (
              <div className="list">
                {plans.map((e) => {
                  const overdue = !e.done && e.date && e.date < d.today;
                  return (
                    <div key={e.id} className="list-item" style={{ opacity: e.done ? 0.6 : 1 }}>
                      <button
                        className={`btn btn-sm icon-btn ${e.done ? 'btn-primary' : ''}`}
                        aria-label={e.done ? 'Mark not done' : 'Mark done'}
                        onClick={() =>
                          update((x) => {
                            const p = x.plannedEvents.find((y) => y.id === e.id)!;
                            p.done = !p.done;
                            if (p.done) x.moments.push({ id: uid('log'), date: d.today, title: e.title, text: e.description });
                          }, e.done ? 'Marked as not done' : 'Done, and added to the timeline')
                        }
                      >
                        <Check size={14} />
                      </button>
                      <div className="grow">
                        <div className="strong" style={{ textDecoration: e.done ? 'line-through' : undefined }}>
                          {e.title}
                        </div>
                        <div className="tiny" style={{ color: overdue ? 'var(--danger)' : 'var(--muted)' }}>
                          {e.date ? formatDate(e.date) : 'Unscheduled'}
                          {overdue && ' · overdue'}
                        </div>
                      </div>
                      <button className="btn btn-ghost btn-sm icon-btn" aria-label="Edit" onClick={() => setModal({ plan: e })}>
                        <Pencil size={13} />
                      </button>
                      <button className="btn btn-ghost btn-sm icon-btn" aria-label="Delete" onClick={() => update((x) => (x.plannedEvents = x.plannedEvents.filter((y) => y.id !== e.id)), 'Planned event removed')}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty title="Nothing planned" />
            )}
          </Card>
          <Card title="Participants" flush>
            <div className="list">
              {s.superstarIds.map((x) => {
                const st = d.stars.get(x);
                return st ? (
                  <div key={x} className="list-item">
                    <Avatar name={st.ringName} src={st.imageUrl} brand={st.brand} size={28} />
                    <StarLink id={x} d={d} />
                  </div>
                ) : null;
              })}
              {s.teamIds.map((t) => (
                <Link key={t} to={`/tag-teams/${t}`} className="list-item">
                  <span className="badge">Team</span> {d.teams.get(t)?.name}
                </Link>
              ))}
            </div>
          </Card>
          {rivalries.length > 0 && (
            <Card title="Rivalries in this story" flush>
              <div className="list">
                {rivalries.map((r) => (
                  <Link key={r.id} to={`/rivalries/${r.id}`} className="list-item">
                    {r.name}
                  </Link>
                ))}
              </div>
            </Card>
          )}
          {s.outcome && (
            <Card title="Final outcome">
              <p className="pre small">{s.outcome}</p>
            </Card>
          )}
        </div>
      </div>

      {modal === 'edit' && <StorylineForm initial={s} onClose={() => setModal(null)} />}
      {(modal === 'moment' || (modal && typeof modal === 'object' && 'moment' in modal)) && (
        <LogEntryForm
          heading="Storyline moment"
          initial={typeof modal === 'object' && modal && 'moment' in modal ? modal.moment : undefined}
          defaultDate={d.today}
          titlePlaceholder="e.g. Shocking return at the end of SmackDown"
          onClose={() => setModal(null)}
          onSave={(e) =>
            update((x) => {
              const i = x.moments.findIndex((y) => y.id === e.id);
              if (i >= 0) x.moments[i] = e;
              else x.moments.push(e);
            }, 'Moment saved')
          }
        />
      )}
      {(modal === 'plan' || (modal && typeof modal === 'object' && 'plan' in modal)) && (
        <PlannedEventForm
          initial={typeof modal === 'object' && modal && 'plan' in modal ? modal.plan : undefined}
          defaultDate={d.today}
          onClose={() => setModal(null)}
          onSave={(e) =>
            update((x) => {
              const i = x.plannedEvents.findIndex((y) => y.id === e.id);
              if (i >= 0) x.plannedEvents[i] = e;
              else x.plannedEvents.push(e);
            }, 'Planned event saved')
          }
        />
      )}
      {modal === 'chapter' && (
        <Modal
          title="Advance to the next chapter"
          size="narrow"
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!nextChapter.trim()}
                onClick={() => {
                  const ok = update((x) => {
                    if (x.currentChapter) x.moments.push({ id: uid('log'), date: d.today, title: `Chapter complete: ${x.currentChapter}`, text: '' });
                    x.currentChapter = nextChapter.trim();
                    x.moments.push({ id: uid('log'), date: d.today, title: `New chapter: ${nextChapter.trim()}`, text: '' });
                  }, 'Chapter advanced');
                  if (ok) setModal(null);
                }}
              >
                Start chapter
              </button>
            </>
          }
        >
          <div className="stack">
            <p className="muted small">The current chapter “{s.currentChapter || 'none'}” is closed on the timeline.</p>
            <Field label="Next chapter">
              <input className="input" value={nextChapter} onChange={(e) => setNextChapter(e.target.value)} placeholder="e.g. Chapter 3: The Betrayal" autoFocus />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
