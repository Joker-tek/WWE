import { ALIGNMENT_LABEL, DIVISION_LABEL, DIVISION_WEIGHT, matchTypeLabel } from './constants';
import type { BrandKey, Championship, CompetitorRef, Gender, Match, Rivalry, Storyline, Superstar, TagTeam, Universe } from './schema';
import { type Derived, recordOf, refMembers, refName, rivalryMatches, sideOfStar, sideOfTeam, reignDays, holderName } from './stats';
import { addDays, daysBetween, formatDate } from './util';

/**
 * Rule-based matchmaking assistant. Every suggestion comes with the reasons behind it.
 * Nothing here writes data: suggestions are only booked when the user approves them.
 */

export interface BookingDraft {
  brand: BrandKey;
  matchType: string;
  sides: { teamId?: string; superstarIds: string[] }[];
  championshipIds: string[];
  rivalryId?: string;
  storylineId?: string;
}

export interface Suggestion {
  key: string;
  kind: 'singles' | 'tag' | 'title' | 'rivalry' | 'development';
  title: string;
  subtitle?: string;
  score: number;
  reasons: string[];
  cautions: string[];
  brand: BrandKey;
  booking?: BookingDraft;
  rivalryDraft?: { name: string; brand: BrandKey; participants: CompetitorRef[] };
  link?: string;
}

export interface MatchmakerOptions {
  brand: BrandKey | 'all';
  gender: Gender | 'all';
}

export interface MatchmakerResult {
  singles: Suggestion[];
  tag: Suggestion[];
  title: Suggestion[];
  rivalries: Suggestion[];
  developments: Suggestion[];
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

interface PairHistory {
  count: number;
  lastDate: string;
  wins: Record<string, number>;
  lastWinner?: string;
}

class Context {
  readonly today: string;
  readonly since30: string;
  readonly pairs = new Map<string, PairHistory>();
  readonly recent30 = new Map<string, number>();
  readonly booked = new Map<string, string>();
  readonly rivalryOfPair = new Map<string, Rivalry>();
  readonly storylineOfPair = new Map<string, Storyline>();

  constructor(
    readonly u: Universe,
    readonly d: Derived,
  ) {
    this.today = d.today;
    this.since30 = addDays(d.today, -30);
    for (const m of d.completed) this.indexMatch(m);
    for (const m of d.scheduled) {
      for (const s of m.sides) {
        for (const id of s.superstarIds) if (!this.booked.has(id)) this.booked.set(id, m.date);
        if (s.teamId && !this.booked.has(s.teamId)) this.booked.set(s.teamId, m.date);
      }
    }
    for (const r of u.rivalries) {
      if (r.status !== 'active' && r.status !== 'paused') continue;
      const ids = r.participants.flatMap((p) => [p.id, ...refMembers(d, p)]);
      for (const a of ids) for (const b of ids) if (a < b) this.setPrefer(this.rivalryOfPair, pairKey(a, b), r, (x) => x.status === 'active');
    }
    for (const s of u.storylines) {
      if (s.status !== 'active') continue;
      const ids = [...s.superstarIds, ...s.teamIds, ...s.teamIds.flatMap((t) => d.teams.get(t)?.memberIds ?? [])];
      for (const a of ids) for (const b of ids) if (a < b) this.storylineOfPair.set(pairKey(a, b), s);
    }
  }

  private setPrefer<T>(map: Map<string, T>, k: string, v: T, better: (x: T) => boolean) {
    const cur = map.get(k);
    if (!cur || (!better(cur) && better(v))) map.set(k, v);
  }

  private indexMatch(m: Match) {
    const recentMatch = m.date >= this.since30;
    const winner = m.sides.find((s) => s.id === m.winnerSideId);
    for (const side of m.sides) {
      const ids = [...side.superstarIds, ...(side.teamId ? [side.teamId] : [])];
      if (recentMatch) for (const id of ids) this.recent30.set(id, (this.recent30.get(id) ?? 0) + 1);
    }
    for (let i = 0; i < m.sides.length; i++) {
      for (let j = i + 1; j < m.sides.length; j++) {
        const A = [...m.sides[i].superstarIds, ...(m.sides[i].teamId ? [m.sides[i].teamId!] : [])];
        const B = [...m.sides[j].superstarIds, ...(m.sides[j].teamId ? [m.sides[j].teamId!] : [])];
        for (const a of A) {
          for (const b of B) {
            const k = pairKey(a, b);
            const h = this.pairs.get(k) ?? { count: 0, lastDate: '', wins: {} };
            h.count++;
            h.lastDate = m.date;
            h.lastWinner = undefined;
            if (winner === m.sides[i]) (h.wins[a] = (h.wins[a] ?? 0) + 1), (h.lastWinner = a);
            if (winner === m.sides[j]) (h.wins[b] = (h.wins[b] ?? 0) + 1), (h.lastWinner = b);
            this.pairs.set(k, h);
          }
        }
      }
    }
  }

  name(id: string) {
    return this.d.stars.get(id)?.ringName ?? this.d.teams.get(id)?.name ?? 'Unknown';
  }

  streakText(id: string, type: 'superstar' | 'team' = 'superstar') {
    const s = recordOf(this.d, id, type).streak;
    return s ? `${s.type}${s.count}` : '';
  }
}

function brandOk(brand: BrandKey, opts: MatchmakerOptions) {
  return opts.brand === 'all' || brand === opts.brand;
}

function eligibleStars(c: Context, opts: MatchmakerOptions): Superstar[] {
  return c.u.superstars.filter(
    (s) => s.status === 'active' && s.brand !== 'none' && brandOk(s.brand, opts) && (opts.gender === 'all' || s.gender === opts.gender),
  );
}

function eligibleTeams(c: Context, opts: MatchmakerOptions): TagTeam[] {
  return c.u.tagTeams.filter(
    (t) =>
      t.status === 'active' &&
      t.brand !== 'none' &&
      t.memberIds.length >= 2 &&
      t.memberIds.every((m) => c.d.stars.get(m)?.status === 'active') &&
      brandOk(t.brand, opts) &&
      (opts.gender === 'all' || t.gender === opts.gender),
  );
}

/** Shared scoring for any two competitors (superstars or teams). */
function scorePair(c: Context, a: string, b: string, kind: 'superstar' | 'team') {
  const reasons: string[] = [];
  const cautions: string[] = [];
  let score = 0;
  const k = pairKey(a, b);
  const nA = c.name(a);
  const nB = c.name(b);

  const rivalry = c.rivalryOfPair.get(k);
  if (rivalry?.status === 'active') {
    score += 25 + rivalry.intensity * 3;
    reasons.push(`Active rivalry “${rivalry.name}” (intensity ${rivalry.intensity}/10)`);
  } else if (rivalry?.status === 'paused') {
    score += 6;
    reasons.push(`Could reignite their paused rivalry “${rivalry.name}”`);
  }
  const story = c.storylineOfPair.get(k);
  if (story) {
    score += 12;
    reasons.push(`Both are part of the storyline “${story.title}”`);
  }

  if (kind === 'superstar') {
    const sa = c.d.stars.get(a)!;
    const sb = c.d.stars.get(b)!;
    const ra = c.d.rank.get(a) ?? 99;
    const rb = c.d.rank.get(b) ?? 99;
    const diff = Math.abs(ra - rb);
    if (diff <= 3) (score += 12), reasons.push(`Closely ranked (#${ra} vs #${rb})`);
    else if (diff <= 8) score += 6;
    else if (diff > 15) (score -= 8), cautions.push(`Big gap in standing (#${ra} vs #${rb}): works as a squash or an upset angle`);
    const avgPop = (sa.popularity + sb.popularity) / 2;
    score += (avgPop - 50) / 5;
    if (avgPop >= 75) reasons.push(`Two very popular stars (avg popularity ${Math.round(avgPop)})`);
    if ((sa.alignment === 'face' && sb.alignment === 'heel') || (sa.alignment === 'heel' && sb.alignment === 'face')) {
      score += 8;
      reasons.push('Classic face vs. heel dynamic');
    } else if (sa.alignment === sb.alignment && sa.alignment !== 'tweener') {
      score -= 4;
      cautions.push(`Both are ${ALIGNMENT_LABEL[sa.alignment].toLowerCase()}s`);
    }
    if (sa.division === sb.division && sa.division !== 'tag_specialist') {
      score += 4;
      reasons.push(`Both in the ${DIVISION_LABEL[sa.division]} division`);
    } else if (Math.abs(DIVISION_WEIGHT[sa.division] - DIVISION_WEIGHT[sb.division]) >= 2) {
      score -= 4;
      cautions.push(`Different card positions (${DIVISION_LABEL[sa.division]} vs ${DIVISION_LABEL[sb.division]})`);
    }
  } else {
    const pa = c.d.teamPower.get(a) ?? 0;
    const pb = c.d.teamPower.get(b) ?? 0;
    if (Math.abs(pa - pb) <= 6) (score += 10), reasons.push('Evenly matched teams by power rating');
  }

  const recA = recordOf(c.d, a, kind);
  const recB = recordOf(c.d, b, kind);
  if (recA.streak?.type === 'W' && recA.streak.count >= 3 && recB.streak?.type === 'W' && recB.streak.count >= 3) {
    score += 8;
    reasons.push(`Both on winning streaks (${c.streakText(a, kind)} / ${c.streakText(b, kind)}): something has to give`);
  }
  for (const [id, rec, n] of [
    [a, recA, nA],
    [b, recB, nB],
  ] as const) {
    if (rec.streak?.type === 'L' && rec.streak.count >= 3) {
      score += 3;
      reasons.push(`${n} needs a rebound after ${c.streakText(id, kind)}`);
    }
  }

  const h = c.pairs.get(k);
  if (!h) {
    score += 10;
    reasons.push("Fresh matchup: they've never faced each other");
  } else {
    const wa = h.wins[a] ?? 0;
    const wb = h.wins[b] ?? 0;
    if (h.count >= 2) reasons.push(`Head-to-head: ${nA} ${wa}–${wb} ${nB}`);
    const since = daysBetween(h.lastDate, c.today);
    if (since <= 14 && rivalry?.status !== 'active') {
      score -= 15;
      cautions.push(`They just met on ${formatDate(h.lastDate)}`);
    } else if (h.count >= 5 && rivalry?.status !== 'active') {
      score -= 6;
      cautions.push(`Already met ${h.count} times`);
    }
  }

  for (const [id, n] of [
    [a, nA],
    [b, nB],
  ] as const) {
    const bookedOn = c.booked.get(id);
    if (bookedOn) {
      score -= 12;
      cautions.push(`${n} is already booked (${formatDate(bookedOn)})`);
    }
    const recent = c.recent30.get(id) ?? 0;
    if (recent === 0) {
      score += 5;
      reasons.push(`${n} hasn't wrestled in 30+ days`);
    } else if (recent >= 6) {
      score -= 4;
      cautions.push(`${n} has wrestled ${recent} times in the last 30 days`);
    }
  }

  for (const [id, n] of [
    [a, nA],
    [b, nB],
  ] as const) {
    const held = (c.d.heldTitles.get(id) ?? []).filter((t) => (kind === 'team' ? t.type === 'tag' : t.type === 'singles'));
    if (held.length) {
      score += 3;
      reasons.push(`${n} is the ${held[0].name} holder: a non-title win could build a challenger`);
    }
  }
  return { score: Math.round(score), reasons, cautions, rivalry, story };
}

/** Pick the best suggestions while limiting how often one competitor appears. */
function diverse(list: (Suggestion & { ids: string[] })[], limit: number, perId = 2): Suggestion[] {
  const used = new Map<string, number>();
  const out: Suggestion[] = [];
  for (const s of list.sort((x, y) => y.score - x.score)) {
    if (s.ids.some((id) => (used.get(id) ?? 0) >= perId)) continue;
    s.ids.forEach((id) => used.set(id, (used.get(id) ?? 0) + 1));
    const { ids: _ids, ...rest } = s;
    void _ids;
    out.push(rest);
    if (out.length >= limit) break;
  }
  return out;
}

function singles(c: Context, opts: MatchmakerOptions): Suggestion[] {
  const stars = eligibleStars(c, opts);
  const list: (Suggestion & { ids: string[] })[] = [];
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      const a = stars[i];
      const b = stars[j];
      if (a.brand !== b.brand || a.gender !== b.gender) continue;
      const p = scorePair(c, a.id, b.id, 'superstar');
      list.push({
        key: `s:${pairKey(a.id, b.id)}`,
        ids: [a.id, b.id],
        kind: 'singles',
        title: `${a.ringName} vs. ${b.ringName}`,
        score: p.score,
        reasons: p.reasons,
        cautions: p.cautions,
        brand: a.brand,
        booking: {
          brand: a.brand,
          matchType: 'singles',
          sides: [{ superstarIds: [a.id] }, { superstarIds: [b.id] }],
          championshipIds: [],
          rivalryId: p.rivalry?.status === 'active' ? p.rivalry.id : undefined,
          storylineId: p.story?.id,
        },
      });
    }
  }
  return diverse(list, 8);
}

function tagMatches(c: Context, opts: MatchmakerOptions): Suggestion[] {
  const teams = eligibleTeams(c, opts);
  const list: (Suggestion & { ids: string[] })[] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const a = teams[i];
      const b = teams[j];
      if (a.brand !== b.brand || a.gender !== b.gender) continue;
      if (a.memberIds.some((m) => b.memberIds.includes(m))) continue;
      const p = scorePair(c, a.id, b.id, 'team');
      list.push({
        key: `t:${pairKey(a.id, b.id)}`,
        ids: [a.id, b.id],
        kind: 'tag',
        title: `${a.name} vs. ${b.name}`,
        score: p.score,
        reasons: p.reasons,
        cautions: p.cautions,
        brand: a.brand,
        booking: {
          brand: a.brand,
          matchType: 'tag',
          sides: [
            { teamId: a.id, superstarIds: [...a.memberIds].slice(0, 2) },
            { teamId: b.id, superstarIds: [...b.memberIds].slice(0, 2) },
          ],
          championshipIds: [],
          rivalryId: p.rivalry?.status === 'active' ? p.rivalry.id : undefined,
          storylineId: p.story?.id,
        },
      });
    }
  }
  return diverse(list, 6);
}

function lastDefense(c: Context, title: Championship, sinceDate: string): string {
  const m = [...c.d.completed].reverse().find((x) => x.championshipIds.includes(title.id) && x.date >= sinceDate);
  return m?.date ?? sinceDate;
}

function titleMatches(c: Context, opts: MatchmakerOptions): Suggestion[] {
  const out: Suggestion[] = [];
  for (const title of c.u.championships) {
    if (!title.active || !brandOk(title.brand, opts) || (opts.gender !== 'all' && title.gender !== opts.gender)) continue;
    const reign = c.d.currentReign.get(title.id);
    const brandFits = (b: BrandKey) => title.brand === 'none' || b === title.brand;
    const reasons: string[] = [];
    const cautions: string[] = [];

    if (reign) {
      const days = reignDays(reign, c.today);
      const lastDef = lastDefense(c, title, reign.startDate);
      const idle = daysBetween(lastDef, c.today);
      reasons.push(`${holderName(c.d, reign)} has held the title for ${days} days`);
      if (idle >= 30) reasons.push(`No title defense in ${idle} days`);
    } else {
      reasons.push('The title is vacant: crown a new champion');
    }

    type Cand = { id: string; score: number; why: string[]; members: string[]; teamId?: string };
    let cands: Cand[] = [];
    if (title.type === 'singles') {
      const holderIds = reign ? reign.memberIds : [];
      cands = c.u.superstars
        .filter((s) => s.status === 'active' && s.gender === title.gender && brandFits(s.brand) && !holderIds.includes(s.id))
        .map((s) => ({ id: s.id, score: c.d.power.get(s.id) ?? 0, why: [] as string[], members: [s.id] }));
    } else {
      cands = c.u.tagTeams
        .filter(
          (t) =>
            t.status === 'active' &&
            t.gender === title.gender &&
            brandFits(t.brand) &&
            t.memberIds.length >= 2 &&
            t.id !== reign?.holderId &&
            t.memberIds.every((m) => c.d.stars.get(m)?.status === 'active'),
        )
        .map((t) => ({ id: t.id, score: c.d.teamPower.get(t.id) ?? 0, why: [] as string[], members: t.memberIds.slice(0, 2), teamId: t.id }));
    }
    const kind = title.type === 'tag' ? 'team' : 'superstar';
    for (const cand of cands) {
      const rec = recordOf(c.d, cand.id, kind);
      if (rec.streak?.type === 'W' && rec.streak.count >= 2) {
        cand.score += rec.streak.count * 3;
        cand.why.push(`On a ${rec.streak.count}-match winning streak`);
      }
      if (reign) {
        const k = pairKey(cand.id, reign.holderId);
        const riv = c.rivalryOfPair.get(k);
        if (riv?.status === 'active') {
          cand.score += 20;
          cand.why.push(`Feuding with the champion (“${riv.name}”)`);
        }
        const h = c.pairs.get(k);
        if (h?.lastWinner === cand.id) {
          cand.score += 10;
          cand.why.push(`Beat the champion in their last meeting (${formatDate(h.lastDate)})`);
        }
        const lostShot = [...c.d.completed]
          .reverse()
          .find((m) => m.championshipIds.includes(title.id) && m.date >= addDays(c.today, -30) && (kind === 'team' ? sideOfTeam(m, cand.id) : sideOfStar(m, cand.id)));
        if (lostShot) {
          cand.score -= 12;
          cand.why.push(`Already had a title shot on ${formatDate(lostShot.date)}`);
        }
      }
      if (c.booked.has(cand.id)) {
        cand.score -= 8;
        cand.why.push('Already booked on an upcoming show');
      }
      if (kind === 'superstar') {
        const r = c.d.rank.get(cand.id);
        if (r) cand.why.unshift(`#${r} in the ${title.gender === 'male' ? "men's" : "women's"} power rankings`);
      }
    }
    cands.sort((a, b) => b.score - a.score);
    if (!cands.length) continue;
    const top = cands[0];
    const others = cands.slice(1, 4).map((x) => c.name(x.id));
    const sides: BookingDraft['sides'] = [];
    if (reign) {
      sides.push({ teamId: reign.holderType === 'team' ? reign.holderId : undefined, superstarIds: [...reign.memberIds] });
      sides.push({ teamId: top.teamId, superstarIds: top.members });
    } else {
      const second = cands[1];
      sides.push({ teamId: top.teamId, superstarIds: top.members });
      if (second) sides.push({ teamId: second.teamId, superstarIds: second.members });
    }
    if (sides.length < 2) continue;
    const challengerName = c.name(top.id);
    const titleText = reign
      ? `${holderName(c.d, reign)} (c) vs. ${challengerName}`
      : `${challengerName} vs. ${c.name(cands[1].id)}`;
    const rivalry = reign ? c.rivalryOfPair.get(pairKey(top.id, reign.holderId)) : undefined;
    out.push({
      key: `c:${title.id}:${top.id}`,
      kind: 'title',
      title: titleText,
      subtitle: title.name,
      score: Math.round(top.score),
      reasons: [...reasons, ...top.why.map((w) => `${challengerName}: ${w}`)],
      cautions: others.length ? [`Other contenders: ${others.join(', ')}`] : [],
      brand: title.brand,
      booking: {
        brand: title.brand,
        matchType: title.type === 'tag' ? 'tag' : 'singles',
        sides,
        championshipIds: [title.id],
        rivalryId: rivalry?.status === 'active' ? rivalry.id : undefined,
      },
    });
    void cautions;
  }
  return out.sort((a, b) => b.score - a.score);
}

function newRivalries(c: Context, opts: MatchmakerOptions): Suggestion[] {
  const stars = eligibleStars(c, opts);
  const list: (Suggestion & { ids: string[] })[] = [];
  // Contenders for each singles title, to spot two stars chasing the same gold.
  const chasing = new Map<string, string>();
  for (const t of c.u.championships.filter((x) => x.active && x.type === 'singles')) {
    const holder = c.d.currentReign.get(t.id)?.holderId;
    stars
      .filter((s) => s.gender === t.gender && (t.brand === 'none' || s.brand === t.brand) && s.id !== holder)
      .sort((a, b) => (c.d.power.get(b.id) ?? 0) - (c.d.power.get(a.id) ?? 0))
      .slice(0, 3)
      .forEach((s) => chasing.set(s.id, t.name));
  }
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      const a = stars[i];
      const b = stars[j];
      if (a.brand !== b.brand || a.gender !== b.gender) continue;
      const k = pairKey(a.id, b.id);
      if (c.rivalryOfPair.get(k)?.status === 'active') continue;
      const reasons: string[] = [];
      let score = 0;
      const ra = c.d.rank.get(a.id) ?? 99;
      const rb = c.d.rank.get(b.id) ?? 99;
      if (Math.abs(ra - rb) <= 5) (score += 10), reasons.push(`Similar standing (#${ra} vs #${rb})`);
      const opposite = (a.alignment === 'face' && b.alignment === 'heel') || (a.alignment === 'heel' && b.alignment === 'face');
      if (opposite) (score += 10), reasons.push(`${ALIGNMENT_LABEL[a.alignment]} vs. ${ALIGNMENT_LABEL[b.alignment]}`);
      const h = c.pairs.get(k);
      if (h && daysBetween(h.lastDate, c.today) <= 30) {
        score += 12;
        const loser = h.lastWinner === a.id ? b : h.lastWinner === b.id ? a : null;
        reasons.push(
          loser
            ? `Met on ${formatDate(h.lastDate)}; ${loser.ringName} will want revenge`
            : `Met recently (${formatDate(h.lastDate)}) without a clear winner`,
        );
      }
      if (h && h.count >= 2) {
        const wa = h.wins[a.id] ?? 0;
        const wb = h.wins[b.id] ?? 0;
        if (Math.abs(wa - wb) <= 1) (score += 8), reasons.push(`Evenly matched head-to-head (${wa}–${wb})`);
      }
      const ca = chasing.get(a.id);
      if (ca && ca === chasing.get(b.id)) (score += 10), reasons.push(`Both chasing the ${ca}`);
      const heldA = c.d.heldTitles.get(a.id)?.find((t) => t.type === 'singles');
      const heldB = c.d.heldTitles.get(b.id)?.find((t) => t.type === 'singles');
      if ((heldA && chasing.get(b.id) === heldA.name) || (heldB && chasing.get(a.id) === heldB.name)) {
        score += 14;
        reasons.push(`Champion vs. top contender for the ${(heldA ?? heldB)!.name}`);
      }
      if (c.storylineOfPair.has(k)) (score += 6), reasons.push(`Already connected through “${c.storylineOfPair.get(k)!.title}”`);
      score += ((a.popularity + b.popularity) / 2 - 50) / 5;
      if (reasons.length < 2) continue;
      list.push({
        key: `r:${k}`,
        ids: [a.id, b.id],
        kind: 'rivalry',
        title: `${a.ringName} vs. ${b.ringName}`,
        score: Math.round(score),
        reasons,
        cautions: [],
        brand: a.brand,
        rivalryDraft: {
          name: `${a.ringName} vs. ${b.ringName}`,
          brand: a.brand,
          participants: [
            { type: 'superstar', id: a.id },
            { type: 'superstar', id: b.id },
          ],
        },
      });
    }
  }
  return diverse(list, 6, 1);
}

function developments(c: Context, opts: MatchmakerOptions): Suggestion[] {
  const out: Suggestion[] = [];
  for (const r of c.u.rivalries) {
    if (r.status !== 'active' || !brandOk(r.brand, opts)) continue;
    const ms = rivalryMatches(c.d, r);
    const done = ms.filter((m) => m.status === 'completed');
    const upcoming = ms.filter((m) => m.status === 'scheduled');
    const last = done[done.length - 1];
    const lastEvent = [last?.date, ...r.history.map((h) => h.date)].filter(Boolean).sort().pop() ?? r.startDate;
    const idle = daysBetween(lastEvent, c.today);
    const sides = r.participants.slice(0, 2).map((p) => ({
      teamId: p.type === 'team' ? p.id : undefined,
      superstarIds: p.type === 'team' ? (c.d.teams.get(p.id)?.memberIds.slice(0, 2) ?? []) : [p.id],
    }));
    const isTeam = r.participants[0]?.type === 'team';
    const bookable = sides.length >= 2 && sides.every((s) => s.superstarIds.length > 0);
    const base = { brand: r.brand, link: `/rivalries/${r.id}` };
    if (upcoming.length) continue;
    if (!done.length) {
      out.push({
        ...base,
        key: `d:first:${r.id}`,
        kind: 'development',
        title: `Kick off “${r.name}” with a first encounter`,
        score: 40 + r.intensity,
        reasons: ['The rivalry has no matches yet', `Intensity ${r.intensity}/10`],
        cautions: [],
        booking: bookable ? { brand: r.brand, matchType: isTeam ? 'tag' : 'singles', sides, championshipIds: [], rivalryId: r.id } : undefined,
      });
    } else if (r.intensity >= 8 && (done.length >= 3 || idle >= 21)) {
      const stip = isTeam ? 'tlc' : done.length >= 4 ? 'hell_in_a_cell' : 'steel_cage';
      const record = r.participants
        .slice(0, 2)
        .map((p) => `${refName(c.d, p)} ${done.filter((m) => sideWinner(m, p)).length}`)
        .join(' – ');
      out.push({
        ...base,
        key: `d:blowoff:${r.id}`,
        kind: 'development',
        title: `Blow off “${r.name}” with a ${matchTypeLabel(stip)} match`,
        score: 45 + r.intensity,
        reasons: [`Intensity is at ${r.intensity}/10`, `${done.length} matches so far (${record})`, 'A stipulation match gives a decisive ending'],
        cautions: [],
        booking: bookable ? { brand: r.brand, matchType: stip, sides, championshipIds: [], rivalryId: r.id } : undefined,
      });
    } else if (idle >= 30) {
      out.push({
        ...base,
        key: `d:cold:${r.id}`,
        kind: 'development',
        title: `“${r.name}” has gone cold`,
        score: 30,
        reasons: [`Nothing has happened in ${idle} days`, 'Escalate it with a confrontation or match, or pause it'],
        cautions: [],
        booking: bookable ? { brand: r.brand, matchType: isTeam ? 'tag' : 'singles', sides, championshipIds: [], rivalryId: r.id } : undefined,
      });
    }
  }
  for (const s of c.u.storylines) {
    if (s.status !== 'active' || !brandOk(s.brand, opts)) continue;
    const base = { brand: s.brand, link: `/storylines/${s.id}`, kind: 'development' as const, cautions: [] };
    for (const ev of s.plannedEvents) {
      if (ev.done || !ev.date) continue;
      const until = daysBetween(c.today, ev.date);
      if (until < 0) {
        out.push({ ...base, key: `d:overdue:${ev.id}`, title: `Overdue in “${s.title}”: ${ev.title}`, score: 50, reasons: [`Planned for ${formatDate(ev.date)} (${-until} days ago)`, 'Mark it done, reschedule it, or book it now'] });
      } else if (until <= 7) {
        out.push({ ...base, key: `d:soon:${ev.id}`, title: `Coming up in “${s.title}”: ${ev.title}`, score: 35, reasons: [`Planned for ${formatDate(ev.date)} (in ${until} days)`] });
      }
    }
    const lastMoment = [...s.moments.map((m) => m.date), s.startDate].sort().pop()!;
    const idle = daysBetween(lastMoment, c.today);
    if (idle >= 30) {
      out.push({ ...base, key: `d:story:${s.id}`, title: `Advance “${s.title}” to its next chapter`, score: 28, reasons: [`No new moment in ${idle} days`, s.currentChapter ? `Current chapter: ${s.currentChapter}` : 'No current chapter set'] });
    }
  }
  for (const st of eligibleStars(c, opts)) {
    const rec = recordOf(c.d, st.id);
    if (rec.streak?.type === 'L' && rec.streak.count >= 4) {
      out.push({
        key: `d:slump:${st.id}`,
        kind: 'development',
        title: `Repackage ${st.ringName}?`,
        score: 20 + rec.streak.count,
        reasons: [`On a ${rec.streak.count}-match losing streak`, `Consider a ${st.alignment === 'face' ? 'heel' : 'face'} turn, a new alliance or a confidence-building win`],
        cautions: [],
        brand: st.brand,
        link: `/superstars/${st.id}`,
      });
    }
  }
  for (const [cid, reign] of c.d.currentReign) {
    const t = c.d.titles.get(cid);
    if (!t || !brandOk(t.brand, opts) || (opts.gender !== 'all' && t.gender !== opts.gender)) continue;
    const days = reignDays(reign, c.today);
    if (days >= 180) {
      out.push({
        key: `d:reign:${reign.id}`,
        kind: 'development',
        title: `Build a credible challenger for ${holderName(c.d, reign)}`,
        score: 25 + Math.min(days / 30, 20),
        reasons: [`${t.name} reign has lasted ${days} days`, 'A long reign needs a strong challenger: see the championship suggestions'],
        cautions: [],
        brand: t.brand,
        link: `/championships/${t.id}`,
      });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 12);
}

function sideWinner(m: Match, p: CompetitorRef): boolean {
  const side = p.type === 'team' ? sideOfTeam(m, p.id) : sideOfStar(m, p.id);
  return !!side && m.outcome === 'win' && m.winnerSideId === side.id;
}

export function runMatchmaker(u: Universe, d: Derived, opts: MatchmakerOptions): MatchmakerResult {
  const c = new Context(u, d);
  return {
    title: titleMatches(c, opts),
    singles: singles(c, opts),
    tag: tagMatches(c, opts),
    rivalries: newRivalries(c, opts),
    developments: developments(c, opts),
  };
}
