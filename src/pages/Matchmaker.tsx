import { AlertCircle, Brain, CalendarCheck, CheckCircle2, ExternalLink, EyeOff, RefreshCw, SlidersHorizontal, Swords } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation } from '../components/feedback';
import { RivalryForm } from '../components/forms';
import { BrandBadge, Chips, Empty, Field, Modal, PageHeader, Tabs } from '../components/ui';
import { BRANDS, EVENT_SUGGESTIONS, matchTypeLabel } from '../domain/constants';
import { saveMatch } from '../domain/actions';
import { type BookingDraft, type MatchmakerOptions, runMatchmaker, type Suggestion } from '../domain/matchmaking';
import type { BrandKey, Gender } from '../domain/schema';
import { nowIso, uid } from '../domain/util';
import { useData, useDerived } from '../store/store';

type Tab = 'title' | 'singles' | 'tag' | 'rivalries' | 'developments';

export function MatchmakerPage() {
  const u = useData();
  const d = useDerived();
  const [brand, setBrand] = useState<BrandKey | 'all'>('all');
  const [gender, setGender] = useState<Gender | 'all'>('all');
  const [tab, setTab] = useState<Tab>('title');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [approve, setApprove] = useState<Suggestion | null>(null);
  const [rivalryDraft, setRivalryDraft] = useState<Suggestion['rivalryDraft'] | null>(null);
  const [nonce, setNonce] = useState(0);

  const opts: MatchmakerOptions = { brand, gender };
  // Recomputed whenever data changes (e.g. after booking), so suggestions reflect the latest card.
  const result = useMemo(() => runMatchmaker(u, d, opts), [u, d, brand, gender, nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const lists: Record<Tab, Suggestion[]> = {
    title: result.title,
    singles: result.singles,
    tag: result.tag,
    rivalries: result.rivalries,
    developments: result.developments,
  };
  const visible = lists[tab].filter((s) => !hidden.has(s.key));

  return (
    <div>
      <PageHeader
        eyebrow="Booking assistant"
        title="Matchmaker"
        sub="Suggestions weigh rivalries, rankings, momentum, champions, divisions, brands, storylines and how often everyone has wrestled. Nothing is booked until you approve it."
        actions={
          <button className="btn" onClick={() => (setHidden(new Set()), setNonce((n) => n + 1))}>
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />
      <div className="banner info small">
        <Brain size={16} />
        <span className="grow">
          This assistant is a transparent, rule-based scoring engine that runs on your device. It doesn't use an online AI model, so every reason shown is exactly what drove the score.
        </span>
      </div>
      <div className="filters">
        <SlidersHorizontal size={16} className="muted" />
        <Chips value={brand} onChange={setBrand} options={[{ key: 'all', label: 'All brands' }, ...BRANDS.map((b) => ({ key: b.key, label: b.short }))]} />
        <Chips value={gender} onChange={setGender} options={[{ key: 'all', label: 'Both divisions' }, { key: 'male', label: "Men's" }, { key: 'female', label: "Women's" }]} />
      </div>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'title', label: 'Championship matches', count: result.title.length },
          { key: 'singles', label: 'Singles', count: result.singles.length },
          { key: 'tag', label: 'Tag team', count: result.tag.length },
          { key: 'rivalries', label: 'New rivalries', count: result.rivalries.length },
          { key: 'developments', label: 'Storyline developments', count: result.developments.length },
        ]}
      />
      <div className="card">
        {visible.length ? (
          visible.map((s) => (
            <SuggestionRow
              key={s.key}
              s={s}
              onApprove={() => setApprove(s)}
              onRivalry={() => setRivalryDraft(s.rivalryDraft ?? null)}
              onHide={() => setHidden((h) => new Set(h).add(s.key))}
            />
          ))
        ) : (
          <Empty
            icon={<Swords size={20} />}
            title="No suggestions here"
            text={
              tab === 'tag'
                ? 'Create active tag teams on the same brand to get tag suggestions.'
                : tab === 'developments'
                  ? 'Developments appear for active rivalries and storylines, planned events, slumps and long title reigns.'
                  : 'Add active superstars to this brand and division, or change the filters.'
            }
          />
        )}
      </div>
      {approve?.booking && <ApproveModal s={approve} booking={approve.booking} onClose={() => setApprove(null)} />}
      {rivalryDraft && <RivalryForm draft={{ ...rivalryDraft }} onClose={() => setRivalryDraft(null)} />}
    </div>
  );
}

function SuggestionRow({ s, onApprove, onRivalry, onHide }: { s: Suggestion; onApprove: () => void; onRivalry: () => void; onHide: () => void }) {
  const nav = useNavigate();
  return (
    <div className="suggestion">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="score" title="Recommendation score (higher is stronger)">
          {s.score}
        </div>
        <div className="grow" style={{ minWidth: 0 }}>
          {s.subtitle && <div className="tiny strong" style={{ color: 'var(--gold)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.subtitle}</div>}
          <div className="strong" style={{ fontSize: 15 }}>
            {s.title}
          </div>
          <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
            <BrandBadge brand={s.brand} context="event" />
            {s.booking && <span className="badge">{matchTypeLabel(s.booking.matchType)}</span>}
          </div>
        </div>
      </div>
      <ul className="reasons">
        {s.reasons.map((r) => (
          <li key={r} className="pro">
            <CheckCircle2 size={14} /> <span>{r}</span>
          </li>
        ))}
        {s.cautions.map((r) => (
          <li key={r} className="con">
            <AlertCircle size={14} /> <span className="muted">{r}</span>
          </li>
        ))}
      </ul>
      <div className="btn-group">
        {s.booking && (
          <>
            <button className="btn btn-primary btn-sm" onClick={onApprove}>
              <CalendarCheck size={14} /> Approve & book
            </button>
            <button className="btn btn-sm" onClick={() => nav('/matches/new', { state: { booking: s.booking } })}>
              Customize first
            </button>
          </>
        )}
        {s.rivalryDraft && (
          <button className="btn btn-primary btn-sm" onClick={onRivalry}>
            <Swords size={14} /> Start this rivalry
          </button>
        )}
        {s.link && (
          <Link className="btn btn-sm" to={s.link}>
            <ExternalLink size={14} /> Open
          </Link>
        )}
        <button className="btn btn-ghost btn-sm" onClick={onHide}>
          <EyeOff size={14} /> Dismiss
        </button>
      </div>
    </div>
  );
}

function ApproveModal({ s, booking, onClose }: { s: Suggestion; booking: BookingDraft; onClose: () => void }) {
  const d = useDerived();
  const run = useMutation();
  const [date, setDate] = useState(d.today);
  const [eventName, setEventName] = useState(booking.brand === 'raw' ? 'Monday Night RAW' : booking.brand === 'smackdown' ? 'Friday Night SmackDown' : booking.brand === 'nxt' ? 'NXT' : '');
  const book = () => {
    const now = nowIso();
    const ok = run(
      (u) =>
        saveMatch(u, {
          id: uid('match'),
          status: 'scheduled',
          date,
          brand: booking.brand,
          eventName,
          matchType: booking.matchType,
          sides: booking.sides.map((x) => ({ id: uid('side'), superstarIds: [...x.superstarIds], ...(x.teamId ? { teamId: x.teamId } : {}) })),
          outcome: 'win',
          finish: '',
          result: '',
          duration: '',
          championshipIds: booking.championshipIds,
          titleChanged: false,
          rivalryId: booking.rivalryId,
          storylineId: booking.storylineId,
          notes: `Booked from Matchmaker suggestion (score ${s.score}).`,
          createdAt: now,
          updatedAt: now,
        }),
      'Match booked. Record the result from Matches when it happens.',
    );
    if (ok) onClose();
  };
  return (
    <Modal
      title="Approve booking"
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={book}>
            Book match
          </button>
        </>
      }
    >
      <div className="stack">
        <div>
          {s.subtitle && <div className="tiny strong" style={{ color: 'var(--gold)' }}>{s.subtitle}</div>}
          <div className="strong">{s.title}</div>
          <div className="small muted">{matchTypeLabel(booking.matchType)}</div>
        </div>
        <Field label="Date">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Show / event">
          <input className="input" list="mm-events" value={eventName} onChange={(e) => setEventName(e.target.value)} />
          <datalist id="mm-events">
            {EVENT_SUGGESTIONS.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
        </Field>
        <p className="small muted">The match is added as scheduled. No results or statistics change until you record the result.</p>
      </div>
    </Modal>
  );
}
