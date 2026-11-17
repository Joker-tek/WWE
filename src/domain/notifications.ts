import type { Universe } from './schema';
import { type Derived, holderName, reignDays } from './stats';
import { daysBetween, formatDate, plural, realToday } from './util';

export interface Notice {
  id: string;
  level: 'info' | 'warning' | 'danger' | 'success';
  title: string;
  text: string;
  link?: string;
}

export function buildNotices(u: Universe, d: Derived, lastFileWrite: string): Notice[] {
  const out: Notice[] = [];
  const today = d.today;

  const lastBackup = [u.meta.lastBackupAt, lastFileWrite].filter(Boolean).sort().pop();
  const backupAge = lastBackup ? daysBetween(lastBackup.slice(0, 10), realToday()) : Infinity;
  if (u.superstars.length && backupAge >= u.settings.backupReminderDays) {
    out.push({
      id: 'backup',
      level: 'danger',
      title: lastBackup ? `Last backup was ${backupAge} days ago` : 'No backup yet',
      text: 'Download a JSON backup or link an auto-save file so your universe is safe outside the browser.',
      link: '/data',
    });
  }

  const overdue = d.scheduled.filter((m) => m.date < today);
  if (overdue.length) {
    out.push({
      id: 'overdue',
      level: 'warning',
      title: `${plural(overdue.length, 'booked match', 'booked matches')} need results`,
      text: 'These matches are scheduled before the current universe date. Record their results.',
      link: '/matches?status=scheduled',
    });
  }
  const todays = d.scheduled.filter((m) => m.date === today);
  if (todays.length) {
    out.push({ id: 'today', level: 'info', title: `${plural(todays.length, 'match', 'matches')} booked for today`, text: 'Record results once the show is done.', link: '/matches?status=scheduled' });
  }

  const injured = u.superstars.filter((s) => s.status === 'injured');
  if (injured.length) {
    out.push({
      id: 'injured',
      level: 'warning',
      title: `${plural(injured.length, 'superstar')} injured`,
      text: injured.slice(0, 6).map((s) => s.ringName).join(', ') + (injured.length > 6 ? '…' : ''),
    });
  }
  const injuredChamps = injured.filter((s) => (d.heldTitles.get(s.id) ?? []).length);
  for (const s of injuredChamps) {
    out.push({
      id: `inj-champ-${s.id}`,
      level: 'danger',
      title: `${s.ringName} is injured while holding gold`,
      text: `Consider vacating the ${(d.heldTitles.get(s.id) ?? []).map((t) => t.name).join(' and ')} or booking an interim plan.`,
      link: `/superstars/${s.id}`,
    });
  }

  for (const c of u.championships) {
    if (!c.active) continue;
    const r = d.currentReign.get(c.id);
    if (!r) {
      out.push({ id: `vacant-${c.id}`, level: 'info', title: `${c.name} is vacant`, text: 'Crown a champion from the championship page or book a title match.', link: `/championships/${c.id}` });
      continue;
    }
    const days = reignDays(r, today);
    for (const milestone of [365, 100]) {
      if (days >= milestone && days < milestone + 7) {
        out.push({ id: `ms-${r.id}-${milestone}`, level: 'success', title: `${holderName(d, r)} passed ${milestone} days as champion`, text: `${c.name} reign began on ${formatDate(r.startDate)}.`, link: `/championships/${c.id}` });
        break;
      }
    }
  }

  for (const s of u.storylines) {
    if (s.status !== 'active') continue;
    for (const ev of s.plannedEvents) {
      if (ev.done || !ev.date) continue;
      const until = daysBetween(today, ev.date);
      if (until < 0) out.push({ id: `ev-${ev.id}`, level: 'warning', title: `Overdue storyline beat: ${ev.title}`, text: `“${s.title}”, planned for ${formatDate(ev.date)}.`, link: `/storylines/${s.id}` });
      else if (until <= 7) out.push({ id: `ev-${ev.id}`, level: 'info', title: `Upcoming storyline beat: ${ev.title}`, text: `“${s.title}”, ${until === 0 ? 'today' : `in ${plural(until, 'day')}`}.`, link: `/storylines/${s.id}` });
    }
  }

  const hot = u.rivalries.filter((r) => r.status === 'active' && r.intensity >= 9);
  for (const r of hot) {
    const booked = d.scheduled.some((m) => m.rivalryId === r.id);
    if (!booked) out.push({ id: `hot-${r.id}`, level: 'info', title: `“${r.name}” is at boiling point`, text: `Intensity ${r.intensity}/10 and no match booked yet.`, link: `/rivalries/${r.id}` });
  }
  const order = { danger: 0, warning: 1, info: 2, success: 3 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
