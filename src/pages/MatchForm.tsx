import { Plus, Trash2, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { NotFound } from '../App';
import { useMutation } from '../components/feedback';
import { SuperstarPicker } from '../components/pickers';
import { Card, Chips, Field, PageHeader } from '../components/ui';
import { BRANDS, EVENT_SUGGESTIONS, FINISHES, MATCH_TYPES, matchTypeDef } from '../domain/constants';
import { saveMatch, validateMatch } from '../domain/actions';
import type { BookingDraft } from '../domain/matchmaking';
import type { BrandKey, Gender, Match, MatchSide } from '../domain/schema';
import { holderName, shortSideLabel } from '../domain/stats';
import { wouldChangeHands } from '../domain/titles';
import { nowIso, uid } from '../domain/util';
import { useData, useDerived } from '../store/store';

function newSide(ids: string[] = [], teamId?: string): MatchSide {
  return { id: uid('side'), superstarIds: ids, ...(teamId ? { teamId } : {}) };
}

function blankMatch(today: string, status: Match['status'], brand: BrandKey = 'raw'): Match {
  const now = nowIso();
  return {
    id: uid('match'),
    status,
    date: today,
    brand,
    eventName: '',
    matchType: 'singles',
    sides: [newSide(), newSide()],
    outcome: 'win',
    winnerSideId: undefined,
    finish: 'Pinfall',
    result: '',
    duration: '',
    rating: undefined,
    championshipIds: [],
    titleChanged: false,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function MatchFormPage() {
  const { id } = useParams();
  const d = useDerived();
  const existing = id ? d.matchById.get(id) : undefined;
  if (id && !existing) return <NotFound what="match" />;
  return <MatchFormInner key={id ?? 'new'} existing={existing} />;
}

function MatchFormInner({ existing }: { existing?: Match }) {
  const u = useData();
  const d = useDerived();
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();
  const run = useMutation();
  const booking = (loc.state as { booking?: BookingDraft } | null)?.booking;

  const [m, setM] = useState<Match>(() => {
    if (existing) return { ...existing, status: params.get('complete') ? 'completed' : existing.status };
    const status = params.get('status') === 'scheduled' || booking ? 'scheduled' : 'completed';
    const base = blankMatch(d.today, status);
    if (booking) {
      return {
        ...base,
        brand: booking.brand,
        matchType: booking.matchType,
        sides: booking.sides.map((s) => newSide([...s.superstarIds], s.teamId)),
        championshipIds: booking.championshipIds,
        rivalryId: booking.rivalryId,
        storylineId: booking.storylineId,
        finish: '',
      };
    }
    return base;
  });
  const [titleTouched, setTitleTouched] = useState(!!existing?.titleChanged);
  const [customType, setCustomType] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const firstStar = d.stars.get(m.sides.flatMap((s) => s.superstarIds)[0] ?? '');
  const [gender, setGender] = useState<Gender | 'all'>(firstStar?.gender ?? 'male');

  const def = matchTypeDef(m.matchType);
  const ffa = !!def.freeForAll;
  const set = <K extends keyof Match>(k: K, v: Match[K]) => setM((p) => ({ ...p, [k]: v }));
  const setSide = (i: number, patch: Partial<MatchSide>) => setM((p) => ({ ...p, sides: p.sides.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  const allTypes = useMemo(() => [...new Set([...u.customMatchTypes, ...u.matches.map((x) => x.matchType)])].filter((t) => !MATCH_TYPES.some((mt) => mt.key === t)), [u]);
  const events = useMemo(() => [...new Set([...u.matches.map((x) => x.eventName).filter(Boolean), ...EVENT_SUGGESTIONS])], [u.matches]);
  const used = m.sides.flatMap((s) => s.superstarIds);
  const participants = new Set(used);
  const teamOptions = u.tagTeams.filter((t) => (gender === 'all' || t.gender === gender) && t.status !== 'disbanded');

  // Auto-suggest the title-change flag unless the user set it themselves.
  const suggestChange = m.status === 'completed' && m.championshipIds.length > 0 && wouldChangeHands(u, m);
  useEffect(() => {
    if (!titleTouched) setM((p) => (p.titleChanged === suggestChange ? p : { ...p, titleChanged: suggestChange }));
  }, [suggestChange, titleTouched]);

  const changeType = (key: string) => {
    if (key === '__custom') return setM((p) => ({ ...p, matchType: '' }));
    const nd = matchTypeDef(key);
    setM((p) => {
      let sides = p.sides;
      if (nd.freeForAll) {
        sides = p.sides.flatMap((s) => s.superstarIds.map((id) => newSide([id])));
        while (sides.length < 2) sides.push(newSide());
      } else if (matchTypeDef(p.matchType).freeForAll) {
        const ids = p.sides.flatMap((s) => s.superstarIds);
        sides = Array.from({ length: nd.sides }, (_, i) => newSide(ids.slice(i * nd.perSide, (i + 1) * nd.perSide)));
      } else {
        sides = [...p.sides];
        while (sides.length < nd.sides) sides.push(newSide());
        while (sides.length > nd.sides && sides[sides.length - 1].superstarIds.length === 0) sides.pop();
      }
      return { ...p, matchType: key, sides, winnerSideId: sides.some((s) => s.id === p.winnerSideId) ? p.winnerSideId : undefined };
    });
  };

  const setEntrants = (ids: string[]) => {
    setM((p) => {
      const keep = p.sides.filter((s) => s.superstarIds.length === 1 && ids.includes(s.superstarIds[0]));
      const have = new Set(keep.map((s) => s.superstarIds[0]));
      const sides = [...keep, ...ids.filter((x) => !have.has(x)).map((x) => newSide([x]))];
      while (sides.length < 2) sides.push(newSide());
      return { ...p, sides, winnerSideId: sides.some((s) => s.id === p.winnerSideId) ? p.winnerSideId : undefined };
    });
  };

  const relevantTitles = u.championships
    .filter((c) => (c.active || m.championshipIds.includes(c.id)) && (gender === 'all' || c.gender === gender))
    .sort((a, b) => (a.brand === m.brand ? 0 : 1) - (b.brand === m.brand ? 0 : 1) || a.order - b.order);
  const rivalryOptions = [...u.rivalries]
    .filter((r) => r.status !== 'ended' || r.id === m.rivalryId)
    .map((r) => ({ r, hit: r.participants.some((p) => participants.has(p.id) || d.teams.get(p.id)?.memberIds.some((x) => participants.has(x))) }))
    .sort((a, b) => Number(b.hit) - Number(a.hit));
  const storyOptions = u.storylines
    .filter((s) => (s.status !== 'concluded' && s.status !== 'cancelled') || s.id === m.storylineId)
    .map((s) => ({ s, hit: s.superstarIds.some((x) => participants.has(x)) }))
    .sort((a, b) => Number(b.hit) - Number(a.hit));

  const submit = (another: boolean) => {
    const type = m.matchType || customType.trim();
    const draft: Match = { ...m, matchType: type, sides: m.sides.filter((s) => s.superstarIds.length > 0 || !ffa) };
    const errs = validateMatch(u, draft);
    if (!type) errs.unshift('Enter a name for the custom match type.');
    setErrors(errs);
    if (errs.length) return window.scrollTo({ top: 0, behavior: 'smooth' });
    const ok = run(
      (x) => {
        if (!MATCH_TYPES.some((mt) => mt.key === type) && !x.customMatchTypes.includes(type)) x.customMatchTypes.push(type);
        saveMatch(x, draft);
      },
      existing ? 'Match updated, stats recalculated' : draft.status === 'scheduled' ? 'Match booked' : 'Result recorded',
    );
    if (!ok) return;
    if (another) {
      const next = blankMatch(m.date, m.status, m.brand);
      setM({ ...next, eventName: m.eventName });
      setTitleTouched(false);
      setErrors([]);
      window.scrollTo({ top: 0 });
    } else if (loc.key !== 'default') nav(-1);
    else nav('/matches');
  };

  return (
    <div>
      <PageHeader
        eyebrow="Booking"
        title={existing ? 'Edit match' : m.status === 'scheduled' ? 'Book a match' : 'Record a result'}
        sub={existing ? 'Statistics are recalculated from scratch when you save, so nothing is double-counted.' : 'Win/loss records, streaks and title histories update automatically.'}
      />
      {errors.length > 0 && (
        <div className="banner danger">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="stack">
        <Card title="Match details">
          <div className="form-grid">
            <Field label="Status" className="span-all">
              <Chips
                value={m.status}
                onChange={(v) => set('status', v)}
                options={[
                  { key: 'completed', label: 'Completed (record result)' },
                  { key: 'scheduled', label: 'Scheduled (book for later)' },
                ]}
              />
            </Field>
            <Field label="Date">
              <input className="input" type="date" required value={m.date} onChange={(e) => set('date', e.target.value)} />
            </Field>
            <Field label="Brand">
              <select className="select" value={m.brand} onChange={(e) => set('brand', e.target.value as BrandKey)}>
                {BRANDS.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.short}
                  </option>
                ))}
                <option value="none">Cross-brand / PLE</option>
              </select>
            </Field>
            <Field label="Show / event">
              <input className="input" list="events" value={m.eventName} onChange={(e) => set('eventName', e.target.value)} placeholder="e.g. Monday Night RAW" />
              <datalist id="events">
                {events.map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>
            </Field>
            <Field label="Match type">
              <select className="select" value={m.matchType || '__custom'} onChange={(e) => changeType(e.target.value)}>
                <optgroup label="Standard">
                  {MATCH_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
                {allTypes.length > 0 && (
                  <optgroup label="Your custom types">
                    {allTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </optgroup>
                )}
                <option value="__custom">+ New custom type…</option>
              </select>
            </Field>
            {!m.matchType && (
              <Field label="Custom match type name">
                <input className="input" value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="e.g. Bloodline Rules" autoFocus />
              </Field>
            )}
            <Field label="Division (filters pickers)">
              <Chips
                value={gender}
                onChange={setGender}
                options={[
                  { key: 'male', label: "Men's" },
                  { key: 'female', label: "Women's" },
                  { key: 'all', label: 'Mixed' },
                ]}
              />
            </Field>
          </div>
        </Card>

        <Card title={ffa ? `Entrants (${used.length})` : 'Competitors'}>
          {ffa ? (
            <SuperstarPicker value={used} onChange={setEntrants} filter={{ gender, brand: m.brand }} placeholder="Add entrants…" />
          ) : (
            <div className="grid grid-2">
              {m.sides.map((side, i) => (
                <div key={side.id} className="card card-pad stack-sm" style={{ background: 'var(--surface-2)' }}>
                  <div className="row between">
                    <strong className="display">Side {i + 1}</strong>
                    {m.sides.length > 2 && (
                      <button
                        className="btn btn-ghost btn-sm icon-btn"
                        aria-label="Remove side"
                        onClick={() => setM((p) => ({ ...p, sides: p.sides.filter((s) => s.id !== side.id), winnerSideId: p.winnerSideId === side.id ? undefined : p.winnerSideId }))}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {(def.perSide > 1 || side.teamId || teamOptions.length > 0) && (
                    <select
                      className="select"
                      value={side.teamId ?? ''}
                      onChange={(e) => {
                        const t = d.teams.get(e.target.value);
                        setSide(i, t ? { teamId: t.id, superstarIds: t.memberIds.filter((x) => !used.includes(x) || side.superstarIds.includes(x)) } : { teamId: undefined });
                      }}
                      aria-label="Tag team"
                    >
                      <option value="">No tag team (individuals)</option>
                      {teamOptions.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <SuperstarPicker
                    value={side.superstarIds}
                    onChange={(ids) => setSide(i, { superstarIds: ids })}
                    filter={{ gender, brand: m.brand, exclude: used.filter((x) => !side.superstarIds.includes(x)) }}
                  />
                </div>
              ))}
              <button className="btn" style={{ minHeight: 80, borderStyle: 'dashed' }} onClick={() => setM((p) => ({ ...p, sides: [...p.sides, newSide()] }))}>
                <Plus size={16} /> Add side
              </button>
            </div>
          )}
        </Card>

        {m.status === 'completed' && (
          <Card title="Result">
            <div className="form-grid">
              <Field label="Outcome" className="span-all">
                <Chips
                  value={m.outcome}
                  onChange={(v) => set('outcome', v)}
                  options={[
                    { key: 'win', label: 'Winner decided' },
                    { key: 'draw', label: 'Draw' },
                    { key: 'no_contest', label: 'No Contest' },
                  ]}
                />
              </Field>
              {m.outcome === 'win' && (
                <Field label="Winner" className="span-all" hint="Everyone on the other sides is recorded as a loss.">
                  <div className="chips">
                    {m.sides
                      .filter((s) => s.superstarIds.length)
                      .map((s) => (
                        <button key={s.id} type="button" className={`chip ${m.winnerSideId === s.id ? 'active' : ''}`} onClick={() => set('winnerSideId', s.id)}>
                          {shortSideLabel(d, s)}
                        </button>
                      ))}
                    {!used.length && <span className="muted small">Add competitors first</span>}
                  </div>
                </Field>
              )}
              <Field label="Finish">
                <select className="select" value={m.finish} onChange={(e) => set('finish', e.target.value)}>
                  <option value="">—</option>
                  {FINISHES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Result description">
                <input className="input" value={m.result} onChange={(e) => set('result', e.target.value)} placeholder="e.g. Spear for the pin" />
              </Field>
              <Field label="Duration">
                <input className="input" value={m.duration} onChange={(e) => set('duration', e.target.value)} placeholder="e.g. 18:42" />
              </Field>
              <Field label="Rating">
                <select className="select" value={m.rating ?? ''} onChange={(e) => set('rating', e.target.value === '' ? undefined : Number(e.target.value))}>
                  <option value="">Not rated</option>
                  {[5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5, 0].map((r) => (
                    <option key={r} value={r}>
                      {r} ★
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>
        )}

        <Card title="Stakes & connections">
          <div className="form-grid">
            <Field label="Championships on the line" className="span-all">
              <div className="chips">
                {relevantTitles.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`chip ${m.championshipIds.includes(c.id) ? 'active' : ''}`}
                    onClick={() => set('championshipIds', m.championshipIds.includes(c.id) ? m.championshipIds.filter((x) => x !== c.id) : [...m.championshipIds, c.id])}
                  >
                    <Trophy size={13} /> {c.name}
                  </button>
                ))}
                {!relevantTitles.length && <span className="muted small">No championships for this division</span>}
              </div>
            </Field>
            {m.championshipIds.length > 0 && (
              <div className="span-all stack-sm">
                {m.championshipIds.map((cid) => {
                  const r = d.currentReign.get(cid);
                  const c = d.titles.get(cid);
                  return (
                    <div key={cid} className="small muted">
                      {c?.name}: {r ? `current champion ${holderName(d, r)}` : 'vacant'}
                      {c?.type === 'tag' && ' (tag titles go to the winning side’s tag team)'}
                    </div>
                  );
                })}
                {m.status === 'completed' && m.outcome === 'win' && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={m.titleChanged}
                      onChange={(e) => {
                        setTitleTouched(true);
                        set('titleChanged', e.target.checked);
                      }}
                    />
                    <span>
                      <strong>Title changes hands</strong>
                      <span className="muted small"> ({suggestChange ? 'the winner is not the current champion' : 'the champion retains'}, auto-detected)</span>
                    </span>
                  </label>
                )}
              </div>
            )}
            <Field label="Rivalry">
              <select className="select" value={m.rivalryId ?? ''} onChange={(e) => set('rivalryId', e.target.value || undefined)}>
                <option value="">None</option>
                {rivalryOptions.map(({ r, hit }) => (
                  <option key={r.id} value={r.id}>
                    {hit ? '★ ' : ''}
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Storyline">
              <select className="select" value={m.storylineId ?? ''} onChange={(e) => set('storylineId', e.target.value || undefined)}>
                <option value="">None</option>
                {storyOptions.map(({ s, hit }) => (
                  <option key={s.id} value={s.id}>
                    {hit ? '★ ' : ''}
                    {s.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notes" className="span-all">
              <textarea className="textarea" value={m.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Interference, elimination order, storyline beats…" />
            </Field>
          </div>
        </Card>

        <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => (loc.key !== 'default' ? nav(-1) : nav('/matches'))}>
            Cancel
          </button>
          {!existing && (
            <button className="btn" onClick={() => submit(true)}>
              Save & add another
            </button>
          )}
          <button className="btn btn-primary" onClick={() => submit(false)}>
            {existing ? 'Save changes' : m.status === 'scheduled' ? 'Book match' : 'Save result'}
          </button>
        </div>
      </div>
    </div>
  );
}
