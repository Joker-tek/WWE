import { Award, CalendarClock, Pencil, Swords, Trash2, Trophy } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { brandInfo, matchTypeLabel } from '../domain/constants';
import { deleteMatch } from '../domain/actions';
import type { Championship, CompetitorRef, Match, Superstar } from '../domain/schema';
import { type Derived, holderName, recordOf, refName, reignDays, sideResult } from '../domain/stats';
import { formatDate, plural } from '../domain/util';
import { useDerived } from '../store/store';
import { useFeedback, useMutation } from './feedback';
import { AlignmentBadge, Avatar, BrandBadge, Empty, Form, RecordText, StatusBadge } from './ui';

export function StarLink({ id, d }: { id: string; d: Derived }) {
  const s = d.stars.get(id);
  if (!s) return <span className="muted">Unknown</span>;
  return (
    <Link className="link" to={`/superstars/${id}`} onClick={(e) => e.stopPropagation()}>
      {s.ringName}
    </Link>
  );
}

export function RefLink({ r, d }: { r: CompetitorRef; d: Derived }) {
  if (r.type === 'superstar') return <StarLink id={r.id} d={d} />;
  const t = d.teams.get(r.id);
  return t ? (
    <Link className="link" to={`/tag-teams/${r.id}`} onClick={(e) => e.stopPropagation()}>
      {t.name}
    </Link>
  ) : (
    <span className="muted">Unknown team</span>
  );
}

/** Participant names; `plain` renders text only (for use inside a card that is itself a link). */
export function RefList({ refs, d, sep = ' vs. ', plain }: { refs: CompetitorRef[]; d: Derived; sep?: string; plain?: boolean }) {
  if (plain) return <>{refs.map((r) => refName(d, r)).join(sep)}</>;
  return (
    <>
      {refs.map((r, i) => (
        <Fragment key={r.type + r.id}>
          {i > 0 && <span className="muted">{sep}</span>}
          <RefLink r={r} d={d} />
        </Fragment>
      ))}
    </>
  );
}

function SideNames({ m, sideIdx, d }: { m: Match; sideIdx: number; d: Derived }) {
  const side = m.sides[sideIdx];
  const team = side.teamId ? d.teams.get(side.teamId) : undefined;
  const people = side.superstarIds.map((id, i) => (
    <Fragment key={id}>
      {i > 0 && ' & '}
      <StarLink id={id} d={d} />
    </Fragment>
  ));
  if (team) {
    return (
      <>
        <Link className="link" to={`/tag-teams/${team.id}`}>
          {team.name}
        </Link>{' '}
        <span className="muted small">({people})</span>
      </>
    );
  }
  return <>{people}</>;
}

export function MatchItem({ m, focusId, compact }: { m: Match; focusId?: string; compact?: boolean }) {
  const d = useDerived();
  const nav = useNavigate();
  const run = useMutation();
  const { confirm } = useFeedback();
  const focusSide = focusId ? m.sides.find((s) => s.superstarIds.includes(focusId) || s.teamId === focusId) : undefined;
  const focusRes = focusSide ? sideResult(m, focusSide) : null;
  const ffa = m.sides.length > 4 && m.sides.every((s) => s.superstarIds.length === 1);
  const winner = m.sides.find((s) => s.id === m.winnerSideId);

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Delete match?',
      text: 'Statistics are recalculated automatically. If this match changed a title and that reign is still current, the change is undone.',
      confirmLabel: 'Delete match',
      danger: true,
    });
    if (ok) run((u) => deleteMatch(u, m.id), 'Match deleted');
  };

  return (
    <div className="match">
      <div className="match-meta">
        {focusRes && <span className={`res res-${focusRes}`}>{focusRes}</span>}
        <span>{formatDate(m.date)}</span>
        {m.eventName && <span>· {m.eventName}</span>}
        <BrandBadge brand={m.brand} context="event" />
        <span className="badge">{matchTypeLabel(m.matchType)}</span>
        {m.status === 'scheduled' && (
          <span className="badge badge-scheduled">
            <CalendarClock size={12} /> Scheduled
          </span>
        )}
        {m.championshipIds.map((c) => (
          <span key={c} className="badge badge-gold">
            <Trophy size={12} /> {d.titles.get(c)?.name ?? 'Title'}
          </span>
        ))}
        {m.titleChanged && <span className="badge badge-gold">New champion</span>}
        {m.rating !== undefined && <span className="muted">{'★'.repeat(Math.round(m.rating))}{m.rating % 1 ? '½' : ''}</span>}
      </div>
      <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
        <div className="match-sides grow">
          {ffa ? (
            <span>
              {winner ? (
                <>
                  <span className="winner">
                    <SideNames m={m} sideIdx={m.sides.indexOf(winner)} d={d} />
                  </span>{' '}
                  won a {plural(m.sides.length, 'person', 'people')} {matchTypeLabel(m.matchType)}
                </>
              ) : (
                <>{plural(m.sides.length, 'entrant')}</>
              )}
            </span>
          ) : (
            m.sides.map((s, i) => {
              const r = sideResult(m, s);
              return (
                <Fragment key={s.id}>
                  {i > 0 && <span className="vs">VS</span>}
                  <span className={r === 'W' ? 'winner' : r === 'L' ? 'loser' : ''}>
                    <SideNames m={m} sideIdx={i} d={d} />
                    {r === 'W' && ' ✓'}
                  </span>
                </Fragment>
              );
            })
          )}
        </div>
        {!compact && (
          <div className="match-actions">
            {m.status === 'scheduled' && (
              <button className="btn btn-sm btn-primary" onClick={() => nav(`/matches/${m.id}/edit?complete=1`)}>
                Record result
              </button>
            )}
            <button className="btn btn-sm btn-ghost icon-btn" title="Edit match" aria-label="Edit match" onClick={() => nav(`/matches/${m.id}/edit`)}>
              <Pencil size={15} />
            </button>
            <button className="btn btn-sm btn-ghost icon-btn" title="Delete match" aria-label="Delete match" onClick={onDelete}>
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>
      {m.status === 'completed' && (m.outcome !== 'win' || m.finish || m.result) && (
        <div className="small muted">
          {m.outcome === 'draw' ? 'Draw' : m.outcome === 'no_contest' ? 'No Contest' : ''}
          {m.outcome !== 'win' && (m.finish || m.result) ? ' · ' : ''}
          {[m.finish, m.result].filter(Boolean).join(' · ')}
          {m.duration ? ` · ${m.duration}` : ''}
        </div>
      )}
      {!compact && (m.rivalryId || m.storylineId) && (
        <div className="small row wrap" style={{ gap: 12 }}>
          {m.rivalryId && d.rivalries.get(m.rivalryId) && (
            <Link className="link" to={`/rivalries/${m.rivalryId}`}>
              <Swords size={12} /> {d.rivalries.get(m.rivalryId)!.name}
            </Link>
          )}
          {m.storylineId && d.storylines.get(m.storylineId) && (
            <Link className="link" to={`/storylines/${m.storylineId}`}>
              <Award size={12} /> {d.storylines.get(m.storylineId)!.title}
            </Link>
          )}
        </div>
      )}
      {!compact && m.notes && <div className="small muted pre">{m.notes}</div>}
    </div>
  );
}

export function MatchList({ matches, focusId, empty, compact, limit }: { matches: Match[]; focusId?: string; empty?: ReactNode; compact?: boolean; limit?: number }) {
  if (!matches.length) return <>{empty ?? <Empty icon={<Swords size={20} />} title="No matches yet" />}</>;
  const shown = limit ? matches.slice(0, limit) : matches;
  return (
    <div>
      {shown.map((m) => (
        <MatchItem key={m.id} m={m} focusId={focusId} compact={compact} />
      ))}
    </div>
  );
}

export function ChampionCard({ c, d }: { c: Championship; d: Derived }) {
  const r = d.currentReign.get(c.id);
  const holderImage = r ? (r.holderType === 'team' ? d.teams.get(r.holderId)?.imageUrl : d.stars.get(r.holderId)?.imageUrl) : '';
  const name = r ? holderName(d, r) : 'Vacant';
  return (
    <Link to={`/championships/${c.id}`} className={`champ ${r ? '' : 'vacant'}`}>
      <div className="champ-inner">
        {r ? <Avatar name={name} src={holderImage} size={44} brand={c.brand} square={r.holderType === 'team'} /> : <span className="belt-icon"><Trophy size={20} /></span>}
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="title-name truncate">{c.name}</div>
          <div className="strong truncate">{name}</div>
          <div className="tiny muted">{r ? `${plural(reignDays(r, d.today), 'day')} · since ${formatDate(r.startDate)}` : 'Awaiting a new champion'}</div>
        </div>
      </div>
    </Link>
  );
}

export function StarCard({ s, d }: { s: Superstar; d: Derived }) {
  const rec = recordOf(d, s.id);
  const titles = d.heldTitles.get(s.id) ?? [];
  return (
    <Link to={`/superstars/${s.id}`} className="card hoverable star-card" style={{ ['--brand' as string]: brandInfo(s.brand).color }}>
      <div className="top">
        <Avatar name={s.ringName} src={s.imageUrl} size={54} brand={s.brand} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="strong truncate" style={{ fontSize: 15 }}>
            {s.ringName}
          </div>
          <div className="row wrap" style={{ gap: 4, marginTop: 4 }}>
            <BrandBadge brand={s.brand} />
            <AlignmentBadge alignment={s.alignment} />
            {s.status !== 'active' && <StatusBadge status={s.status} />}
          </div>
          {titles.length > 0 && (
            <div className="tiny truncate" style={{ color: 'var(--gold)', marginTop: 5 }}>
              <Trophy size={11} /> {titles.map((t) => t.name).join(', ')}
            </div>
          )}
        </div>
      </div>
      <div className="stats">
        <div>
          <div className="v">{rec.matches ? <RecordText rec={rec} /> : '—'}</div>
          <div className="k">W-L-D</div>
        </div>
        <div>
          <div className="v">{rec.matches ? `${Math.round(rec.winPct * 100)}%` : '—'}</div>
          <div className="k">Win %</div>
        </div>
        <div>
          <div className={`v ${rec.streak ? `streak-${rec.streak.type}` : ''}`}>{rec.streak ? `${rec.streak.type}${rec.streak.count}` : '—'}</div>
          <div className="k">Streak</div>
        </div>
        <div>
          <div className="v">{d.rank.get(s.id) ? `#${d.rank.get(s.id)}` : '—'}</div>
          <div className="k">Rank</div>
        </div>
      </div>
    </Link>
  );
}

export function FormRow({ id, d }: { id: string; d: Derived }) {
  return <Form form={recordOf(d, id).form} />;
}

export interface TimelineEntry {
  key: string;
  date: string;
  title: ReactNode;
  text?: ReactNode;
  kind?: 'event' | 'match' | 'planned' | 'transfer';
  actions?: ReactNode;
}

export function Timeline({ entries, empty }: { entries: TimelineEntry[]; empty?: ReactNode }) {
  if (!entries.length) return <>{empty ?? <Empty title="Nothing on the timeline yet" />}</>;
  return (
    <div className="timeline">
      {entries.map((e) => (
        <div key={e.key} className={`tl-item ${e.kind ?? 'event'}`}>
          <div className="row between">
            <div className="tl-date">{formatDate(e.date)}</div>
            {e.actions}
          </div>
          <div className="strong">{e.title}</div>
          {e.text && <div className="small muted pre">{e.text}</div>}
        </div>
      ))}
    </div>
  );
}

