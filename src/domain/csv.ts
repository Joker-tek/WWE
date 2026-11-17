import { ALIGNMENT_LABEL, DIVISION_LABEL, STATUS_LABEL, brandLabel, matchTypeLabel } from './constants';
import type { Universe } from './schema';
import { type Derived, holderName, recordOf, reignDays, reignDefenses, sideLabel, sideResult } from './stats';

function cell(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

export function superstarsCsv(u: Universe, d: Derived): string {
  return toCsv(
    ['Ring name', 'Real name', 'Brand', 'Gender', 'Division', 'Alignment', 'Status', 'Popularity', 'Power rank', 'Matches', 'Wins', 'Losses', 'Draws', 'Win %', 'Current streak', 'Longest win streak', 'Longest losing streak', 'Title reigns', 'Current titles'],
    u.superstars.map((s) => {
      const r = recordOf(d, s.id);
      return [
        s.ringName,
        s.realName,
        brandLabel(s.brand),
        s.gender === 'male' ? 'Male' : 'Female',
        DIVISION_LABEL[s.division],
        ALIGNMENT_LABEL[s.alignment],
        STATUS_LABEL[s.status],
        s.popularity,
        d.rank.get(s.id) ?? '',
        r.matches,
        r.wins,
        r.losses,
        r.draws,
        r.matches ? (r.winPct * 100).toFixed(1) : '',
        r.streak ? `${r.streak.type}${r.streak.count}` : '',
        r.longestWin,
        r.longestLoss,
        (d.reignsOfStar.get(s.id) ?? []).length,
        (d.heldTitles.get(s.id) ?? []).map((t) => t.name).join('; '),
      ];
    }),
  );
}

export function matchesCsv(u: Universe, d: Derived): string {
  const sorted = [...u.matches].sort((a, b) => a.date.localeCompare(b.date));
  return toCsv(
    ['Date', 'Status', 'Brand', 'Event', 'Match type', 'Participants', 'Winner', 'Outcome', 'Finish', 'Result', 'Championships', 'Title changed', 'Rivalry', 'Storyline', 'Rating', 'Notes'],
    sorted.map((m) => {
      const winner = m.sides.find((s) => sideResult(m, s) === 'W');
      return [
        m.date,
        m.status,
        brandLabel(m.brand, 'event'),
        m.eventName,
        matchTypeLabel(m.matchType),
        m.sides.map((s) => sideLabel(d, s)).join(' vs. '),
        winner ? sideLabel(d, winner) : '',
        m.status === 'completed' ? m.outcome : '',
        m.finish,
        m.result,
        m.championshipIds.map((c) => d.titles.get(c)?.name ?? '').join('; '),
        m.titleChanged ? 'yes' : '',
        m.rivalryId ? (d.rivalries.get(m.rivalryId)?.name ?? '') : '',
        m.storylineId ? (d.storylines.get(m.storylineId)?.title ?? '') : '',
        m.rating ?? '',
        m.notes,
      ];
    }),
  );
}

export function reignsCsv(u: Universe, d: Derived): string {
  const sorted = [...u.reigns].sort((a, b) => a.championshipId.localeCompare(b.championshipId) || a.startDate.localeCompare(b.startDate));
  return toCsv(
    ['Championship', 'Champion', 'Won', 'Lost', 'Days', 'Defenses', 'Notes'],
    sorted.map((r) => [d.titles.get(r.championshipId)?.name ?? '', holderName(d, r), r.startDate, r.endDate ?? 'Current', reignDays(r, d.today), reignDefenses(d, r), r.notes]),
  );
}

export function teamsCsv(u: Universe, d: Derived): string {
  return toCsv(
    ['Team', 'Brand', 'Gender', 'Status', 'Members', 'Matches', 'Wins', 'Losses', 'Draws', 'Win %', 'Title reigns'],
    u.tagTeams.map((t) => {
      const r = recordOf(d, t.id, 'team');
      return [
        t.name,
        brandLabel(t.brand),
        t.gender === 'male' ? 'Male' : 'Female',
        t.status,
        t.memberIds.map((m) => d.stars.get(m)?.ringName ?? '').join(' & '),
        r.matches,
        r.wins,
        r.losses,
        r.draws,
        r.matches ? (r.winPct * 100).toFixed(1) : '',
        (d.reignsOfTeam.get(t.id) ?? []).length,
      ];
    }),
  );
}
