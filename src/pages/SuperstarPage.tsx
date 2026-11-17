import { ArrowRightLeft, BookOpen, Pencil, Plus, Swords, Trash2, Trophy, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { NotFound } from '../App';
import { MatchList, RefList, Timeline, type TimelineEntry } from '../components/display';
import { useFeedback, useMutation } from '../components/feedback';
import { LogEntryForm, SuperstarForm, TransferForm } from '../components/forms';
import { AlignmentBadge, Avatar, BrandBadge, Card, type Column, DataTable, Empty, Form, Stat, StatusBadge, Tabs } from '../components/ui';
import { DIVISION_LABEL, GENDER_LABEL, STATUS_LABEL, brandLabel } from '../domain/constants';
import { deleteSuperstar, superstarReferences } from '../domain/actions';
import type { CompetitorRef, LogEntry, Reign, SuperstarStatus } from '../domain/schema';
import { headToHead, holderName, matchesOfStar, recordOf, reignDays, reignDefenses, sideOfStar } from '../domain/stats';
import { formatDate, pct, plural } from '../domain/util';
import { useData, useDerived } from '../store/store';

type Tab = 'matches' | 'titles' | 'rivalries' | 'h2h' | 'career';

export function SuperstarPage() {
  const { id = '' } = useParams();
  const u = useData();
  const d = useDerived();
  const nav = useNavigate();
  const run = useMutation();
  const { confirm } = useFeedback();
  const [tab, setTab] = useState<Tab>('matches');
  const [modal, setModal] = useState<null | 'edit' | 'transfer' | 'log' | LogEntry>(null);
  const s = d.stars.get(id);

  const matches = useMemo(() => (s ? matchesOfStar(d, s.id, true).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)) : []), [d, s]);

  const opponents = useMemo(() => {
    if (!s) return [];
    const ids = new Set<string>();
    for (const m of d.completed) {
      const mine = sideOfStar(m, s.id);
      if (!mine) continue;
      for (const side of m.sides) if (side !== mine) side.superstarIds.forEach((x) => ids.add(x));
    }
    const me: CompetitorRef = { type: 'superstar', id: s.id };
    return [...ids]
      .map((oid) => ({ id: oid, h: headToHead(d.completed, me, { type: 'superstar', id: oid }) }))
      .sort((a, b) => b.h.matches.length - a.h.matches.length);
  }, [d, s]);

  if (!s) return <NotFound what="superstar" />;
  const rec = recordOf(d, s.id);
  const reigns: Reign[] = [...(d.reignsOfStar.get(s.id) ?? [])].reverse();
  const held = d.heldTitles.get(s.id) ?? [];
  const rivalries = u.rivalries.filter((r) => r.participants.some((p) => (p.type === 'superstar' ? p.id === s.id : d.teams.get(p.id)?.memberIds.includes(s.id))));
  const storylines = u.storylines.filter((st) => st.superstarIds.includes(s.id) || st.teamIds.some((t) => d.teams.get(t)?.memberIds.includes(s.id)));
  const teams = d.teamsOfStar.get(s.id) ?? [];
  const longestReign = reigns.reduce((m, r) => Math.max(m, reignDays(r, d.today)), 0);

  const onDelete = async () => {
    const refs = superstarReferences(u, s.id);
    if (refs.matches || refs.reigns) {
      run((x) => deleteSuperstar(x, s.id));
      return;
    }
    if (await confirm({ title: `Delete ${s.ringName}?`, text: 'They will also be removed from tag teams, rivalries and storylines. This cannot be undone (except by restoring a snapshot).', confirmLabel: 'Delete', danger: true })) {
      if (run((x) => deleteSuperstar(x, s.id), `${s.ringName} deleted`)) nav(`/roster/${s.gender}`);
    }
  };

  const setStatus = (status: SuperstarStatus) =>
    run((x) => {
      const t = x.superstars.find((y) => y.id === s.id)!;
      t.career.push({ id: `log_${Date.now()}`, date: d.today, title: `Status changed: ${STATUS_LABEL[t.status]} → ${STATUS_LABEL[status]}`, text: '' });
      t.status = status;
    }, `Status set to ${STATUS_LABEL[status]}`);

  const career: TimelineEntry[] = [
    ...s.career.map((c) => ({
      key: c.id,
      date: c.date,
      title: c.title,
      text: c.text,
      actions: (
        <div className="row" style={{ gap: 2 }}>
          <button className="btn btn-ghost btn-sm icon-btn" aria-label="Edit entry" onClick={() => setModal(c)}>
            <Pencil size={13} />
          </button>
          <button
            className="btn btn-ghost btn-sm icon-btn"
            aria-label="Delete entry"
            onClick={() => run((x) => void (x.superstars.find((y) => y.id === s.id)!.career = x.superstars.find((y) => y.id === s.id)!.career.filter((e) => e.id !== c.id)), 'Entry deleted')}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    })),
    ...u.transfers
      .filter((t) => t.entityType === 'superstar' && t.entityId === s.id)
      .map((t) => ({ key: t.id, date: t.date, kind: 'transfer' as const, title: `Moved from ${brandLabel(t.fromBrand)} to ${brandLabel(t.toBrand)}`, text: t.note })),
    ...reigns.map((r) => ({ key: `won-${r.id}`, date: r.startDate, kind: 'match' as const, title: `Won the ${d.titles.get(r.championshipId)?.name ?? 'title'}`, text: r.holderType === 'team' ? `with ${holderName(d, r)}` : '' })),
    ...(s.debutDate ? [{ key: 'debut', date: s.debutDate, title: 'Debut', text: '' }] : []),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const reignCols: Column<Reign>[] = [
    { key: 'title', label: 'Championship', render: (r) => <Link className="link" to={`/championships/${r.championshipId}`}>{d.titles.get(r.championshipId)?.name}</Link> },
    { key: 'as', label: 'As', render: (r) => (r.holderType === 'team' ? holderName(d, r) : 'Singles') },
    { key: 'won', label: 'Won', render: (r) => formatDate(r.startDate), sort: (r) => r.startDate },
    { key: 'lost', label: 'Lost', render: (r) => (r.endDate ? formatDate(r.endDate) : <span className="badge badge-gold">Current</span>) },
    { key: 'days', label: 'Days', render: (r) => reignDays(r, d.today), sort: (r) => reignDays(r, d.today), num: true },
    { key: 'def', label: 'Defenses', render: (r) => reignDefenses(d, r), num: true },
  ];

  return (
    <div>
      <div className="hero" style={{ borderTop: `3px solid var(--${s.brand === 'none' ? 'none' : s.brand})` }}>
        <div className="row wrap" style={{ gap: 20, alignItems: 'center' }}>
          <Avatar name={s.ringName} src={s.imageUrl} size={112} brand={s.brand} />
          <div className="grow" style={{ minWidth: 220 }}>
            <div className="eyebrow">
              {GENDER_LABEL[s.gender]} division · {DIVISION_LABEL[s.division]}
            </div>
            <h1 className="metal-text">{s.ringName}</h1>
            {s.realName && <div className="sub">{s.realName}</div>}
            <div className="row wrap mt-sm" style={{ gap: 6 }}>
              <BrandBadge brand={s.brand} />
              <AlignmentBadge alignment={s.alignment} />
              <StatusBadge status={s.status} />
              {held.map((t) => (
                <span key={t.id} className="badge badge-gold">
                  <Trophy size={12} /> {t.name}
                </span>
              ))}
            </div>
            <div className="small mt-sm" style={{ color: '#b9bac6' }}>
              {[s.hometown && `From ${s.hometown}`, s.height, s.weight, s.finisher && `Finisher: ${s.finisher}`, `Popularity ${s.popularity}`].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div className="btn-group">
            <button className="btn" onClick={() => setModal('edit')}>
              <Pencil size={15} /> Edit
            </button>
            <button className="btn" onClick={() => setModal('transfer')}>
              <ArrowRightLeft size={15} /> Transfer
            </button>
            <select className="select" style={{ width: 'auto', height: 36 }} value={s.status} onChange={(e) => setStatus(e.target.value as SuperstarStatus)} aria-label="Change status">
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button className="btn btn-danger icon-btn" onClick={onDelete} aria-label="Delete superstar" title="Delete superstar">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-stats mb">
        <Stat accent label="Matches" value={rec.matches} />
        <Stat label="Wins" value={rec.wins} />
        <Stat label="Losses" value={rec.losses} />
        <Stat label="Draws" value={rec.draws} foot="incl. no contests" />
        <Stat label="Win %" value={rec.matches ? pct(rec.winPct) : '—'} />
        <Stat label="Streak" value={rec.streak ? <span className={`streak-${rec.streak.type}`}>{`${rec.streak.type}${rec.streak.count}`}</span> : '—'} foot={`Best W${rec.longestWin} · Worst L${rec.longestLoss}`} />
        <Stat label="Power rank" value={d.rank.get(s.id) ? `#${d.rank.get(s.id)}` : '—'} foot={`Score ${d.power.get(s.id) ?? 0}`} />
        <Stat label="Title reigns" value={reigns.length} foot={longestReign ? `Longest ${longestReign} days` : 'No gold yet'} />
      </div>

      <div className="cols-main">
        <div>
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { key: 'matches', label: 'Match history', count: matches.length },
              { key: 'titles', label: 'Championships', count: reigns.length },
              { key: 'rivalries', label: 'Rivalries & stories', count: rivalries.length + storylines.length },
              { key: 'h2h', label: 'Head-to-head', count: opponents.length },
              { key: 'career', label: 'Career', count: career.length },
            ]}
          />
          {tab === 'matches' && (
            <div className="card">
              <MatchList matches={matches} focusId={s.id} empty={<Empty icon={<Swords size={20} />} title="No matches yet" action={<Link className="btn btn-primary" to="/matches/new">Record a match</Link>} />} />
            </div>
          )}
          {tab === 'titles' && (
            <div className="card">
              <DataTable rows={reigns} columns={reignCols} rowKey={(r) => r.id} empty={<Empty icon={<Trophy size={20} />} title="No championship reigns yet" />} />
            </div>
          )}
          {tab === 'rivalries' && (
            <div className="stack">
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
                        <StatusBadge status={r.status} label={r.status} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Empty title="No rivalries" />
                )}
              </Card>
              <Card title="Storylines" icon={<BookOpen size={16} />} flush>
                {storylines.length ? (
                  <div className="list">
                    {storylines.map((st) => (
                      <Link key={st.id} to={`/storylines/${st.id}`} className="list-item">
                        <div className="grow">
                          <div className="strong">{st.title}</div>
                          <div className="small muted">{st.currentChapter}</div>
                        </div>
                        <StatusBadge status={st.status} label={st.status} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Empty title="Not part of any storyline" />
                )}
              </Card>
            </div>
          )}
          {tab === 'h2h' && (
            <div className="card">
              <DataTable
                rows={opponents}
                rowKey={(o) => o.id}
                initialSort={{ key: 'm', dir: 'desc' }}
                empty={<Empty title="No opponents yet" />}
                columns={[
                  { key: 'o', label: 'Opponent', render: (o) => <Link className="link" to={`/superstars/${o.id}`}>{d.stars.get(o.id)?.ringName}</Link>, sort: (o) => d.stars.get(o.id)?.ringName ?? '' },
                  { key: 'm', label: 'Meetings', render: (o) => o.h.matches.length, sort: (o) => o.h.matches.length, num: true },
                  { key: 'w', label: 'Wins', render: (o) => o.h.aWins, sort: (o) => o.h.aWins, num: true },
                  { key: 'l', label: 'Losses', render: (o) => o.h.bWins, sort: (o) => o.h.bWins, num: true },
                  { key: 'd', label: 'Draws', render: (o) => o.h.draws, num: true },
                  { key: 'x', label: 'Other winner', render: (o) => o.h.other, num: true },
                ]}
              />
            </div>
          )}
          {tab === 'career' && (
            <Card
              title="Career history"
              icon={<BookOpen size={16} />}
              actions={
                <button className="btn btn-sm" onClick={() => setModal('log')}>
                  <Plus size={14} /> Add entry
                </button>
              }
            >
              <Timeline entries={career} empty={<Empty title="No career entries yet" text="Title wins and transfers appear here automatically. Add your own milestones too." />} />
            </Card>
          )}
        </div>
        <div className="stack">
          <Card title="Recent form">
            <Form form={rec.form} />
            <div className="small muted mt-sm">
              {rec.lastMatchDate ? `Last match ${formatDate(rec.lastMatchDate)}` : 'Has not wrestled yet'}
              {rec.firstMatchDate && ` · First recorded ${formatDate(rec.firstMatchDate)}`}
            </div>
          </Card>
          <Card title="Tag teams" icon={<Users size={16} />} flush>
            {teams.length ? (
              <div className="list">
                {teams.map((t) => (
                  <Link key={t.id} to={`/tag-teams/${t.id}`} className="list-item">
                    <Avatar name={t.name} src={t.imageUrl} brand={t.brand} size={30} square />
                    <span className="grow strong">{t.name}</span>
                    <StatusBadge status={t.status} label={t.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty title="Not in a tag team" />
            )}
          </Card>
          <Card title="Notes">{s.notes ? <p className="pre small">{s.notes}</p> : <span className="muted small">No notes. Use Edit to add character notes.</span>}</Card>
          <div className="small muted">{plural(matches.filter((m) => m.status === 'scheduled').length, 'upcoming match', 'upcoming matches')}</div>
        </div>
      </div>

      {modal === 'edit' && <SuperstarForm initial={s} onClose={() => setModal(null)} />}
      {modal === 'transfer' && <TransferForm type="superstar" entity={s} onClose={() => setModal(null)} />}
      {(modal === 'log' || (modal && typeof modal === 'object')) && (
        <LogEntryForm
          heading={typeof modal === 'object' ? 'Edit career entry' : 'Add career entry'}
          initial={typeof modal === 'object' ? modal : undefined}
          defaultDate={d.today}
          titlePlaceholder="e.g. Won the Royal Rumble"
          onClose={() => setModal(null)}
          onSave={(entry) =>
            run((x) => {
              const t = x.superstars.find((y) => y.id === s.id)!;
              const i = t.career.findIndex((c) => c.id === entry.id);
              if (i >= 0) t.career[i] = entry;
              else t.career.push(entry);
            }, 'Career entry saved')
          }
        />
      )}
    </div>
  );
}
