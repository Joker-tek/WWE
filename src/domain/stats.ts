import { DIVISION_WEIGHT } from './constants';
import type { Championship, CompetitorRef, Match, MatchSide, Reign, Storyline, Rivalry, Superstar, TagTeam, Universe } from './schema';
import { chrono, daysBetween, realToday } from './util';

export type Res = 'W' | 'L' | 'D';

export interface CompetitorRecord {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winPct: number;
  streak: { type: Res; count: number } | null;
  longestWin: number;
  longestLoss: number;
  /** Newest first. */
  form: Res[];
  lastMatchDate: string;
  firstMatchDate: string;
}

export const EMPTY_RECORD: CompetitorRecord = {
  matches: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  winPct: 0,
  streak: null,
  longestWin: 0,
  longestLoss: 0,
  form: [],
  lastMatchDate: '',
  firstMatchDate: '',
};

/** Result for one side of a completed match. No contests count as draws. */
export function sideResult(m: Match, side: MatchSide): Res | null {
  if (m.status !== 'completed') return null;
  if (m.outcome !== 'win' || !m.winnerSideId) return 'D';
  return side.id === m.winnerSideId ? 'W' : 'L';
}

export function sideOfStar(m: Match, starId: string): MatchSide | undefined {
  return m.sides.find((s) => s.superstarIds.includes(starId));
}

export function sideOfTeam(m: Match, teamId: string): MatchSide | undefined {
  return m.sides.find((s) => s.teamId === teamId);
}

export function resultForStar(m: Match, starId: string): Res | null {
  const side = sideOfStar(m, starId);
  return side ? sideResult(m, side) : null;
}

export function resultForRef(m: Match, ref: CompetitorRef): Res | null {
  const side = ref.type === 'team' ? sideOfTeam(m, ref.id) : sideOfStar(m, ref.id);
  return side ? sideResult(m, side) : null;
}

export function summarize(results: Res[], dates: string[]): CompetitorRecord {
  if (!results.length) return { ...EMPTY_RECORD, form: [] };
  let wins = 0,
    losses = 0,
    draws = 0,
    longestWin = 0,
    longestLoss = 0,
    run = 0;
  let prev: Res | null = null;
  for (const r of results) {
    if (r === 'W') wins++;
    else if (r === 'L') losses++;
    else draws++;
    run = r === prev ? run + 1 : 1;
    prev = r;
    if (r === 'W') longestWin = Math.max(longestWin, run);
    if (r === 'L') longestLoss = Math.max(longestLoss, run);
  }
  const matches = results.length;
  return {
    matches,
    wins,
    losses,
    draws,
    winPct: matches ? wins / matches : 0,
    streak: prev ? { type: prev, count: run } : null,
    longestWin,
    longestLoss,
    form: results.slice(-5).reverse(),
    lastMatchDate: dates[dates.length - 1] ?? '',
    firstMatchDate: dates[0] ?? '',
  };
}

/**
 * Build records for every competitor appearing in the given matches.
 * `matches` must be completed matches in chronological order.
 */
export function buildRecords(matches: Match[], mode: 'superstar' | 'team'): Map<string, CompetitorRecord> {
  const seq = new Map<string, { r: Res[]; d: string[] }>();
  for (const m of matches) {
    for (const side of m.sides) {
      const res = sideResult(m, side);
      if (!res) continue;
      const keys = mode === 'superstar' ? side.superstarIds : side.teamId ? [side.teamId] : [];
      for (const k of keys) {
        let e = seq.get(k);
        if (!e) seq.set(k, (e = { r: [], d: [] }));
        e.r.push(res);
        e.d.push(m.date);
      }
    }
  }
  const out = new Map<string, CompetitorRecord>();
  for (const [k, e] of seq) out.set(k, summarize(e.r, e.d));
  return out;
}

export function headToHead(matches: Match[], a: CompetitorRef, b: CompetitorRef) {
  const shared = matches.filter((m) => {
    const sa = a.type === 'team' ? sideOfTeam(m, a.id) : sideOfStar(m, a.id);
    const sb = b.type === 'team' ? sideOfTeam(m, b.id) : sideOfStar(m, b.id);
    return m.status === 'completed' && sa && sb && sa.id !== sb.id;
  });
  let aWins = 0,
    bWins = 0,
    draws = 0,
    other = 0;
  for (const m of shared) {
    const ra = resultForRef(m, a);
    const rb = resultForRef(m, b);
    if (ra === 'W') aWins++;
    else if (rb === 'W') bWins++;
    else if (ra === 'D') draws++;
    else other++; // a third party won a multi-person match
  }
  return { matches: shared, aWins, bWins, draws, other };
}

// ---------------------------------------------------------------------------
// Derived state: computed once per data change and cached by reference.
// ---------------------------------------------------------------------------

export interface Derived {
  today: string;
  stars: Map<string, Superstar>;
  teams: Map<string, TagTeam>;
  titles: Map<string, Championship>;
  rivalries: Map<string, Rivalry>;
  storylines: Map<string, Storyline>;
  matchById: Map<string, Match>;
  /** Completed matches, oldest first. */
  completed: Match[];
  /** Scheduled matches, soonest first. */
  scheduled: Match[];
  starRecords: Map<string, CompetitorRecord>;
  teamRecords: Map<string, CompetitorRecord>;
  currentReign: Map<string, Reign>;
  /** Titles currently held by a superstar (including tag titles via their team) or by a team. */
  heldTitles: Map<string, Championship[]>;
  reignsOfStar: Map<string, Reign[]>;
  reignsOfTeam: Map<string, Reign[]>;
  power: Map<string, number>;
  /** Rank among active superstars of the same gender (1 = best). */
  rank: Map<string, number>;
  teamPower: Map<string, number>;
  teamsOfStar: Map<string, TagTeam[]>;
}

export function universeToday(u: Universe): string {
  return u.settings.dateMode === 'custom' ? u.settings.customDate : realToday();
}

export function recordOf(d: Derived, id: string, type: 'superstar' | 'team' = 'superstar'): CompetitorRecord {
  return (type === 'team' ? d.teamRecords : d.starRecords).get(id) ?? EMPTY_RECORD;
}

const TITLE_WEIGHT = { world: 16, secondary: 9, tertiary: 6, other: 4 };

export function starPower(s: Superstar, rec: CompetitorRecord, titles: Championship[]): number {
  const shrunkPct = (rec.wins + 2.5) / (rec.matches + 5); // Bayesian shrink toward 50%
  const formScore = rec.form.reduce((acc, r, i) => acc + (r === 'W' ? 2 : r === 'L' ? -1.5 : 0) * (1 - i * 0.12), 0);
  let streak = 0;
  if (rec.streak?.type === 'W') streak = Math.min(rec.streak.count, 8) * 1.4;
  if (rec.streak?.type === 'L') streak = -Math.min(rec.streak.count, 8) * 1;
  const gold = titles.reduce((acc, t) => acc + (t.type === 'tag' ? 5 : TITLE_WEIGHT[t.tier]), 0);
  const score = s.popularity * 0.35 + DIVISION_WEIGHT[s.division] * 5 + shrunkPct * 25 + formScore + streak + gold;
  return Math.round(score * 10) / 10;
}

let cache: { data: Universe; today: string; derived: Derived } | null = null;

export function getDerived(u: Universe): Derived {
  const today = universeToday(u);
  if (cache && cache.data === u && cache.today === today) return cache.derived;
  const derived = computeDerived(u, today);
  cache = { data: u, today, derived };
  return derived;
}

export function computeDerived(u: Universe, today: string): Derived {
  const stars = new Map(u.superstars.map((s) => [s.id, s]));
  const teams = new Map(u.tagTeams.map((t) => [t.id, t]));
  const titles = new Map(u.championships.map((c) => [c.id, c]));
  const completed = u.matches.filter((m) => m.status === 'completed').sort(chrono);
  const scheduled = u.matches.filter((m) => m.status === 'scheduled').sort(chrono);

  const currentReign = new Map<string, Reign>();
  for (const r of u.reigns) {
    if (r.endDate !== null) continue;
    const prev = currentReign.get(r.championshipId);
    if (!prev || prev.startDate < r.startDate) currentReign.set(r.championshipId, r);
  }
  const heldTitles = new Map<string, Championship[]>();
  const pushHeld = (k: string, c: Championship) => {
    const arr = heldTitles.get(k) ?? [];
    if (!arr.includes(c)) arr.push(c);
    heldTitles.set(k, arr);
  };
  for (const r of currentReign.values()) {
    const c = titles.get(r.championshipId);
    if (!c) continue;
    pushHeld(r.holderId, c);
    if (r.holderType === 'team') for (const m of r.memberIds) pushHeld(m, c);
  }
  const reignsOfStar = new Map<string, Reign[]>();
  const reignsOfTeam = new Map<string, Reign[]>();
  for (const r of [...u.reigns].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    const ids = r.holderType === 'team' ? r.memberIds : [r.holderId];
    for (const sid of ids) reignsOfStar.set(sid, [...(reignsOfStar.get(sid) ?? []), r]);
    if (r.holderType === 'team') reignsOfTeam.set(r.holderId, [...(reignsOfTeam.get(r.holderId) ?? []), r]);
  }

  const starRecords = buildRecords(completed, 'superstar');
  const teamRecords = buildRecords(completed, 'team');

  const power = new Map<string, number>();
  for (const s of u.superstars) {
    power.set(s.id, starPower(s, starRecords.get(s.id) ?? EMPTY_RECORD, heldTitles.get(s.id) ?? []));
  }
  const rank = new Map<string, number>();
  for (const g of ['male', 'female'] as const) {
    u.superstars
      .filter((s) => s.gender === g && s.status === 'active')
      .sort((a, b) => (power.get(b.id) ?? 0) - (power.get(a.id) ?? 0))
      .forEach((s, i) => rank.set(s.id, i + 1));
  }
  const teamPower = new Map<string, number>();
  const teamsOfStar = new Map<string, TagTeam[]>();
  for (const t of u.tagTeams) {
    for (const m of t.memberIds) teamsOfStar.set(m, [...(teamsOfStar.get(m) ?? []), t]);
    const rec = teamRecords.get(t.id) ?? EMPTY_RECORD;
    const members = t.memberIds.map((m) => power.get(m) ?? 0);
    const avg = members.length ? members.reduce((a, b) => a + b, 0) / members.length : 0;
    const gold = (heldTitles.get(t.id) ?? []).length * 8;
    const shrunk = (rec.wins + 2.5) / (rec.matches + 5);
    teamPower.set(t.id, Math.round((avg * 0.6 + shrunk * 30 + gold) * 10) / 10);
  }

  return {
    today,
    stars,
    teams,
    titles,
    rivalries: new Map(u.rivalries.map((r) => [r.id, r])),
    storylines: new Map(u.storylines.map((s) => [s.id, s])),
    matchById: new Map(u.matches.map((m) => [m.id, m])),
    completed,
    scheduled,
    starRecords,
    teamRecords,
    currentReign,
    heldTitles,
    reignsOfStar,
    reignsOfTeam,
    power,
    rank,
    teamPower,
    teamsOfStar,
  };
}

// ---------------------------------------------------------------------------
// Naming helpers
// ---------------------------------------------------------------------------

export function starName(d: Derived, id: string): string {
  return d.stars.get(id)?.ringName ?? 'Unknown superstar';
}

export function refName(d: Derived, ref: CompetitorRef): string {
  return ref.type === 'team' ? (d.teams.get(ref.id)?.name ?? 'Unknown team') : starName(d, ref.id);
}

export function sideLabel(d: Derived, side: MatchSide): string {
  const names = side.superstarIds.map((id) => starName(d, id)).join(' & ');
  if (side.teamId) {
    const t = d.teams.get(side.teamId);
    if (t) return side.superstarIds.length ? `${t.name} (${names})` : t.name;
  }
  return names;
}

export function shortSideLabel(d: Derived, side: MatchSide): string {
  if (side.teamId && d.teams.get(side.teamId)) return d.teams.get(side.teamId)!.name;
  return side.superstarIds.map((id) => starName(d, id)).join(' & ');
}

export function reignDays(r: Reign, today: string): number {
  return Math.max(0, daysBetween(r.startDate, r.endDate ?? today));
}

export function holderName(d: Derived, r: Reign): string {
  return refName(d, { type: r.holderType, id: r.holderId });
}

/** Successful title defenses during a reign (completed matches with the title at stake that the holder didn't lose). */
export function reignDefenses(d: Derived, r: Reign): number {
  return d.completed.filter((m) => {
    if (!m.championshipIds.includes(r.championshipId)) return false;
    if (m.id === r.wonAtMatchId || m.id === r.lostAtMatchId) return false;
    if (m.date < r.startDate || (r.endDate && m.date > r.endDate)) return false;
    const side = r.holderType === 'team' ? sideOfTeam(m, r.holderId) : sideOfStar(m, r.holderId);
    return !!side;
  }).length;
}

export function matchesOfStar(d: Derived, id: string, includeScheduled = false): Match[] {
  const src = includeScheduled ? [...d.completed, ...d.scheduled] : d.completed;
  return src.filter((m) => m.sides.some((s) => s.superstarIds.includes(id)));
}

export function matchesOfTeam(d: Derived, id: string): Match[] {
  return d.completed.filter((m) => m.sides.some((s) => s.teamId === id));
}

export function refMembers(d: Derived, ref: CompetitorRef): string[] {
  return ref.type === 'team' ? (d.teams.get(ref.id)?.memberIds ?? []) : [ref.id];
}

/** Matches where at least two rivalry participants were on opposing sides, or linked explicitly. */
export function rivalryMatches(d: Derived, r: Rivalry): Match[] {
  return [...d.completed, ...d.scheduled].filter((m) => {
    if (m.rivalryId === r.id) return true;
    const sidesHit = new Set<string>();
    for (const p of r.participants) {
      const side = p.type === 'team' ? sideOfTeam(m, p.id) : sideOfStar(m, p.id);
      if (side) sidesHit.add(side.id);
    }
    return sidesHit.size >= 2;
  });
}
