import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App';
import { FeedbackProvider } from '../src/components/feedback';
import { saveMatch } from '../src/domain/actions';
import type { Universe } from '../src/domain/schema';
import { computeDerived, recordOf } from '../src/domain/stats';
import { useStore } from '../src/store/store';
import { apply, record, singles, star, title, universe } from './helpers';

/** A universe with matches, reigns, a tag team title, rivalry, storyline and a scheduled match. */
function richUniverse(): Universe {
  let u = universe();
  const whc = title(u, 'World Heavyweight Championship');
  u = record(u, singles(u, 'CM Punk', 'Seth Rollins', '2026-05-01', 'a', { championshipIds: [whc], titleChanged: true }));
  u = record(u, singles(u, 'Gunther', 'Jey Uso', '2026-05-08', 'b'));
  u = record(u, singles(u, 'CM Punk', 'Gunther', '2026-05-15', 'draw'));
  u = record(u, { ...singles(u, 'Rhea Ripley', 'IYO SKY', '2026-05-20', 'a'), brand: 'raw' });
  u = record(u, singles(u, 'CM Punk', 'Seth Rollins', '2026-07-10', 'a', { status: 'scheduled' }));
  const jd = u.tagTeams[0];
  const lwo = u.tagTeams[1];
  u = record(u, {
    ...singles(u, 'Finn Bálor', 'Rey Mysterio', '2026-06-01', 'a'),
    matchType: 'tag',
    sides: [
      { id: 'A', teamId: jd.id, superstarIds: jd.memberIds },
      { id: 'B', teamId: lwo.id, superstarIds: lwo.memberIds },
    ],
    championshipIds: [title(u, 'World Tag Team Championship')],
    titleChanged: true,
  });
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
      startDate: '2026-04-01',
      endDate: '',
      description: 'Bad blood',
      history: [{ id: 'h1', date: '2026-04-02', title: 'Brawl', text: '' }],
      winner: null,
      outcome: '',
      storylineId: 'st1',
      createdAt: '',
      updatedAt: '',
    });
    x.storylines.push({
      id: 'st1',
      title: 'Road to WrestleMania',
      description: '',
      length: 'long',
      brand: 'raw',
      superstarIds: [star(u, 'CM Punk')],
      teamIds: [jd.id],
      status: 'active',
      currentChapter: 'Chapter 1',
      startDate: '2026-04-01',
      endDate: '',
      plannedEvents: [{ id: 'p1', date: '2026-06-01', title: 'Betrayal', description: '', done: false }],
      moments: [{ id: 'm1', date: '2026-04-05', title: 'The spark', text: '' }],
      outcome: '',
      createdAt: '',
      updatedAt: '',
    });
    x.superstars.find((s) => s.ringName === 'Gunther')!.status = 'injured';
  });
  return u;
}

function renderAt(path: string) {
  return render(
    <FeedbackProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </FeedbackProvider>,
  );
}

let u: Universe;
beforeAll(() => {
  u = richUniverse();
});
afterEach(cleanup);

describe('every page renders without crashing', () => {
  const paths = () => {
    const d = computeDerived(u, u.settings.customDate);
    const m = d.completed[0];
    return [
      '/',
      '/brand/raw',
      '/brand/smackdown',
      '/brand/nxt',
      '/roster/male',
      '/roster/female',
      `/superstars/${star(u, 'CM Punk')}`,
      `/superstars/${star(u, 'Finn Bálor')}`,
      '/tag-teams',
      `/tag-teams/${u.tagTeams[0].id}`,
      '/championships',
      `/championships/${title(u, 'World Heavyweight Championship')}`,
      `/championships/${title(u, 'World Tag Team Championship')}`,
      '/matches',
      '/matches?status=scheduled',
      '/matches/new',
      `/matches/${m.id}/edit`,
      '/matchmaker',
      '/rivalries',
      '/rivalries/riv1',
      '/storylines',
      '/storylines/st1',
      '/stats',
      '/data',
      '/superstars/does-not-exist',
      '/nope',
    ];
  };

  it.each(Array.from({ length: 26 }, (_, i) => i))('route #%i', async (i) => {
    useStore.setState({ data: u, loaded: true });
    const path = paths()[i];
    renderAt(path);
    expect(document.body.textContent?.length, path).toBeGreaterThan(50);
  });

  it('shows real content on key pages', () => {
    useStore.setState({ data: u, loaded: true });
    renderAt('/');
    expect(screen.getAllByText('CM Punk').length).toBeGreaterThan(0);
    cleanup();
    renderAt(`/championships/${title(u, 'World Heavyweight Championship')}`);
    expect(screen.getByText('CURRENT CHAMPION')).toBeTruthy();
  });

  it('all stats/matchmaker tabs render', async () => {
    useStore.setState({ data: u, loaded: true });
    renderAt('/stats');
    for (const t of ['Power rankings', 'Brand comparison', 'Head-to-head', 'Match types', 'Leaderboards']) {
      await act(async () => fireEvent.click(screen.getByRole('tab', { name: new RegExp(t) })));
    }
    cleanup();
    renderAt('/matchmaker');
    for (const t of ['Singles', 'Tag team', 'New rivalries', 'Storyline developments']) {
      await act(async () => fireEvent.click(screen.getByRole('tab', { name: new RegExp(t) })));
    }
    expect(screen.getAllByText(/Dismiss/).length).toBeGreaterThan(0);
  });
});

describe('UI flows', () => {
  it('re-saving a match through the form does not double-count', async () => {
    useStore.setState({ data: u, loaded: true });
    const d0 = computeDerived(u, u.settings.customDate);
    const punk = star(u, 'CM Punk');
    const before = recordOf(d0, punk);
    const m = d0.completed.find((x) => x.sides.some((s) => s.superstarIds.includes(punk)))!;
    // Open the edit form and save twice in a row (the form closes after each save).
    for (let i = 0; i < 2; i++) {
      renderAt(`/matches/${m.id}/edit`);
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })));
      cleanup();
    }
    const after = useStore.getState().data!;
    expect(after.matches).toHaveLength(u.matches.length);
    expect(recordOf(computeDerived(after, after.settings.customDate), punk)).toEqual(before);
  });

  it('records a new result through the form', async () => {
    useStore.setState({ data: u, loaded: true });
    renderAt('/matches/new');
    const pickers = document.querySelectorAll('.picker');
    const pick = (i: number, name: string) => {
      const btn = [...pickers[i].querySelectorAll('.picker-option')].find((b) => b.textContent?.includes(name))!;
      fireEvent.click(btn);
    };
    await act(async () => pick(0, 'Drew McIntyre'));
    await act(async () => pick(1, 'Randy Orton'));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Randy Orton' })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save result' })));
    const after = useStore.getState().data!;
    expect(after.matches).toHaveLength(u.matches.length + 1);
    const rec = recordOf(computeDerived(after, after.settings.customDate), star(u, 'Randy Orton'));
    expect(rec.wins).toBe(1);
  });

  it('rejects invalid booking with a visible error', async () => {
    useStore.setState({ data: u, loaded: true });
    renderAt('/matches/new');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save result' })));
    expect(screen.getAllByText(/has no superstars/).length).toBeGreaterThan(0);
    expect(useStore.getState().data!.matches).toHaveLength(u.matches.length);
  });

  it('refuses to undo a title change whose reign was later ended, and shows the error', async () => {
    const whc = title(u, 'World Heavyweight Championship');
    const first = u.matches.find((m) => m.titleChanged && m.championshipIds.includes(whc))!;
    // Rollins later wins the title from Punk.
    const later = record(u, singles(u, 'Seth Rollins', 'CM Punk', '2026-06-20', 'a', { championshipIds: [whc], titleChanged: true }));
    expect(() => apply(later, (x) => saveMatch(x, { ...first, titleChanged: false }))).toThrow(/already ended/);

    useStore.setState({ data: later, loaded: true });
    renderAt(`/matches/${first.id}/edit`);
    await act(async () => fireEvent.click(screen.getByRole('checkbox', { name: /Title changes hands/ })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })));
    expect(screen.getByRole('alert').textContent).toMatch(/already ended/);
    expect(useStore.getState().data).toBe(later); // nothing was changed
  });
});
