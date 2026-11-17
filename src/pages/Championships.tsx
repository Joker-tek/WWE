import { Crown, History, Pencil, Plus, Trash2, Trophy, UserX } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { NotFound } from '../App';
import { ChampionCard, MatchList } from '../components/display';
import { useFeedback, useMutation } from '../components/feedback';
import { ChampionshipForm, ReignForm, TitleChangeForm } from '../components/forms';
import { Avatar, BrandBadge, Card, Chips, type Column, DataTable, Empty, PageHeader, Stat } from '../components/ui';
import { BRANDS, GENDER_LABEL, TIER_LABEL, brandLabel } from '../domain/constants';
import { deleteChampionship } from '../domain/actions';
import type { BrandKey, Championship, Gender, Reign } from '../domain/schema';
import { holderName, reignDays, reignDefenses } from '../domain/stats';
import { formatDate, plural } from '../domain/util';
import { useData, useDerived } from '../store/store';

export function ChampionshipsPage() {
  const u = useData();
  const d = useDerived();
  const [adding, setAdding] = useState(false);
  const [gender, setGender] = useState<Gender | 'all'>('all');
  const [showRetired, setShowRetired] = useState(false);
  const titles = u.championships.filter((c) => (showRetired || c.active) && (gender === 'all' || c.gender === gender)).sort((a, b) => a.order - b.order);
  const groups: { key: BrandKey; label: string }[] = [...BRANDS.map((b) => ({ key: b.key, label: b.name })), { key: 'none', label: 'Cross-brand' }];
  const longest = [...u.reigns].sort((a, b) => reignDays(b, d.today) - reignDays(a, d.today))[0];
  return (
    <div>
      <PageHeader
        eyebrow="Records"
        title="Championships"
        sub="Every title, its current holder and its full lineage"
        actions={
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Create championship
          </button>
        }
      />
      <div className="grid grid-stats mb">
        <Stat accent label="Active titles" value={u.championships.filter((c) => c.active).length} />
        <Stat label="Held" value={[...d.currentReign.keys()].filter((k) => d.titles.get(k)?.active).length} />
        <Stat label="Total reigns" value={u.reigns.length} />
        <Stat label="Longest reign" value={longest ? `${reignDays(longest, d.today)}d` : '—'} foot={longest ? holderName(d, longest) : ''} />
      </div>
      <div className="filters">
        <Chips value={gender} onChange={setGender} options={[{ key: 'all', label: 'All divisions' }, { key: 'male', label: "Men's" }, { key: 'female', label: "Women's" }]} />
        <label className="check small">
          <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} /> Show retired titles
        </label>
      </div>
      {groups.map((g) => {
        const list = titles.filter((c) => c.brand === g.key);
        if (!list.length) return null;
        return (
          <div key={g.key} className="mb">
            <div className="row mb">
              <BrandBadge brand={g.key} context="event" />
              <h3 className="display" style={{ fontSize: 16 }}>
                {g.label}
              </h3>
            </div>
            {(['male', 'female'] as Gender[]).map((gen) => {
              const sub = list.filter((c) => c.gender === gen);
              if (!sub.length) return null;
              return (
                <div key={gen} className="mb">
                  <div className="small muted strong mb" style={{ marginBottom: 8 }}>
                    {GENDER_LABEL[gen]} titles
                  </div>
                  <div className="grid grid-4">
                    {sub.map((c) => (
                      <ChampionCard key={c.id} c={c} d={d} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {!titles.length && <Empty icon={<Trophy size={20} />} title="No championships" action={<button className="btn btn-primary" onClick={() => setAdding(true)}>Create one</button>} />}
      {adding && <ChampionshipForm onClose={() => setAdding(false)} />}
    </div>
  );
}

export function ChampionshipPage() {
  const { id = '' } = useParams();
  const u = useData();
  const d = useDerived();
  const nav = useNavigate();
  const run = useMutation();
  const { confirm } = useFeedback();
  const [modal, setModal] = useState<null | 'edit' | 'change' | 'vacate' | Reign>(null);
  const c: Championship | undefined = d.titles.get(id);
  if (!c) return <NotFound what="championship" />;
  const reigns = u.reigns.filter((r) => r.championshipId === c.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const current = d.currentReign.get(c.id);
  const matches = [...d.completed, ...d.scheduled].filter((m) => m.championshipIds.includes(c.id)).sort((a, b) => b.date.localeCompare(a.date));

  const counts = new Map<string, { name: string; reigns: number; days: number }>();
  for (const r of reigns) {
    const k = `${r.holderType}:${r.holderId}`;
    const e = counts.get(k) ?? { name: holderName(d, r), reigns: 0, days: 0 };
    e.reigns++;
    e.days += reignDays(r, d.today);
    counts.set(k, e);
  }
  const mostReigns = [...counts.values()].sort((a, b) => b.reigns - a.reigns || b.days - a.days)[0];
  const mostDays = [...counts.values()].sort((a, b) => b.days - a.days)[0];
  const longest = [...reigns].sort((a, b) => reignDays(b, d.today) - reignDays(a, d.today))[0];

  const holderImg = (r: Reign) => (r.holderType === 'team' ? d.teams.get(r.holderId)?.imageUrl : d.stars.get(r.holderId)?.imageUrl);
  const holderLink = (r: Reign) => (r.holderType === 'team' ? `/tag-teams/${r.holderId}` : `/superstars/${r.holderId}`);

  const cols: Column<Reign>[] = [
    { key: 'n', label: '#', render: (r) => reigns.length - reigns.indexOf(r), num: true },
    {
      key: 'h',
      label: 'Champion',
      render: (r) => (
        <Link to={holderLink(r)} className="row" onClick={(e) => e.stopPropagation()}>
          <Avatar name={holderName(d, r)} src={holderImg(r)} size={28} square={r.holderType === 'team'} />
          <span className="link strong">{holderName(d, r)}</span>
        </Link>
      ),
      sort: (r) => holderName(d, r),
    },
    { key: 'w', label: 'Won', render: (r) => formatDate(r.startDate), sort: (r) => r.startDate },
    { key: 'l', label: 'Lost', render: (r) => (r.endDate ? formatDate(r.endDate) : <span className="badge badge-gold">Current</span>), sort: (r) => r.endDate ?? '9999' },
    { key: 'd', label: 'Days', render: (r) => reignDays(r, d.today), sort: (r) => reignDays(r, d.today), num: true },
    { key: 'def', label: 'Defenses', render: (r) => reignDefenses(d, r), sort: (r) => reignDefenses(d, r), num: true },
    { key: 'notes', label: 'Notes', render: (r) => <span className="small muted">{r.notes}</span> },
    {
      key: 'a',
      label: '',
      render: (r) => (
        <div className="row" style={{ gap: 2 }}>
          <button className="btn btn-ghost btn-sm icon-btn" aria-label="Edit reign" onClick={(e) => (e.stopPropagation(), setModal(r))}>
            <Pencil size={14} />
          </button>
          <button
            className="btn btn-ghost btn-sm icon-btn"
            aria-label="Delete reign"
            onClick={async (e) => {
              e.stopPropagation();
              const ok = await confirm({
                title: 'Delete this reign?',
                text: `${holderName(d, r)}'s reign will be removed from the lineage. The match that started it (if any) is kept. If this was the current reign, the title becomes vacant.`,
                confirmLabel: 'Delete reign',
                danger: true,
              });
              if (ok)
                run((x) => {
                  x.reigns = x.reigns.filter((y) => y.id !== r.id);
                  for (const m of x.matches) if (m.id === r.wonAtMatchId) m.titleChanged = false;
                }, 'Reign deleted');
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete ${c.name}?`,
      text: `This removes the title and its ${plural(reigns.length, 'reign')}. Matches stay, but lose the title stakes. Consider retiring it instead (Edit → uncheck Active) to keep its history.`,
      confirmLabel: 'Delete championship',
      danger: true,
    });
    if (ok && run((x) => deleteChampionship(x, c.id), 'Championship deleted')) nav('/championships');
  };

  return (
    <div>
      <div className="hero">
        <div className="eyebrow">
          {brandLabel(c.brand, 'event')} · {GENDER_LABEL[c.gender]} · {c.type === 'tag' ? 'Tag team' : 'Singles'} · {TIER_LABEL[c.tier]}
          {!c.active && ' · Retired'}
        </div>
        <h1 className="metal-text">{c.name}</h1>
        {c.description && <div className="sub">{c.description}</div>}
        <div className="row wrap mt" style={{ gap: 16 }}>
          {current ? (
            <Link to={holderLink(current)} className="row">
              <Avatar name={holderName(d, current)} src={holderImg(current)} size={64} square={current.holderType === 'team'} brand={c.brand} />
              <div>
                <div className="tiny" style={{ color: 'var(--gold)', letterSpacing: '0.1em', fontWeight: 700 }}>
                  CURRENT CHAMPION
                </div>
                <div className="display" style={{ fontSize: 24 }}>
                  {holderName(d, current)}
                </div>
                <div className="small" style={{ color: '#b9bac6' }}>
                  {reignDays(current, d.today)} days · since {formatDate(current.startDate)} · {plural(reignDefenses(d, current), 'defense')}
                </div>
              </div>
            </Link>
          ) : (
            <div className="display muted" style={{ fontSize: 22 }}>
              Vacant
            </div>
          )}
          <div className="grow" />
          <div className="btn-group">
            <button className="btn btn-gold" onClick={() => setModal('change')}>
              <Crown size={15} /> Record title change
            </button>
            {current && (
              <button className="btn" onClick={() => setModal('vacate')}>
                <UserX size={15} /> Vacate
              </button>
            )}
            <button className="btn" onClick={() => setModal('edit')}>
              <Pencil size={15} /> Edit
            </button>
            <button className="btn btn-danger icon-btn" onClick={onDelete} aria-label="Delete championship">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-stats mb">
        <Stat accent label="Reigns" value={reigns.length} />
        <Stat label="Unique champions" value={counts.size} />
        <Stat label="Longest reign" value={longest ? `${reignDays(longest, d.today)}d` : '—'} foot={longest ? holderName(d, longest) : ''} />
        <Stat label="Most reigns" value={mostReigns?.reigns ?? '—'} foot={mostReigns?.name} />
        <Stat label="Most total days" value={mostDays ? `${mostDays.days}d` : '—'} foot={mostDays?.name} />
        <Stat label="Title matches" value={matches.filter((m) => m.status === 'completed').length} />
      </div>
      <div className="stack">
        <Card title="Title history" icon={<History size={16} />} flush>
          <DataTable rows={reigns} columns={cols} rowKey={(r) => r.id} empty={<Empty icon={<Trophy size={20} />} title="No reigns yet" text="Crown a champion with “Record title change”, or record a match with this title at stake." />} />
        </Card>
        <Card title="Title matches" icon={<Trophy size={16} />} flush>
          <MatchList matches={matches} empty={<Empty title="No title matches yet" />} />
        </Card>
      </div>
      {modal === 'edit' && <ChampionshipForm initial={c} onClose={() => setModal(null)} />}
      {(modal === 'change' || modal === 'vacate') && <TitleChangeForm title={c} mode={modal} onClose={() => setModal(null)} />}
      {modal && typeof modal === 'object' && <ReignForm reign={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
