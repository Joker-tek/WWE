import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ALIGNMENT_LABEL, BRANDS, DIVISION_LABEL, RIVALRY_STATUS_LABEL, STATUS_LABEL, STORYLINE_STATUS_LABEL, TIER_LABEL, brandLabel } from '../domain/constants';
import { transferEntity, upsert } from '../domain/actions';
import type { BrandKey, Championship, CompetitorRef, Gender, HolderType, LogEntry, Reign, Rivalry, Storyline, Superstar, TagTeam } from '../domain/schema';
import { recordTitleChange, validateReignDates, vacateTitle } from '../domain/titles';
import { nowIso, uid } from '../domain/util';
import { useData, useDerived } from '../store/store';
import { useMutation } from './feedback';
import { CompetitorPicker, ImageInput, SuperstarPicker } from './pickers';
import { Field, Modal } from './ui';

const BRAND_OPTIONS: { key: BrandKey; label: string }[] = [...BRANDS.map((b) => ({ key: b.key, label: b.short })), { key: 'none', label: 'Unassigned' }];

function BrandSelect({ value, onChange, noneLabel = 'Free Agent / Unassigned' }: { value: BrandKey; onChange: (b: BrandKey) => void; noneLabel?: string }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value as BrandKey)}>
      {BRAND_OPTIONS.map((b) => (
        <option key={b.key} value={b.key}>
          {b.key === 'none' ? noneLabel : b.label}
        </option>
      ))}
    </select>
  );
}

function GenderSelect({ value, onChange }: { value: Gender; onChange: (g: Gender) => void }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value as Gender)}>
      <option value="male">Men's division</option>
      <option value="female">Women's division</option>
    </select>
  );
}

function Footer({ onClose, saveLabel = 'Save', disabled }: { onClose: () => void; saveLabel?: string; disabled?: boolean }) {
  return (
    <>
      <button type="button" className="btn" onClick={onClose}>
        Cancel
      </button>
      <button type="submit" form="modal-form" className="btn btn-primary" disabled={disabled}>
        {saveLabel}
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------

export function SuperstarForm({ initial, defaults, onClose }: { initial?: Superstar; defaults?: Partial<Superstar>; onClose: () => void }) {
  const run = useMutation();
  const nav = useNavigate();
  const d = useDerived();
  const now = nowIso();
  const [s, setS] = useState<Superstar>(
    initial ?? {
      id: uid('star'),
      ringName: '',
      realName: '',
      imageUrl: '',
      brand: 'raw',
      gender: 'male',
      division: 'midcard',
      alignment: 'face',
      status: 'active',
      popularity: 60,
      hometown: '',
      height: '',
      weight: '',
      finisher: '',
      debutDate: '',
      notes: '',
      career: [],
      createdAt: now,
      updatedAt: now,
      ...defaults,
    },
  );
  const [error, setError] = useState('');
  const set = <K extends keyof Superstar>(k: K, v: Superstar[K]) => setS((p) => ({ ...p, [k]: v }));
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const ringName = s.ringName.trim();
    if (!ringName) return setError('Ring name is required.');
    const dup = [...d.stars.values()].find((x) => x.id !== s.id && x.ringName.toLowerCase() === ringName.toLowerCase());
    if (dup) return setError(`A superstar named “${dup.ringName}” already exists.`);
    if (initial && initial.brand !== s.brand) {
      // Brand edits go through the transfer log so the history stays complete.
      const ok = run((u) => {
        upsert(u.superstars, { ...s, brand: initial.brand, ringName, updatedAt: nowIso() });
        transferEntity(u, 'superstar', s.id, s.brand, d.today, 'Changed in profile editor');
      }, 'Superstar updated and transfer recorded');
      if (ok) onClose();
      return;
    }
    const ok = run((u) => upsert(u.superstars, { ...s, ringName, updatedAt: nowIso() }), initial ? 'Superstar updated' : `${ringName} added to the roster`);
    if (ok) {
      onClose();
      if (!initial) nav(`/superstars/${s.id}`);
    }
  };
  return (
    <Modal title={initial ? `Edit ${initial.ringName}` : 'Add superstar'} onClose={onClose} size="wide" footer={<Footer onClose={onClose} saveLabel={initial ? 'Save changes' : 'Add superstar'} />}>
      <form id="modal-form" onSubmit={save} className="stack">
        <ImageInput value={s.imageUrl} onChange={(v) => set('imageUrl', v)} name={s.ringName} />
        <div className="form-grid">
          <Field label="Ring name *" error={error}>
            <input className={`input ${error ? 'invalid' : ''}`} value={s.ringName} onChange={(e) => (set('ringName', e.target.value), setError(''))} autoFocus />
          </Field>
          <Field label="Real name">
            <input className="input" value={s.realName} onChange={(e) => set('realName', e.target.value)} />
          </Field>
          <Field label="Brand" hint={initial ? 'Changing brand records a transfer' : undefined}>
            <BrandSelect value={s.brand} onChange={(v) => set('brand', v)} />
          </Field>
          <Field label="Division (gender)">
            <GenderSelect value={s.gender} onChange={(v) => set('gender', v)} />
          </Field>
          <Field label="Card position">
            <select className="select" value={s.division} onChange={(e) => set('division', e.target.value as Superstar['division'])}>
              {Object.entries(DIVISION_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Alignment">
            <select className="select" value={s.alignment} onChange={(e) => set('alignment', e.target.value as Superstar['alignment'])}>
              {Object.entries(ALIGNMENT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className="select" value={s.status} onChange={(e) => set('status', e.target.value as Superstar['status'])}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Popularity: ${s.popularity}`} hint="Feeds rankings and the matchmaker">
            <input type="range" min={1} max={100} value={s.popularity} onChange={(e) => set('popularity', Number(e.target.value))} />
          </Field>
          <Field label="Hometown">
            <input className="input" value={s.hometown} onChange={(e) => set('hometown', e.target.value)} />
          </Field>
          <Field label="Finisher">
            <input className="input" value={s.finisher} onChange={(e) => set('finisher', e.target.value)} />
          </Field>
          <Field label="Height">
            <input className="input" value={s.height} onChange={(e) => set('height', e.target.value)} />
          </Field>
          <Field label="Weight">
            <input className="input" value={s.weight} onChange={(e) => set('weight', e.target.value)} />
          </Field>
          <Field label="Debut date">
            <input className="input" type="date" value={s.debutDate} onChange={(e) => set('debutDate', e.target.value)} />
          </Field>
          <Field label="Notes" className="span-all">
            <textarea className="textarea" value={s.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Character notes, gimmick, booking plans…" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export function TransferForm({ type, entity, onClose }: { type: HolderType; entity: Superstar | TagTeam; onClose: () => void }) {
  const run = useMutation();
  const d = useDerived();
  const name = 'ringName' in entity ? entity.ringName : entity.name;
  const [to, setTo] = useState<BrandKey>(entity.brand === 'raw' ? 'smackdown' : 'raw');
  const [date, setDate] = useState(d.today);
  const [note, setNote] = useState('');
  const titles = (d.heldTitles.get(entity.id) ?? []).filter((t) => t.brand !== 'none' && t.brand !== to);
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (run((u) => transferEntity(u, type, entity.id, to, date, note), `${name} moved to ${brandLabel(to)}`)) onClose();
  };
  return (
    <Modal title={`Transfer ${name}`} onClose={onClose} size="narrow" footer={<Footer onClose={onClose} saveLabel="Transfer" disabled={to === entity.brand} />}>
      <form id="modal-form" onSubmit={save} className="stack">
        <p className="muted">
          Currently on <strong>{brandLabel(entity.brand)}</strong>. The move is logged in their career history.
        </p>
        <Field label="New brand">
          <BrandSelect value={to} onChange={setTo} />
        </Field>
        <Field label="Effective date">
          <input className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Drafted in the 2026 WWE Draft" />
        </Field>
        {titles.length > 0 && (
          <div className="banner warning small">
            Holds the {titles.map((t) => t.name).join(' and ')}, which belongs to another brand. The title stays with them until you change it.
          </div>
        )}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export function TeamForm({ initial, defaults, onClose }: { initial?: TagTeam; defaults?: Partial<TagTeam>; onClose: () => void }) {
  const run = useMutation();
  const nav = useNavigate();
  const d = useDerived();
  const now = nowIso();
  const [t, setT] = useState<TagTeam>(
    initial ?? {
      id: uid('team'),
      name: '',
      memberIds: [],
      brand: 'raw',
      gender: 'male',
      status: 'active',
      formedDate: d.today,
      disbandedDate: '',
      imageUrl: '',
      notes: '',
      history: [],
      createdAt: now,
      updatedAt: now,
      ...defaults,
    },
  );
  const [error, setError] = useState('');
  const set = <K extends keyof TagTeam>(k: K, v: TagTeam[K]) => setT((p) => ({ ...p, [k]: v }));
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const name = t.name.trim();
    if (!name) return setError('Team name is required.');
    if (t.memberIds.length < 2) return setError('A tag team needs at least two members.');
    const wrongGender = t.memberIds.filter((m) => d.stars.get(m)?.gender !== t.gender);
    if (wrongGender.length && t.gender) {
      // Mixed teams are allowed but flagged by their gender setting; keep it simple and just warn via error.
      return setError(`${wrongGender.map((m) => d.stars.get(m)?.ringName).join(', ')} ${wrongGender.length > 1 ? "aren't" : "isn't"} in the ${t.gender === 'male' ? "men's" : "women's"} division.`);
    }
    const before = initial?.memberIds ?? [];
    const added = t.memberIds.filter((m) => !before.includes(m));
    const removed = before.filter((m) => !t.memberIds.includes(m));
    const history = [...t.history];
    if (initial) {
      for (const m of added) history.push({ id: uid('log'), date: d.today, title: `${d.stars.get(m)?.ringName} joined the team`, text: '' });
      for (const m of removed) history.push({ id: uid('log'), date: d.today, title: `${d.stars.get(m)?.ringName} left the team`, text: '' });
      if (initial.status !== t.status) history.push({ id: uid('log'), date: d.today, title: `Status changed to ${t.status}`, text: '' });
    } else {
      history.push({ id: uid('log'), date: t.formedDate || d.today, title: 'Team formed', text: '' });
    }
    const disbandedDate = t.status === 'disbanded' && !t.disbandedDate ? d.today : t.disbandedDate;
    const ok = run((u) => {
      if (initial && initial.brand !== t.brand) {
        upsert(u.tagTeams, { ...t, brand: initial.brand, name, history, disbandedDate, updatedAt: nowIso() });
        transferEntity(u, 'team', t.id, t.brand, d.today, 'Changed in team editor');
      } else {
        upsert(u.tagTeams, { ...t, name, history, disbandedDate, updatedAt: nowIso() });
      }
    }, initial ? 'Team updated' : `${name} created`);
    if (ok) {
      onClose();
      if (!initial) nav(`/tag-teams/${t.id}`);
    }
  };
  return (
    <Modal title={initial ? `Edit ${initial.name}` : 'Create tag team'} onClose={onClose} size="wide" footer={<Footer onClose={onClose} saveLabel={initial ? 'Save changes' : 'Create team'} />}>
      <form id="modal-form" onSubmit={save} className="stack">
        <ImageInput value={t.imageUrl} onChange={(v) => set('imageUrl', v)} name={t.name} />
        <div className="form-grid">
          <Field label="Team name *">
            <input className="input" value={t.name} onChange={(e) => (set('name', e.target.value), setError(''))} autoFocus />
          </Field>
          <Field label="Brand">
            <BrandSelect value={t.brand} onChange={(v) => set('brand', v)} />
          </Field>
          <Field label="Division">
            <GenderSelect value={t.gender} onChange={(v) => (set('gender', v), set('memberIds', []))} />
          </Field>
          <Field label="Status">
            <select className="select" value={t.status} onChange={(e) => set('status', e.target.value as TagTeam['status'])}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="disbanded">Disbanded</option>
            </select>
          </Field>
          <Field label="Formed">
            <input className="input" type="date" value={t.formedDate} onChange={(e) => set('formedDate', e.target.value)} />
          </Field>
          {t.status === 'disbanded' && (
            <Field label="Disbanded">
              <input className="input" type="date" value={t.disbandedDate} onChange={(e) => set('disbandedDate', e.target.value)} />
            </Field>
          )}
          <Field label="Members (2+) *" className="span-all" hint="Joins and departures are logged in the team history" error={error}>
            <SuperstarPicker value={t.memberIds} onChange={(v) => (set('memberIds', v), setError(''))} filter={{ gender: t.gender, brand: t.brand, includeInactive: true }} />
          </Field>
          <Field label="Notes" className="span-all">
            <textarea className="textarea" value={t.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export function ChampionshipForm({ initial, onClose }: { initial?: Championship; onClose: () => void }) {
  const run = useMutation();
  const u = useData();
  const [c, setC] = useState<Championship>(
    initial ?? {
      id: uid('title'),
      name: '',
      brand: 'raw',
      gender: 'male',
      type: 'singles',
      tier: 'secondary',
      active: true,
      description: '',
      order: u.championships.length,
      createdAt: nowIso(),
    },
  );
  const [error, setError] = useState('');
  const set = <K extends keyof Championship>(k: K, v: Championship[K]) => setC((p) => ({ ...p, [k]: v }));
  const hasReigns = !!initial && u.reigns.some((r) => r.championshipId === initial.id);
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!c.name.trim()) return setError('Name is required.');
    if (run((x) => upsert(x.championships, { ...c, name: c.name.trim() }), initial ? 'Championship updated' : `${c.name.trim()} created`)) onClose();
  };
  return (
    <Modal title={initial ? `Edit ${initial.name}` : 'Create championship'} onClose={onClose} footer={<Footer onClose={onClose} saveLabel={initial ? 'Save changes' : 'Create'} />}>
      <form id="modal-form" onSubmit={save} className="form-grid">
        <Field label="Name *" className="span-all" error={error}>
          <input className="input" value={c.name} onChange={(e) => (set('name', e.target.value), setError(''))} autoFocus />
        </Field>
        <Field label="Brand">
          <BrandSelect value={c.brand} onChange={(v) => set('brand', v)} noneLabel="Cross-brand / Shared" />
        </Field>
        <Field label="Division">
          <GenderSelect value={c.gender} onChange={(v) => set('gender', v)} />
        </Field>
        <Field label="Type" hint={hasReigns ? "Can't change type once the title has history" : undefined}>
          <select className="select" value={c.type} disabled={hasReigns} onChange={(e) => set('type', e.target.value as Championship['type'])}>
            <option value="singles">Singles</option>
            <option value="tag">Tag team</option>
          </select>
        </Field>
        <Field label="Tier">
          <select className="select" value={c.tier} onChange={(e) => set('tier', e.target.value as Championship['tier'])}>
            {Object.entries(TIER_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Display order">
          <input className="input" type="number" value={c.order} onChange={(e) => set('order', Number(e.target.value))} />
        </Field>
        <Field label="Status">
          <label className="check">
            <input type="checkbox" checked={c.active} onChange={(e) => set('active', e.target.checked)} /> Active (uncheck to retire)
          </label>
        </Field>
        <Field label="Description" className="span-all">
          <textarea className="textarea" value={c.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

export function TitleChangeForm({ title, mode, onClose }: { title: Championship; mode: 'change' | 'vacate'; onClose: () => void }) {
  const run = useMutation();
  const d = useDerived();
  const u = useData();
  const [holder, setHolder] = useState<string[]>([]);
  const [teamId, setTeamId] = useState('');
  const [date, setDate] = useState(d.today);
  const [notes, setNotes] = useState('');
  const teams = u.tagTeams.filter((t) => t.gender === title.gender && t.status !== 'disbanded');
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const ok =
      mode === 'vacate'
        ? run((x) => vacateTitle(x, title.id, date, notes), `${title.name} vacated`)
        : run((x) => {
            if (title.type === 'tag') {
              const team = x.tagTeams.find((t) => t.id === teamId);
              if (!team) throw new Error('Choose the new champions.');
              recordTitleChange(x, title.id, { holderType: 'team', holderId: team.id, memberIds: [...team.memberIds] }, date, notes);
            } else {
              if (!holder[0]) throw new Error('Choose the new champion.');
              recordTitleChange(x, title.id, { holderType: 'superstar', holderId: holder[0], memberIds: [holder[0]] }, date, notes);
            }
          }, `New ${title.name} champion crowned`);
    if (ok) onClose();
  };
  return (
    <Modal title={mode === 'vacate' ? `Vacate ${title.name}` : `New ${title.name} champion`} onClose={onClose} footer={<Footer onClose={onClose} saveLabel={mode === 'vacate' ? 'Vacate title' : 'Crown champion'} />}>
      <form id="modal-form" onSubmit={save} className="stack">
        {mode === 'change' && (
          <p className="muted small">
            Use this for title changes that didn't happen in a recorded match (e.g. awarded titles or past history). To change a title in a match, tick “Title changes hands” when recording it.
          </p>
        )}
        {mode === 'change' &&
          (title.type === 'tag' ? (
            <Field label="New champions">
              <select className="select" value={teamId} onChange={(e) => setTeamId(e.target.value)} required>
                <option value="">Select a tag team…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="New champion">
              <SuperstarPicker value={holder} onChange={setHolder} max={1} filter={{ gender: title.gender, brand: title.brand, includeInactive: true }} />
            </Field>
          ))}
        <Field label={mode === 'vacate' ? 'Vacated on' : 'Won on'}>
          <input className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={mode === 'vacate' ? 'Reason' : 'Notes'}>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={mode === 'vacate' ? 'e.g. Injury' : 'e.g. Awarded by the General Manager'} />
        </Field>
      </form>
    </Modal>
  );
}

export function ReignForm({ reign, onClose }: { reign: Reign; onClose: () => void }) {
  const run = useMutation();
  const u = useData();
  const [r, setR] = useState(reign);
  const [error, setError] = useState('');
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateReignDates(u, r);
    if (err) return setError(err);
    if (run((x) => upsert(x.reigns, r), 'Reign updated')) onClose();
  };
  return (
    <Modal title="Edit reign" size="narrow" onClose={onClose} footer={<Footer onClose={onClose} />}>
      <form id="modal-form" onSubmit={save} className="stack">
        <Field label="Started">
          <input className="input" type="date" required value={r.startDate} onChange={(e) => setR({ ...r, startDate: e.target.value })} />
        </Field>
        <Field label="Ended" hint="Leave empty if this is the current reign">
          <input className="input" type="date" value={r.endDate ?? ''} onChange={(e) => setR({ ...r, endDate: e.target.value || null })} />
        </Field>
        <Field label="Notes">
          <textarea className="textarea" value={r.notes} onChange={(e) => setR({ ...r, notes: e.target.value })} />
        </Field>
        {error && <div className="form-error">{error}</div>}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export function RivalryForm({ initial, draft, onClose }: { initial?: Rivalry; draft?: Partial<Rivalry>; onClose: () => void }) {
  const run = useMutation();
  const nav = useNavigate();
  const d = useDerived();
  const u = useData();
  const now = nowIso();
  const [r, setR] = useState<Rivalry>(
    initial ?? {
      id: uid('rivalry'),
      name: '',
      brand: 'raw',
      participants: [],
      status: 'active',
      intensity: 5,
      startDate: d.today,
      endDate: '',
      description: '',
      history: [],
      winner: null,
      outcome: '',
      createdAt: now,
      updatedAt: now,
      ...draft,
    },
  );
  const [error, setError] = useState('');
  const set = <K extends keyof Rivalry>(k: K, v: Rivalry[K]) => setR((p) => ({ ...p, [k]: v }));
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!r.name.trim()) return setError('Give the rivalry a name.');
    if (r.participants.length < 2) return setError('A rivalry needs at least two participants.');
    if (r.endDate && r.endDate < r.startDate) return setError('The end date is before the start date.');
    const history = initial ? r.history : [{ id: uid('log'), date: r.startDate, title: 'Rivalry began', text: r.description }];
    const ok = run((x) => upsert(x.rivalries, { ...r, name: r.name.trim(), history, updatedAt: nowIso() }), initial ? 'Rivalry updated' : 'Rivalry created');
    if (ok) {
      onClose();
      if (!initial) nav(`/rivalries/${r.id}`);
    }
  };
  const autoName = () => {
    const names = r.participants.map((p) => (p.type === 'team' ? d.teams.get(p.id)?.name : d.stars.get(p.id)?.ringName)).filter(Boolean);
    if (names.length >= 2) set('name', names.join(' vs. '));
  };
  return (
    <Modal title={initial ? 'Edit rivalry' : 'Start a rivalry'} onClose={onClose} size="wide" footer={<Footer onClose={onClose} saveLabel={initial ? 'Save changes' : 'Create rivalry'} />}>
      <form id="modal-form" onSubmit={save} className="form-grid">
        <Field label="Participants *" className="span-all">
          <CompetitorPicker value={r.participants} onChange={(v) => (set('participants', v), setError(''))} brand={r.brand} />
        </Field>
        <Field label="Rivalry name *" className="span-all">
          <div className="row">
            <input className="input grow" value={r.name} onChange={(e) => (set('name', e.target.value), setError(''))} placeholder="e.g. The Bloodline Civil War" />
            <button type="button" className="btn" onClick={autoName} disabled={r.participants.length < 2}>
              Auto-name
            </button>
          </div>
        </Field>
        <Field label="Brand">
          <BrandSelect value={r.brand} onChange={(v) => set('brand', v)} noneLabel="Cross-brand" />
        </Field>
        <Field label="Status">
          <select className="select" value={r.status} onChange={(e) => set('status', e.target.value as Rivalry['status'])}>
            {Object.entries(RIVALRY_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Intensity: ${r.intensity}/10`}>
          <input type="range" min={1} max={10} value={r.intensity} onChange={(e) => set('intensity', Number(e.target.value))} />
        </Field>
        <Field label="Start date">
          <input className="input" type="date" required value={r.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field label="Linked storyline">
          <select className="select" value={r.storylineId ?? ''} onChange={(e) => set('storylineId', e.target.value || undefined)}>
            <option value="">None</option>
            {u.storylines.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Storyline description" className="span-all">
          <textarea className="textarea" value={r.description} onChange={(e) => set('description', e.target.value)} placeholder="Why are they fighting? What's at stake?" />
        </Field>
        {error && <div className="form-error span-all">{error}</div>}
      </form>
    </Modal>
  );
}

export function EndRivalryForm({ rivalry, onClose }: { rivalry: Rivalry; onClose: () => void }) {
  const run = useMutation();
  const d = useDerived();
  const [winner, setWinner] = useState('');
  const [date, setDate] = useState(d.today);
  const [outcome, setOutcome] = useState('');
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (date < rivalry.startDate) return;
    const w: CompetitorRef | null = winner ? (JSON.parse(winner) as CompetitorRef) : null;
    const ok = run((u) => {
      const r = u.rivalries.find((x) => x.id === rivalry.id);
      if (!r) throw new Error('Rivalry not found.');
      r.status = 'ended';
      r.endDate = date;
      r.winner = w;
      r.outcome = outcome;
      r.history.push({ id: uid('log'), date, title: 'Rivalry ended', text: outcome });
      r.updatedAt = nowIso();
    }, 'Rivalry ended');
    if (ok) onClose();
  };
  return (
    <Modal title={`End “${rivalry.name}”`} onClose={onClose} size="narrow" footer={<Footer onClose={onClose} saveLabel="End rivalry" />}>
      <form id="modal-form" onSubmit={save} className="stack">
        <Field label="Rivalry winner">
          <select className="select" value={winner} onChange={(e) => setWinner(e.target.value)}>
            <option value="">No clear winner</option>
            {rivalry.participants.map((p) => (
              <option key={p.type + p.id} value={JSON.stringify(p)}>
                {p.type === 'team' ? d.teams.get(p.id)?.name : d.stars.get(p.id)?.ringName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ending date" error={date < rivalry.startDate ? 'Must be on or after the start date' : undefined}>
          <input className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="How did it end?">
          <textarea className="textarea" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. Settled inside Hell in a Cell at Bad Blood" />
        </Field>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export function StorylineForm({ initial, onClose }: { initial?: Storyline; onClose: () => void }) {
  const run = useMutation();
  const nav = useNavigate();
  const d = useDerived();
  const u = useData();
  const now = nowIso();
  const [s, setS] = useState<Storyline>(
    initial ?? {
      id: uid('story'),
      title: '',
      description: '',
      length: 'short',
      brand: 'raw',
      superstarIds: [],
      teamIds: [],
      status: 'active',
      currentChapter: 'Chapter 1',
      startDate: d.today,
      endDate: '',
      plannedEvents: [],
      moments: [],
      outcome: '',
      createdAt: now,
      updatedAt: now,
    },
  );
  const [error, setError] = useState('');
  const set = <K extends keyof Storyline>(k: K, v: Storyline[K]) => setS((p) => ({ ...p, [k]: v }));
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!s.title.trim()) return setError('Give the storyline a title.');
    if (!s.superstarIds.length && !s.teamIds.length) return setError('Add at least one participant.');
    if (s.endDate && s.endDate < s.startDate) return setError('The end date is before the start date.');
    const ok = run((x) => upsert(x.storylines, { ...s, title: s.title.trim(), updatedAt: nowIso() }), initial ? 'Storyline updated' : 'Storyline created');
    if (ok) {
      onClose();
      if (!initial) nav(`/storylines/${s.id}`);
    }
  };
  return (
    <Modal title={initial ? 'Edit storyline' : 'New storyline'} onClose={onClose} size="wide" footer={<Footer onClose={onClose} saveLabel={initial ? 'Save changes' : 'Create storyline'} />}>
      <form id="modal-form" onSubmit={save} className="form-grid">
        <Field label="Title *" className="span-all">
          <input className="input" value={s.title} onChange={(e) => (set('title', e.target.value), setError(''))} autoFocus placeholder="e.g. The Road to WrestleMania" />
        </Field>
        <Field label="Length">
          <select className="select" value={s.length} onChange={(e) => set('length', e.target.value as Storyline['length'])}>
            <option value="short">Short-term</option>
            <option value="long">Long-term</option>
          </select>
        </Field>
        <Field label="Brand">
          <BrandSelect value={s.brand} onChange={(v) => set('brand', v)} noneLabel="Cross-brand" />
        </Field>
        <Field label="Status">
          <select className="select" value={s.status} onChange={(e) => set('status', e.target.value as Storyline['status'])}>
            {Object.entries(STORYLINE_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start date">
          <input className="input" type="date" required value={s.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field label="Current chapter">
          <input className="input" value={s.currentChapter} onChange={(e) => set('currentChapter', e.target.value)} />
        </Field>
        <Field label="End date">
          <input className="input" type="date" value={s.endDate} onChange={(e) => set('endDate', e.target.value)} />
        </Field>
        <Field label="Superstars" className="span-all">
          <SuperstarPicker value={s.superstarIds} onChange={(v) => (set('superstarIds', v), setError(''))} filter={{ brand: s.brand, includeInactive: true }} />
        </Field>
        <Field label="Tag teams" className="span-all">
          <div className="chips">
            {u.tagTeams.map((t) => (
              <button
                type="button"
                key={t.id}
                className={`chip ${s.teamIds.includes(t.id) ? 'active' : ''}`}
                onClick={() => set('teamIds', s.teamIds.includes(t.id) ? s.teamIds.filter((x) => x !== t.id) : [...s.teamIds, t.id])}
              >
                {t.name}
              </button>
            ))}
            {!u.tagTeams.length && <span className="muted small">No tag teams yet</span>}
          </div>
        </Field>
        <Field label="Description" className="span-all">
          <textarea className="textarea" value={s.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Final outcome" className="span-all" hint="Fill in when the story concludes">
          <textarea className="textarea" value={s.outcome} onChange={(e) => set('outcome', e.target.value)} />
        </Field>
        {error && <div className="form-error span-all">{error}</div>}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

/** Generic dated log entry (career notes, rivalry history, storyline moments). */
export function LogEntryForm({
  heading,
  initial,
  defaultDate,
  onSave,
  onClose,
  titlePlaceholder = 'What happened?',
}: {
  heading: string;
  initial?: LogEntry;
  defaultDate: string;
  onSave: (e: LogEntry) => boolean;
  onClose: () => void;
  titlePlaceholder?: string;
}) {
  const [e, setE] = useState<LogEntry>(initial ?? { id: uid('log'), date: defaultDate, title: '', text: '' });
  const [error, setError] = useState('');
  const save = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!e.title.trim()) return setError('A headline is required.');
    if (onSave({ ...e, title: e.title.trim() })) onClose();
  };
  return (
    <Modal title={heading} onClose={onClose} footer={<Footer onClose={onClose} />}>
      <form id="modal-form" onSubmit={save} className="stack">
        <Field label="Date">
          <input className="input" type="date" required value={e.date} onChange={(x) => setE({ ...e, date: x.target.value })} />
        </Field>
        <Field label="Headline *" error={error}>
          <input className="input" value={e.title} onChange={(x) => (setE({ ...e, title: x.target.value }), setError(''))} placeholder={titlePlaceholder} autoFocus />
        </Field>
        <Field label="Details">
          <textarea className="textarea" value={e.text} onChange={(x) => setE({ ...e, text: x.target.value })} />
        </Field>
      </form>
    </Modal>
  );
}
