import type { Championship, HolderType, Match, MatchSide, Reign, Universe } from './schema';
import { uid } from './util';

export interface Holder {
  holderType: HolderType;
  holderId: string;
  memberIds: string[];
}

export function currentReignOf(u: Universe, championshipId: string): Reign | undefined {
  return u.reigns
    .filter((r) => r.championshipId === championshipId && r.endDate === null)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

export function sameHolder(r: Pick<Reign, 'holderType' | 'holderId'>, h: Holder): boolean {
  return r.holderType === h.holderType && r.holderId === h.holderId;
}

export function holderOnSide(r: Pick<Reign, 'holderType' | 'holderId'>, side: MatchSide): boolean {
  return r.holderType === 'team' ? side.teamId === r.holderId : side.superstarIds.includes(r.holderId);
}

/** Who would hold `title` if the winning side of `match` won it. Returns an error message when impossible. */
export function winnerHolder(match: Match, title: Championship): Holder | { error: string } {
  const side = match.sides.find((s) => s.id === match.winnerSideId);
  if (!side) return { error: 'Pick the winner before recording a title change.' };
  if (title.type === 'tag') {
    if (!side.teamId) {
      return { error: `${title.name} is a tag team title: choose the winning side's tag team in the match form.` };
    }
    return { holderType: 'team', holderId: side.teamId, memberIds: [...side.superstarIds] };
  }
  if (side.superstarIds.length !== 1) {
    return { error: `${title.name} is a singles title, so the winning side must be a single superstar.` };
  }
  return { holderType: 'superstar', holderId: side.superstarIds[0], memberIds: [side.superstarIds[0]] };
}

/** True when the winning side does not already hold at least one of the titles at stake. */
export function wouldChangeHands(u: Universe, match: Match): boolean {
  if (match.outcome !== 'win' || !match.winnerSideId) return false;
  const side = match.sides.find((s) => s.id === match.winnerSideId);
  if (!side) return false;
  return match.championshipIds.some((cid) => {
    const cur = currentReignOf(u, cid);
    // A reign this very match created doesn't count as "already champion".
    if (cur && cur.wonAtMatchId === match.id) return true;
    return !cur || !holderOnSide(cur, side);
  });
}

function revertReign(u: Universe, r: Reign) {
  const title = u.championships.find((c) => c.id === r.championshipId);
  if (r.endDate) {
    throw new Error(
      `Can't undo the ${title?.name ?? 'title'} change from this match: that reign has already ended in a later title change. Edit the championship history first.`,
    );
  }
  u.reigns = u.reigns.filter((x) => x.id !== r.id);
  const prev = u.reigns.find((x) => x.championshipId === r.championshipId && x.lostAtMatchId === r.wonAtMatchId);
  if (prev) {
    prev.endDate = null;
    delete prev.lostAtMatchId;
  }
}

/**
 * Bring title reigns in line with a saved match. Idempotent: running it again for the
 * same match never creates duplicate reigns. Throws an Error with a user-facing message
 * when the change is impossible (mutations happen on an immer draft, so a throw aborts them).
 */
export function syncMatchTitles(u: Universe, match: Match) {
  const shouldChange = match.status === 'completed' && match.outcome === 'win' && match.titleChanged && !!match.winnerSideId;

  for (const r of u.reigns.filter((x) => x.wonAtMatchId === match.id)) {
    if (!shouldChange || !match.championshipIds.includes(r.championshipId)) revertReign(u, r);
  }
  if (!shouldChange) return;

  for (const cid of match.championshipIds) {
    const title = u.championships.find((c) => c.id === cid);
    if (!title) continue;
    const holder = winnerHolder(match, title);
    if ('error' in holder) throw new Error(holder.error);

    const existing = u.reigns.find((r) => r.championshipId === cid && r.wonAtMatchId === match.id);
    if (existing) {
      const prev = u.reigns.find((r) => r.championshipId === cid && r.lostAtMatchId === match.id);
      if (prev && prev.startDate > match.date) {
        throw new Error(`The match date is before ${title.name}'s previous reign began (${prev.startDate}).`);
      }
      if (existing.endDate && existing.endDate < match.date) {
        throw new Error(`The match date is after the ${title.name} reign it started had already ended.`);
      }
      Object.assign(existing, holder, { startDate: match.date });
      if (prev) prev.endDate = match.date;
      continue;
    }

    const current = currentReignOf(u, cid);
    if (current && sameHolder(current, holder)) continue; // retained: nothing changes hands
    if (current) {
      if (current.startDate > match.date) {
        throw new Error(
          `${title.name}: the match date (${match.date}) is before the current reign began (${current.startDate}). Title changes must be recorded in order.`,
        );
      }
      current.endDate = match.date;
      current.lostAtMatchId = match.id;
    }
    u.reigns.push({
      id: uid('reign'),
      championshipId: cid,
      ...holder,
      startDate: match.date,
      endDate: null,
      wonAtMatchId: match.id,
      notes: '',
    });
  }
}

/**
 * Undo title changes caused by a match that is being deleted. If a reign it started has
 * since ended, the history is kept and only the link to the match is removed.
 */
export function releaseMatchTitles(u: Universe, matchId: string): 'reverted' | 'detached' | 'none' {
  const linked = u.reigns.filter((r) => r.wonAtMatchId === matchId);
  let result: 'reverted' | 'detached' | 'none' = 'none';
  for (const r of linked) {
    if (r.endDate === null) {
      revertReign(u, r);
      result = 'reverted';
    } else {
      delete r.wonAtMatchId;
      result = result === 'reverted' ? result : 'detached';
    }
  }
  for (const r of u.reigns) if (r.lostAtMatchId === matchId) delete r.lostAtMatchId;
  return result;
}

export function recordTitleChange(u: Universe, championshipId: string, holder: Holder, date: string, notes = '') {
  const title = u.championships.find((c) => c.id === championshipId);
  if (!title) throw new Error('Championship not found.');
  const current = currentReignOf(u, championshipId);
  if (current && sameHolder(current, holder)) throw new Error('That competitor is already the reigning champion.');
  if (current && current.startDate > date) {
    throw new Error(`The new reign can't start before the current one began (${current.startDate}).`);
  }
  if (current) current.endDate = date;
  u.reigns.push({ id: uid('reign'), championshipId, ...holder, startDate: date, endDate: null, notes });
}

export function vacateTitle(u: Universe, championshipId: string, date: string, reason: string) {
  const current = currentReignOf(u, championshipId);
  if (!current) throw new Error('This championship is already vacant.');
  if (current.startDate > date) throw new Error(`The vacancy date is before the reign began (${current.startDate}).`);
  current.endDate = date;
  if (reason) current.notes = [current.notes, `Vacated: ${reason}`].filter(Boolean).join('\n');
}

export function validateReignDates(u: Universe, reign: Reign): string | null {
  if (reign.endDate && reign.endDate < reign.startDate) return 'The end date is before the start date.';
  const others = u.reigns.filter((r) => r.championshipId === reign.championshipId && r.id !== reign.id);
  if (reign.endDate === null && others.some((r) => r.endDate === null)) {
    return 'Another reign for this title is still open. End it first, or give this reign an end date.';
  }
  const end = reign.endDate ?? '9999-12-31';
  const overlap = others.find((r) => r.startDate < end && (r.endDate ?? '9999-12-31') > reign.startDate);
  if (overlap) return `These dates overlap another reign (${overlap.startDate} → ${overlap.endDate ?? 'present'}).`;
  return null;
}
