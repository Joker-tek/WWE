import { produce } from 'immer';
import { saveMatch } from '../src/domain/actions';
import type { Match, Universe } from '../src/domain/schema';
import { starterUniverse } from '../src/domain/seed';
import { uid } from '../src/domain/util';

export function universe(): Universe {
  const u = starterUniverse('Test Universe');
  u.settings.dateMode = 'custom';
  u.settings.customDate = '2026-06-30';
  return u;
}

export const star = (u: Universe, name: string) => {
  const s = u.superstars.find((x) => x.ringName === name);
  if (!s) throw new Error(`no ${name}`);
  return s.id;
};
export const title = (u: Universe, name: string) => u.championships.find((c) => c.name === name)!.id;

export function singles(u: Universe, a: string, b: string, date: string, winner: 'a' | 'b' | 'draw', extra: Partial<Match> = {}): Match {
  const now = new Date().toISOString();
  return {
    id: uid('match'),
    status: 'completed',
    date,
    brand: 'raw',
    eventName: 'RAW',
    matchType: 'singles',
    sides: [
      { id: 'A', superstarIds: [star(u, a)] },
      { id: 'B', superstarIds: [star(u, b)] },
    ],
    outcome: winner === 'draw' ? 'draw' : 'win',
    winnerSideId: winner === 'draw' ? undefined : winner === 'a' ? 'A' : 'B',
    finish: 'Pinfall',
    result: '',
    duration: '',
    championshipIds: [],
    titleChanged: false,
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

/** Apply domain actions the same way the app does (immer draft). */
export function apply(u: Universe, fn: (d: Universe) => void): Universe {
  return produce(u, fn);
}

export function record(u: Universe, m: Match): Universe {
  return apply(u, (d) => saveMatch(d, m));
}
