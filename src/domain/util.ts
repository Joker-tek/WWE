export function uid(prefix = ''): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return prefix ? `${prefix}_${rand}` : rand;
}

export const nowIso = () => new Date().toISOString();

export function realToday(): string {
  const d = new Date();
  return toIsoDate(d);
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.round((parseDate(b) - parseDate(a)) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const t = parseDate(iso) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y) return iso;
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function byText<T>(get: (x: T) => string) {
  return (a: T, b: T) => get(a).localeCompare(get(b));
}

export function matchesQuery(q: string, ...fields: (string | undefined)[]): boolean {
  if (!q.trim()) return true;
  const needle = q.trim().toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(needle));
}

/** Compare match chronology: date, then creation time. */
export function chrono<T extends { date: string; createdAt: string }>(a: T, b: T): number {
  return a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date);
}
