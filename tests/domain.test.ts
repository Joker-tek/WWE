import { describe, expect, it } from 'vitest';
import { deleteMatch, deleteSuperstar, saveMatch, transferEntity } from '../src/domain/actions';
import { runMatchmaker } from '../src/domain/matchmaking';
import { validateUniverse } from '../src/domain/schema';
import { computeDerived, recordOf, reignDays, headToHead } from '../src/domain/stats';
import { currentReignOf, vacateTitle } from '../src/domain/titles';
import { backupEnvelope } from '../src/store/persistence';
import { apply, record, singles, star, title, universe } from './helpers';

describe('statistics', () => {
  it('derives wins, losses, draws, win % and streaks from matches', () => {
    let u = universe();
    u = record(u, singles(u, 'CM Punk', 'Seth Rollins', '2026-01-01', 'a'));
    u = record(u, singles(u, 'CM Punk', 'Gunther', '2026-01-08', 'a'));
    u = record(u, singles(u, 'CM Punk', 'Seth Rollins', '2026-01-15', 'draw'));
    u = record(u, singles(u, 'CM Punk', 'Gunther', '2026-01-22', 'b'));
    u = record(u, singles(u, 'CM Punk', 'Gunther', '2026-01-29', 'b'));
    const d = computeDerived(u, '2026-02-01');
    const punk = recordOf(d, star(u, 'CM Punk'));
    expect(punk).toMatchObject({ matches: 5, wins: 2, losses: 2, draws: 1, longestWin: 2, longestLoss: 2 });
    expect(punk.winPct).toBeCloseTo(0.4);
    expect(punk.streak).toEqual({ type: 'L', count: 2 });
    expect(punk.form).toEqual(['L', 'L', 'D', 'W', 'W']);
    expect(recordOf(d, star(u, 'Gunther')).streak).toEqual({ type: 'W', count: 2 });
  });

  it('never double-counts when the same match is saved again or edited', () => {
    let u = universe();
    const m = singles(u, 'CM Punk', 'Seth Rollins', '2026-01-01', 'a');
    u = record(u, m);
    u = record(u, m); // saving the same match twice
    u = record(u, { ...m, winnerSideId: 'B' }); // editing the winner
    const d = computeDerived(u, '2026-02-01');
    expect(u.matches).toHaveLength(1);
    expect(recordOf(d, star(u, 'CM Punk'))).toMatchObject({ matches: 1, wins: 0, losses: 1 });
    expect(recordOf(d, star(u, 'Seth Rollins'))).toMatchObject({ matches: 1, wins: 1, losses: 0 });
  });

  it('ignores scheduled matches in records and computes head-to-head', () => {
    let u = universe();
    u = record(u, singles(u, 'CM Punk', 'Seth Rollins', '2026-01-01', 'a'));
    u = record(u, singles(u, 'CM Punk', 'Seth Rollins', '2026-02-01', 'a', { status: 'scheduled' }));
    const d = computeDerived(u, '2026-01-10');
    expect(recordOf(d, star(u, 'CM Punk')).matches).toBe(1);
    expect(d.scheduled).toHaveLength(1);
    const h = headToHead(d.completed, { type: 'superstar', id: star(u, 'CM Punk') }, { type: 'superstar', id: star(u, 'Seth Rollins') });
    expect(h).toMatchObject({ aWins: 1, bWins: 0 });
  });

  it('rejects invalid matches', () => {
    const u = universe();
    const bad = singles(u, 'CM Punk', 'CM Punk', '2026-01-01', 'a');
    expect(() => apply(u, (d) => saveMatch(d, bad))).toThrow(/more than one side/);
    const noWinner = singles(u, 'CM Punk', 'Gunther', '2026-01-01', 'a', { winnerSideId: undefined });
    expect(() => apply(u, (d) => saveMatch(d, noWinner))).toThrow(/Pick the winner/);
  });
});

describe('championships', () => {
  const WHC = 'World Heavyweight Championship';

  it('changes hands from a match, and editing/deleting the match reverts cleanly', () => {
    let u = universe();
    const t = title(u, WHC);
    const m1 = singles(u, 'CM Punk', 'Seth Rollins', '2026-01-01', 'a', { championshipIds: [t], titleChanged: true });
    u = record(u, m1);
    expect(currentReignOf(u, t)?.holderId).toBe(star(u, 'CM Punk'));

    const m2 = singles(u, 'CM Punk', 'Seth Rollins', '2026-03-01', 'b', { championshipIds: [t], titleChanged: true });
    u = record(u, m2);
    expect(u.reigns).toHaveLength(2);
    expect(currentReignOf(u, t)?.holderId).toBe(star(u, 'Seth Rollins'));
    const d = computeDerived(u, '2026-04-01');
    const punkReign = u.reigns.find((r) => r.holderId === star(u, 'CM Punk'))!;
    expect(reignDays(punkReign, d.today)).toBe(59);

    // Saving m2 again must not create another reign.
    u = record(u, m2);
    expect(u.reigns).toHaveLength(2);

    // Edit m2 so Punk retains: the Rollins reign is removed and Punk's reign reopens.
    u = record(u, { ...m2, winnerSideId: 'A', titleChanged: false });
    expect(u.reigns).toHaveLength(1);
    expect(currentReignOf(u, t)?.holderId).toBe(star(u, 'CM Punk'));
    expect(currentReignOf(u, t)?.endDate).toBeNull();

    // Deleting the first match reverts the title to vacant.
    u = apply(u, (x) => deleteMatch(x, m1.id));
    expect(u.reigns).toHaveLength(0);
  });

  it('refuses out-of-order title changes and requires a team for tag titles', () => {
    let u = universe();
    const t = title(u, WHC);
    u = record(u, singles(u, 'CM Punk', 'Seth Rollins', '2026-05-01', 'a', { championshipIds: [t], titleChanged: true }));
    const earlier = singles(u, 'Gunther', 'CM Punk', '2026-04-01', 'a', { championshipIds: [t], titleChanged: true });
    expect(() => record(u, earlier)).toThrow(/before the current reign began/);

    const tag = title(u, 'World Tag Team Championship');
    const noTeam = {
      ...singles(u, 'CM Punk', 'Seth Rollins', '2026-05-02', 'a'),
      matchType: 'tag',
      championshipIds: [tag],
      titleChanged: true,
    };
    expect(() => record(u, noTeam)).toThrow(/tag team title/);
  });

  it('tracks team reigns for each member and supports vacating', () => {
    let u = universe();
    const tag = title(u, 'World Tag Team Championship');
    const jd = u.tagTeams.find((x) => x.name === 'The Judgment Day')!;
    const lwo = u.tagTeams.find((x) => x.name === 'The LWO')!;
    const m = {
      ...singles(u, 'Finn Bálor', 'Rey Mysterio', '2026-02-01', 'a'),
      matchType: 'tag',
      sides: [
        { id: 'A', teamId: jd.id, superstarIds: jd.memberIds },
        { id: 'B', teamId: lwo.id, superstarIds: lwo.memberIds },
      ],
      championshipIds: [tag],
      titleChanged: true,
    };
    u = record(u, m);
    const d = computeDerived(u, '2026-03-01');
    expect(d.heldTitles.get(star(u, 'JD McDonagh'))?.[0].name).toBe('World Tag Team Championship');
    expect(recordOf(d, jd.id, 'team')).toMatchObject({ wins: 1 });
    u = apply(u, (x) => vacateTitle(x, tag, '2026-03-01', 'Injury'));
    expect(currentReignOf(u, tag)).toBeUndefined();
  });
});

describe('data integrity', () => {
  it('blocks deleting superstars with history and records transfers', () => {
    let u = universe();
    u = record(u, singles(u, 'CM Punk', 'Seth Rollins', '2026-01-01', 'a'));
    expect(() => apply(u, (x) => deleteSuperstar(x, star(u, 'CM Punk')))).toThrow(/Released/);
    u = apply(u, (x) => transferEntity(x, 'superstar', star(u, 'CM Punk'), 'smackdown', '2026-01-02', 'Draft'));
    expect(u.superstars.find((s) => s.ringName === 'CM Punk')?.brand).toBe('smackdown');
    expect(u.transfers).toHaveLength(1);
  });

  it('round-trips a backup and rejects garbage', () => {
    let u = universe();
    u = record(u, singles(u, 'CM Punk', 'Seth Rollins', '2026-01-01', 'a'));
    const json = JSON.parse(JSON.stringify(backupEnvelope(u)));
    const res = validateUniverse(json);
    expect(res.ok).toBe(true);
    expect(res.data).toEqual(JSON.parse(JSON.stringify(u)));
    expect(validateUniverse({ hello: 'world' }).ok).toBe(false);
    expect(validateUniverse('nope').ok).toBe(false);
  });

  it('repairs dangling references on import', () => {
    let u = universe();
    u = record(u, singles(u, 'CM Punk', 'Seth Rollins', '2026-01-01', 'a'));
    const raw = JSON.parse(JSON.stringify(u));
    raw.superstars = raw.superstars.filter((s: { ringName: string }) => s.ringName !== 'CM Punk');
    const res = validateUniverse(raw);
    expect(res.ok).toBe(true);
    expect(res.data!.matches).toHaveLength(0);
    expect(res.warnings.join(' ')).toMatch(/skipped/);
  });
});

describe('matchmaking assistant', () => {
  it('suggests explained matches without modifying data', () => {
    let u = universe();
    const t = title(u, 'World Heavyweight Championship');
    u = record(u, singles(u, 'CM Punk', 'Seth Rollins', '2026-06-01', 'a', { championshipIds: [t], titleChanged: true }));
    u = record(u, singles(u, 'Gunther', 'Jey Uso', '2026-06-08', 'a'));
    u = apply(u, (x) => {
      x.rivalries.push({
        id: 'riv1',
        name: 'Punk vs Rollins',
        brand: 'raw',
        participants: [
          { type: 'superstar', id: star(u, 'CM Punk') },
          { type: 'superstar', id: star(u, 'Seth Rollins') },
        ],
        status: 'active',
        intensity: 9,
        startDate: '2026-05-01',
        endDate: '',
        description: '',
        history: [],
        winner: null,
        outcome: '',
        createdAt: '',
        updatedAt: '',
      });
    });
    const frozen = JSON.stringify(u);
    const d = computeDerived(u, '2026-06-30');
    const res = runMatchmaker(u, d, { brand: 'raw', gender: 'male' });
    expect(JSON.stringify(u)).toBe(frozen);
    expect(res.singles.length).toBeGreaterThan(0);
    expect(res.singles.every((s) => s.reasons.length > 0)).toBe(true);
    const whc = res.title.find((s) => s.subtitle === 'World Heavyweight Championship');
    expect(whc?.booking?.championshipIds).toEqual([t]);
    expect(whc?.title).toMatch(/CM Punk \(c\)/);
    const top = res.singles[0];
    expect(top.title).toMatch(/CM Punk|Seth Rollins/);
    expect(res.rivalries.every((r) => r.rivalryDraft)).toBe(true);
  });
});
