import { z } from 'zod';

/**
 * Single source of truth for the data model.
 * The zod schemas validate imported backups (and fill defaults for fields added
 * in later versions), and the TypeScript types are inferred from them.
 *
 * Design rule: win/loss records, streaks and title-reign lengths are never stored.
 * They are always derived from matches and reigns (see stats.ts), so editing or
 * deleting a match can never double-count statistics.
 */

export const SCHEMA_VERSION = 1;

const id = z.string().min(1);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date');

export const BrandKey = z.enum(['raw', 'smackdown', 'nxt', 'none']);
export const Gender = z.enum(['male', 'female']);
export const Alignment = z.enum(['face', 'heel', 'tweener']);
export const SuperstarStatus = z.enum(['active', 'injured', 'released', 'inactive']);
export const Division = z.enum(['main_event', 'upper_mid', 'midcard', 'lower_card', 'tag_specialist']);

export const LogEntry = z.object({
  id,
  date: isoDate,
  title: z.string().default(''),
  text: z.string().default(''),
  matchId: z.string().optional(),
});

export const Superstar = z.object({
  id,
  ringName: z.string().min(1),
  realName: z.string().default(''),
  imageUrl: z.string().default(''),
  brand: BrandKey,
  gender: Gender,
  division: Division.default('midcard'),
  alignment: Alignment.default('face'),
  status: SuperstarStatus.default('active'),
  popularity: z.number().min(1).max(100).default(50),
  hometown: z.string().default(''),
  height: z.string().default(''),
  weight: z.string().default(''),
  finisher: z.string().default(''),
  debutDate: z.string().default(''),
  notes: z.string().default(''),
  career: z.array(LogEntry).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TagTeam = z.object({
  id,
  name: z.string().min(1),
  memberIds: z.array(id).default([]),
  brand: BrandKey,
  gender: Gender,
  status: z.enum(['active', 'inactive', 'disbanded']).default('active'),
  formedDate: z.string().default(''),
  disbandedDate: z.string().default(''),
  imageUrl: z.string().default(''),
  notes: z.string().default(''),
  history: z.array(LogEntry).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const Championship = z.object({
  id,
  name: z.string().min(1),
  brand: BrandKey,
  gender: Gender,
  type: z.enum(['singles', 'tag']),
  tier: z.enum(['world', 'secondary', 'tertiary', 'other']).default('secondary'),
  active: z.boolean().default(true),
  description: z.string().default(''),
  order: z.number().default(0),
  createdAt: z.string(),
});

export const HolderType = z.enum(['superstar', 'team']);

export const Reign = z.object({
  id,
  championshipId: id,
  holderType: HolderType,
  holderId: id,
  /** Superstars who held the title in this reign (the holder, or the team's members at the time). */
  memberIds: z.array(id).default([]),
  startDate: isoDate,
  endDate: isoDate.nullable().default(null),
  wonAtMatchId: z.string().optional(),
  lostAtMatchId: z.string().optional(),
  notes: z.string().default(''),
});

export const MatchSide = z.object({
  id,
  teamId: z.string().optional(),
  superstarIds: z.array(id).min(1),
});

export const Match = z.object({
  id,
  status: z.enum(['scheduled', 'completed']),
  date: isoDate,
  brand: BrandKey,
  eventName: z.string().default(''),
  matchType: z.string().min(1),
  sides: z.array(MatchSide).min(2),
  outcome: z.enum(['win', 'draw', 'no_contest']).default('win'),
  winnerSideId: z.string().optional(),
  finish: z.string().default(''),
  result: z.string().default(''),
  duration: z.string().default(''),
  rating: z.number().min(0).max(5).optional(),
  championshipIds: z.array(id).default([]),
  titleChanged: z.boolean().default(false),
  rivalryId: z.string().optional(),
  storylineId: z.string().optional(),
  notes: z.string().default(''),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CompetitorRef = z.object({ type: HolderType, id });

export const Rivalry = z.object({
  id,
  name: z.string().min(1),
  brand: BrandKey,
  participants: z.array(CompetitorRef).min(2),
  status: z.enum(['planned', 'active', 'paused', 'ended']).default('active'),
  intensity: z.number().min(1).max(10).default(5),
  startDate: isoDate,
  endDate: z.string().default(''),
  description: z.string().default(''),
  history: z.array(LogEntry).default([]),
  winner: CompetitorRef.nullable().default(null),
  outcome: z.string().default(''),
  storylineId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PlannedEvent = z.object({
  id,
  date: z.string().default(''),
  title: z.string().min(1),
  description: z.string().default(''),
  done: z.boolean().default(false),
});

export const Storyline = z.object({
  id,
  title: z.string().min(1),
  description: z.string().default(''),
  length: z.enum(['short', 'long']).default('short'),
  brand: BrandKey,
  superstarIds: z.array(id).default([]),
  teamIds: z.array(id).default([]),
  status: z.enum(['planning', 'active', 'paused', 'concluded', 'cancelled']).default('active'),
  currentChapter: z.string().default(''),
  startDate: isoDate,
  endDate: z.string().default(''),
  plannedEvents: z.array(PlannedEvent).default([]),
  moments: z.array(LogEntry).default([]),
  outcome: z.string().default(''),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const Transfer = z.object({
  id,
  entityType: HolderType.default('superstar'),
  entityId: id,
  fromBrand: BrandKey,
  toBrand: BrandKey,
  date: isoDate,
  note: z.string().default(''),
});

export const Settings = z.object({
  dateMode: z.enum(['real', 'custom']).default('real'),
  customDate: isoDate.default(new Date().toISOString().slice(0, 10)),
  theme: z.enum(['dark', 'light']).default('dark'),
  minMatchesForPct: z.number().min(0).default(3),
  backupReminderDays: z.number().min(1).default(7),
});

export const Universe = z.object({
  schemaVersion: z.number().default(SCHEMA_VERSION),
  meta: z.object({
    universeName: z.string().default('My WWE Universe'),
    createdAt: z.string(),
    updatedAt: z.string(),
    lastBackupAt: z.string().default(''),
  }),
  settings: Settings.default(Settings.parse({})),
  superstars: z.array(Superstar).default([]),
  tagTeams: z.array(TagTeam).default([]),
  championships: z.array(Championship).default([]),
  reigns: z.array(Reign).default([]),
  matches: z.array(Match).default([]),
  rivalries: z.array(Rivalry).default([]),
  storylines: z.array(Storyline).default([]),
  transfers: z.array(Transfer).default([]),
  customMatchTypes: z.array(z.string()).default([]),
});

export type BrandKey = z.infer<typeof BrandKey>;
export type Gender = z.infer<typeof Gender>;
export type Alignment = z.infer<typeof Alignment>;
export type SuperstarStatus = z.infer<typeof SuperstarStatus>;
export type Division = z.infer<typeof Division>;
export type HolderType = z.infer<typeof HolderType>;
export type LogEntry = z.infer<typeof LogEntry>;
export type Superstar = z.infer<typeof Superstar>;
export type TagTeam = z.infer<typeof TagTeam>;
export type Championship = z.infer<typeof Championship>;
export type Reign = z.infer<typeof Reign>;
export type MatchSide = z.infer<typeof MatchSide>;
export type Match = z.infer<typeof Match>;
export type CompetitorRef = z.infer<typeof CompetitorRef>;
export type Rivalry = z.infer<typeof Rivalry>;
export type PlannedEvent = z.infer<typeof PlannedEvent>;
export type Storyline = z.infer<typeof Storyline>;
export type Transfer = z.infer<typeof Transfer>;
export type Settings = z.infer<typeof Settings>;
export type Universe = z.infer<typeof Universe>;

export function emptyUniverse(name = 'My WWE Universe'): Universe {
  const now = new Date().toISOString();
  return Universe.parse({ meta: { universeName: name, createdAt: now, updatedAt: now } });
}

export interface ValidationResult {
  ok: boolean;
  data?: Universe;
  errors: string[];
  warnings: string[];
}

/** Validate an unknown JSON value (e.g. an imported backup) and repair broken references. */
export function validateUniverse(raw: unknown): ValidationResult {
  // Backups are wrapped in an envelope: { app, exportedAt, data }. Accept bare data too.
  const candidate =
    raw && typeof raw === 'object' && 'data' in raw && (raw as { app?: string }).app === 'wwe-universe-tracker'
      ? (raw as { data: unknown }).data
      : raw;
  const parsed = Universe.safeParse(candidate);
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 12).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    return { ok: false, errors, warnings: [] };
  }
  const data = parsed.data;
  const warnings: string[] = [];
  if (data.schemaVersion > SCHEMA_VERSION) {
    warnings.push(`Backup was made by a newer app version (schema ${data.schemaVersion}). Unknown fields are ignored.`);
  }
  repairReferences(data, warnings);
  data.schemaVersion = SCHEMA_VERSION;
  return { ok: true, data, errors: [], warnings };
}

function repairReferences(u: Universe, warnings: string[]) {
  const stars = new Set(u.superstars.map((s) => s.id));
  const teams = new Set(u.tagTeams.map((t) => t.id));
  const titles = new Set(u.championships.map((c) => c.id));
  const rivals = new Set(u.rivalries.map((r) => r.id));
  const stories = new Set(u.storylines.map((s) => s.id));
  const dupes = (arr: { id: string }[], label: string) => {
    const seen = new Set<string>();
    for (const x of arr) {
      if (seen.has(x.id)) warnings.push(`Duplicate ${label} id "${x.id}" found.`);
      seen.add(x.id);
    }
  };
  dupes(u.superstars, 'superstar');
  dupes(u.matches, 'match');

  const beforeMatches = u.matches.length;
  u.matches = u.matches.filter((m) => m.sides.every((s) => s.superstarIds.every((x) => stars.has(x))));
  if (u.matches.length !== beforeMatches) {
    warnings.push(`${beforeMatches - u.matches.length} match(es) referenced missing superstars and were skipped.`);
  }
  for (const m of u.matches) {
    for (const s of m.sides) if (s.teamId && !teams.has(s.teamId)) delete s.teamId;
    m.championshipIds = m.championshipIds.filter((c) => titles.has(c));
    if (m.rivalryId && !rivals.has(m.rivalryId)) delete m.rivalryId;
    if (m.storylineId && !stories.has(m.storylineId)) delete m.storylineId;
    if (m.winnerSideId && !m.sides.some((s) => s.id === m.winnerSideId)) delete m.winnerSideId;
  }
  const beforeReigns = u.reigns.length;
  u.reigns = u.reigns.filter(
    (r) => titles.has(r.championshipId) && (r.holderType === 'superstar' ? stars.has(r.holderId) : teams.has(r.holderId)),
  );
  if (u.reigns.length !== beforeReigns) {
    warnings.push(`${beforeReigns - u.reigns.length} title reign(s) referenced missing records and were skipped.`);
  }
  for (const t of u.tagTeams) t.memberIds = t.memberIds.filter((x) => stars.has(x));
  const refOk = (r: CompetitorRef) => (r.type === 'superstar' ? stars.has(r.id) : teams.has(r.id));
  for (const r of u.rivalries) {
    r.participants = r.participants.filter(refOk);
    if (r.winner && !refOk(r.winner)) r.winner = null;
    if (r.storylineId && !stories.has(r.storylineId)) delete r.storylineId;
  }
  for (const s of u.storylines) {
    s.superstarIds = s.superstarIds.filter((x) => stars.has(x));
    s.teamIds = s.teamIds.filter((x) => teams.has(x));
  }
}
