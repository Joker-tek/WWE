import { ArrowRightLeft, BookOpen, Pencil, Plus, Swords, Trash2, Trophy, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { NotFound } from '../App';
import { MatchList, RefList, StarLink, Timeline } from '../components/display';
import { useFeedback, useMutation } from '../components/feedback';
import { LogEntryForm, TeamForm, TransferForm } from '../components/forms';
import { SearchInput } from '../components/pickers';
import { Avatar, BrandBadge, Card, Chips, Empty, Form, PageHeader, RecordText, Stat, StatusBadge, Streak } from '../components/ui';
import { BRANDS, brandLabel } from '../domain/constants';
import { deleteTeam, teamReferences } from '../domain/actions';
import type { BrandKey, Gender, TagTeam } from '../domain/schema';
import { matchesOfTeam, recordOf, reignDays } from '../domain/stats';
import { formatDate, matchesQuery, pct } from '../domain/util';
import { useData, useDerived } from '../store/store';

export function TagTeamsPage() {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <PageHeader
        eyebrow="Roster"
        title="Tag Teams"
        sub="Teams, factions and their records"
        actions={
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Create team
          </button>
        }
      />
      <TeamGrid />
      {adding && <TeamForm onClose={() => setAdding(false)} />}
    </div>
  );
}

export function TeamGrid({ brand: fixedBrand, gender: fixedGender }: { brand?: BrandKey; gender?: Gender }) {
  const u = useData();
  const d = useDerived();
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState<BrandKey | 'all'>(fixedBrand ?? 'all');
  const [gender, setGender] = useState<Gender | 'all'>(fixedGender ?? 'all');
  const [showDisbanded, setShowDisbanded] = useState(false);
  const teams = u.tagTeams
    .filter(
      (t) =>
        (brand === 'all' || t.brand === brand) &&
        (gender === 'all' || t.gender === gender) &&
        (showDisbanded || t.status !== 'disbanded') &&
        matchesQuery(q, t.name, ...t.memberIds.map((m) => d.stars.get(m)?.ringName)),
    )
    .sort((a, b) => (d.teamPower.get(b.id) ?? 0) - (d.teamPower.get(a.id) ?? 0));
  const groups: Gender[] = gender === 'all' ? ['male', 'female'] : [gender];
  return (
    <div>
      <div className="filters">
        <SearchInput value={q} onChange={setQ} placeholder="Search teams or members…" />
        {!fixedBrand && <Chips value={brand} onChange={setBrand} options={[{ key: 'all', label: 'All brands' }, ...BRANDS.map((b) => ({ key: b.key, label: b.short }))]} />}
        {!fixedGender && <Chips value={gender} onChange={setGender} options={[{ key: 'all', label: 'All' }, { key: 'male', label: "Men's" }, { key: 'female', label: "Women's" }]} />}
        <label className="check small">
          <input type="checkbox" checked={showDisbanded} onChange={(e) => setShowDisbanded(e.target.checked)} /> Show disbanded
        </label>
      </div>
      {groups.map((g) => {
        const list = teams.filter((t) => t.gender === g);
        return (
          <div key={g} className="mb">
            <h3 className="display muted mb" style={{ fontSize: 15 }}>
              {g === 'male' ? "Men's" : "Women's"} tag division · {list.length}
            </h3>
            {list.length ? (
              <div className="grid grid-3">
                {list.map((t) => (
                  <TeamCard key={t.id} t={t} />
                ))}
              </div>
            ) : (
              <Empty icon={<Users size={20} />} title="No teams here yet" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TeamCard({ t }: { t: TagTeam }) {
  const d = useDerived();
  const rec = recordOf(d, t.id, 'team');
  const titles = (d.heldTitles.get(t.id) ?? []).filter((c) => c.type === 'tag');
  return (
    <Link to={`/tag-teams/${t.id}`} className="card hoverable card-pad stack-sm">
      <div className="row">
        <Avatar name={t.name} src={t.imageUrl} brand={t.brand} size={46} square />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="strong truncate" style={{ fontSize: 15 }}>
            {t.name}
          </div>
          <div className="small muted truncate">{t.memberIds.map((m) => d.stars.get(m)?.ringName).join(' & ') || 'No members'}</div>
        </div>
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        <BrandBadge brand={t.brand} />
        {t.status !== 'active' && <StatusBadge status={t.status} label={t.status} />}
        {titles.map((c) => (
          <span key={c.id} className="badge badge-gold">
            <Trophy size={11} /> {c.name}
          </span>
        ))}
      </div>
      <div className="row between small">
        <span>
          <RecordText rec={rec} /> <span className="muted">W-L-D</span>
        </span>
        <Form form={rec.form.slice(0, 5)} />
      </div>
    </Link>
  );
}

export function TagTeamPage() {
  const { id = '' } = useParams();
  const u = useData();
  const d = useDerived();
  const nav = useNavigate();
  const run = useMutation();
  const { confirm } = useFeedback();
  const [modal, setModal] = useState<null | 'edit' | 'transfer' | 'log'>(null);
  const t = d.teams.get(id);
  if (!t) return <NotFound what="team" />;
  const rec = recordOf(d, t.id, 'team');
  const matches = [...matchesOfTeam(d, t.id), ...d.scheduled.filter((m) => m.sides.some((s) => s.teamId === t.id))].sort((a, b) => b.date.localeCompare(a.date));
  const reigns = [...(d.reignsOfTeam.get(t.id) ?? [])].reverse();
  const rivalries = u.rivalries.filter((r) => r.participants.some((p) => p.type === 'team' && p.id === t.id));
  const history = [
    ...t.history.map((h) => ({ key: h.id, date: h.date, title: h.title, text: h.text })),
    ...u.transfers.filter((x) => x.entityType === 'team' && x.entityId === t.id).map((x) => ({ key: x.id, date: x.date, kind: 'transfer' as const, title: `Moved from ${brandLabel(x.fromBrand)} to ${brandLabel(x.toBrand)}`, text: x.note })),
    ...reigns.map((r) => ({ key: r.id, date: r.startDate, kind: 'match' as const, title: `Won the ${d.titles.get(r.championshipId)?.name}`, text: r.endDate ? `Held for ${reignDays(r, d.today)} days` : 'Current champions' })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const onDelete = async () => {
    const refs = teamReferences(u, t.id);
    if (refs.matches || refs.reigns) return void run((x) => deleteTeam(x, t.id));
    if (await confirm({ title: `Delete ${t.name}?`, text: 'Members stay on the roster. This cannot be undone (except by restoring a snapshot).', confirmLabel: 'Delete', danger: true })) {
      if (run((x) => deleteTeam(x, t.id), 'Team deleted')) nav('/tag-teams');
    }
  };

  return (
    <div>
      <div className="hero">
        <div className="row wrap" style={{ gap: 20 }}>
          <Avatar name={t.name} src={t.imageUrl} brand={t.brand} size={96} square />
          <div className="grow" style={{ minWidth: 220 }}>
            <div className="eyebrow">{t.gender === 'male' ? "Men's" : "Women's"} tag team</div>
            <h1 className="metal-text">{t.name}</h1>
            <div className="row wrap mt-sm" style={{ gap: 6 }}>
              <BrandBadge brand={t.brand} />
              <StatusBadge status={t.status} label={t.status} />
              {(d.heldTitles.get(t.id) ?? []).map((c) => (
                <span key={c.id} className="badge badge-gold">
                  <Trophy size={12} /> {c.name}
                </span>
              ))}
            </div>
            <div className="small mt-sm" style={{ color: '#b9bac6' }}>
              {t.formedDate && `Formed ${formatDate(t.formedDate)}`}
              {t.disbandedDate && ` · Disbanded ${formatDate(t.disbandedDate)}`}
            </div>
          </div>
          <div className="btn-group">
            <button className="btn" onClick={() => setModal('edit')}>
              <Pencil size={15} /> Edit / members
            </button>
            <button className="btn" onClick={() => setModal('transfer')}>
              <ArrowRightLeft size={15} /> Transfer
            </button>
            <button className="btn btn-danger icon-btn" onClick={onDelete} aria-label="Delete team">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-stats mb">
        <Stat accent label="Matches" value={rec.matches} />
        <Stat label="Wins" value={rec.wins} />
        <Stat label="Losses" value={rec.losses} />
        <Stat label="Draws" value={rec.draws} />
        <Stat label="Win %" value={rec.matches ? pct(rec.winPct) : '—'} />
        <Stat label="Streak" value={<Streak rec={rec} />} />
        <Stat label="Title reigns" value={reigns.length} />
      </div>
      <div className="cols-main">
        <div className="stack">
          <Card title="Matches" icon={<Swords size={16} />} flush>
            <MatchList matches={matches} focusId={t.id} />
          </Card>
          <Card title="Championship reigns" icon={<Trophy size={16} />} flush>
            {reigns.length ? (
              <div className="list">
                {reigns.map((r) => (
                  <Link key={r.id} to={`/championships/${r.championshipId}`} className="list-item">
                    <Trophy size={16} color="var(--gold)" />
                    <span className="grow strong">{d.titles.get(r.championshipId)?.name}</span>
                    <span className="small muted">
                      {formatDate(r.startDate)} → {r.endDate ? formatDate(r.endDate) : 'present'} · {reignDays(r, d.today)} days
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty title="No title reigns yet" />
            )}
          </Card>
        </div>
        <div className="stack">
          <Card title="Members" icon={<Users size={16} />} flush actions={<button className="btn btn-sm" onClick={() => setModal('edit')}>Manage</button>}>
            {t.memberIds.length ? (
              <div className="list">
                {t.memberIds.map((m) => {
                  const s = d.stars.get(m);
                  if (!s) return null;
                  const r = recordOf(d, m);
                  return (
                    <div key={m} className="list-item">
                      <Avatar name={s.ringName} src={s.imageUrl} brand={s.brand} size={32} />
                      <div className="grow">
                        <StarLink id={m} d={d} />
                        <div className="tiny muted">
                          Singles + tag record {r.wins}-{r.losses}-{r.draws}
                        </div>
                      </div>
                      {s.brand !== t.brand && <BrandBadge brand={s.brand} />}
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty title="No members" />
            )}
          </Card>
          <Card title="Rivalries" icon={<Swords size={16} />} flush>
            {rivalries.length ? (
              <div className="list">
                {rivalries.map((r) => (
                  <Link key={r.id} to={`/rivalries/${r.id}`} className="list-item">
                    <div className="grow">
                      <div className="strong">{r.name}</div>
                      <div className="small muted">
                        <RefList refs={r.participants} d={d} plain />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty title="No rivalries" />
            )}
          </Card>
          <Card title="History" icon={<BookOpen size={16} />} actions={<button className="btn btn-sm" onClick={() => setModal('log')}><Plus size={14} /> Add</button>}>
            <Timeline entries={history} />
            {t.notes && <p className="small pre mt">{t.notes}</p>}
          </Card>
        </div>
      </div>
      {modal === 'edit' && <TeamForm initial={t} onClose={() => setModal(null)} />}
      {modal === 'transfer' && <TransferForm type="team" entity={t} onClose={() => setModal(null)} />}
      {modal === 'log' && (
        <LogEntryForm
          heading="Add team history entry"
          defaultDate={d.today}
          onClose={() => setModal(null)}
          onSave={(e) => run((x) => void x.tagTeams.find((y) => y.id === t.id)!.history.push(e), 'Entry added')}
        />
      )}
    </div>
  );
}
