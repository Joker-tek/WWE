import type { BrandKey, HolderType, Match, Universe } from './schema';
import { releaseMatchTitles, syncMatchTitles } from './titles';
import { nowIso, uid } from './util';

/*
 * Domain operations. Each one mutates a Universe (an immer draft in the app) and throws
 * an Error with a user-facing message if the operation is invalid. Because they run on a
 * draft, a throw leaves the saved data untouched.
 */

export function upsert<T extends { id: string }>(arr: T[], item: T) {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = item;
  else arr.push(item);
}

// --- Superstars -----------------------------------------------------------------

export function superstarReferences(u: Universe, id: string) {
  return {
    matches: u.matches.filter((m) => m.sides.some((s) => s.superstarIds.includes(id))).length,
    reigns: u.reigns.filter((r) => r.memberIds.includes(id) || (r.holderType === 'superstar' && r.holderId === id)).length,
  };
}

export function deleteSuperstar(u: Universe, id: string) {
  const refs = superstarReferences(u, id);
  if (refs.matches || refs.reigns) {
    throw new Error(
      `This superstar appears in ${refs.matches} match(es) and ${refs.reigns} title reign(s). Deleting would corrupt that history, so set their status to Released or Inactive instead.`,
    );
  }
  u.superstars = u.superstars.filter((s) => s.id !== id);
  for (const t of u.tagTeams) t.memberIds = t.memberIds.filter((m) => m !== id);
  for (const r of u.rivalries) {
    r.participants = r.participants.filter((p) => !(p.type === 'superstar' && p.id === id));
    if (r.winner?.type === 'superstar' && r.winner.id === id) r.winner = null;
  }
  for (const s of u.storylines) s.superstarIds = s.superstarIds.filter((x) => x !== id);
  u.transfers = u.transfers.filter((t) => !(t.entityType === 'superstar' && t.entityId === id));
}

export function transferEntity(u: Universe, type: HolderType, id: string, toBrand: BrandKey, date: string, note: string) {
  const entity = type === 'superstar' ? u.superstars.find((s) => s.id === id) : u.tagTeams.find((t) => t.id === id);
  if (!entity) throw new Error('Not found.');
  if (entity.brand === toBrand) throw new Error('Already on that brand.');
  u.transfers.push({ id: uid('xfer'), entityType: type, entityId: id, fromBrand: entity.brand, toBrand, date, note });
  entity.brand = toBrand;
  entity.updatedAt = nowIso();
}

// --- Tag teams ------------------------------------------------------------------

export function teamReferences(u: Universe, id: string) {
  return {
    matches: u.matches.filter((m) => m.sides.some((s) => s.teamId === id)).length,
    reigns: u.reigns.filter((r) => r.holderType === 'team' && r.holderId === id).length,
  };
}

export function deleteTeam(u: Universe, id: string) {
  const refs = teamReferences(u, id);
  if (refs.matches || refs.reigns) {
    throw new Error(
      `This team appears in ${refs.matches} match(es) and ${refs.reigns} title reign(s). Set its status to Disbanded instead so its history is kept.`,
    );
  }
  u.tagTeams = u.tagTeams.filter((t) => t.id !== id);
  for (const r of u.rivalries) {
    r.participants = r.participants.filter((p) => !(p.type === 'team' && p.id === id));
    if (r.winner?.type === 'team' && r.winner.id === id) r.winner = null;
  }
  for (const s of u.storylines) s.teamIds = s.teamIds.filter((x) => x !== id);
}

// --- Matches --------------------------------------------------------------------

export function validateMatch(u: Universe, m: Match): string[] {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date)) errors.push('Pick a valid date.');
  if (!m.matchType.trim()) errors.push('Choose a match type.');
  if (m.sides.length < 2) errors.push('A match needs at least two sides.');
  const seen = new Set<string>();
  m.sides.forEach((s, i) => {
    if (!s.superstarIds.length) errors.push(`Side ${i + 1} has no superstars.`);
    for (const id of s.superstarIds) {
      if (!u.superstars.some((x) => x.id === id)) errors.push('A selected superstar no longer exists.');
      if (seen.has(id)) {
        const name = u.superstars.find((x) => x.id === id)?.ringName ?? 'A superstar';
        errors.push(`${name} is on more than one side.`);
      }
      seen.add(id);
    }
    if (s.teamId && !u.tagTeams.some((t) => t.id === s.teamId)) errors.push(`Side ${i + 1}: the selected tag team no longer exists.`);
  });
  const teamIds = m.sides.map((s) => s.teamId).filter(Boolean);
  if (new Set(teamIds).size !== teamIds.length) errors.push('The same tag team is on more than one side.');
  if (m.status === 'completed' && m.outcome === 'win' && !m.sides.some((s) => s.id === m.winnerSideId)) {
    errors.push('Pick the winner (or set the outcome to Draw / No Contest).');
  }
  for (const cid of m.championshipIds) {
    if (!u.championships.some((c) => c.id === cid)) errors.push('A selected championship no longer exists.');
  }
  return [...new Set(errors)];
}

/**
 * Create or update a match. Statistics are derived from matches, so saving the same match
 * twice can never double-count; title reigns are synced idempotently.
 */
export function saveMatch(u: Universe, m: Match) {
  const errors = validateMatch(u, m);
  if (errors.length) throw new Error(errors.join(' '));
  const clean: Match = { ...m, updatedAt: nowIso() };
  if (clean.status === 'scheduled') {
    clean.winnerSideId = undefined;
    clean.titleChanged = false;
  }
  if (clean.outcome !== 'win') {
    clean.winnerSideId = undefined;
    clean.titleChanged = false;
  }
  upsert(u.matches, clean);
  syncMatchTitles(u, clean);
}

export function deleteMatch(u: Universe, id: string) {
  releaseMatchTitles(u, id);
  u.matches = u.matches.filter((m) => m.id !== id);
  for (const s of u.storylines) for (const mo of s.moments) if (mo.matchId === id) delete mo.matchId;
}

// --- Championships / rivalries / storylines -------------------------------------

export function deleteChampionship(u: Universe, id: string) {
  u.championships = u.championships.filter((c) => c.id !== id);
  u.reigns = u.reigns.filter((r) => r.championshipId !== id);
  for (const m of u.matches) m.championshipIds = m.championshipIds.filter((c) => c !== id);
}

export function deleteRivalry(u: Universe, id: string) {
  u.rivalries = u.rivalries.filter((r) => r.id !== id);
  for (const m of u.matches) if (m.rivalryId === id) delete m.rivalryId;
}

export function deleteStoryline(u: Universe, id: string) {
  u.storylines = u.storylines.filter((s) => s.id !== id);
  for (const m of u.matches) if (m.storylineId === id) delete m.storylineId;
  for (const r of u.rivalries) if (r.storylineId === id) delete r.storylineId;
}
