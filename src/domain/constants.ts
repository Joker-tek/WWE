import type { Alignment, BrandKey, Division, Gender, SuperstarStatus } from './schema';

export interface BrandInfo {
  key: BrandKey;
  name: string;
  short: string;
  color: string;
}

export const BRANDS: BrandInfo[] = [
  { key: 'raw', name: 'WWE RAW', short: 'RAW', color: '#e4002b' },
  { key: 'smackdown', name: 'WWE SmackDown', short: 'SmackDown', color: '#1f5bff' },
  { key: 'nxt', name: 'WWE NXT', short: 'NXT', color: '#f5c518' },
];
export const MAIN_BRANDS = BRANDS.map((b) => b.key);

const NONE_BRAND: BrandInfo = { key: 'none', name: 'Unassigned', short: 'Unassigned', color: '#8a8f98' };

export function brandInfo(key: BrandKey): BrandInfo {
  return BRANDS.find((b) => b.key === key) ?? NONE_BRAND;
}

/** Label for 'none' depends on context: a superstar is a free agent, a title or match is cross-brand. */
export function brandLabel(key: BrandKey, context: 'roster' | 'event' = 'roster'): string {
  if (key === 'none') return context === 'roster' ? 'Free Agent' : 'Cross-brand';
  return brandInfo(key).short;
}

export const GENDER_LABEL: Record<Gender, string> = { male: "Men's", female: "Women's" };
export const ALIGNMENT_LABEL: Record<Alignment, string> = { face: 'Face', heel: 'Heel', tweener: 'Tweener' };
export const STATUS_LABEL: Record<SuperstarStatus, string> = {
  active: 'Active',
  injured: 'Injured',
  released: 'Released',
  inactive: 'Inactive',
};
export const DIVISION_LABEL: Record<Division, string> = {
  main_event: 'Main Event',
  upper_mid: 'Upper Midcard',
  midcard: 'Midcard',
  lower_card: 'Lower Card',
  tag_specialist: 'Tag Team Specialist',
};
/** Numeric weight of a card position, used by rankings and the matchmaker. */
export const DIVISION_WEIGHT: Record<Division, number> = {
  main_event: 4,
  upper_mid: 3,
  midcard: 2,
  lower_card: 1,
  tag_specialist: 2,
};

export const TIER_LABEL = { world: 'World Title', secondary: 'Secondary Title', tertiary: 'Tertiary Title', other: 'Other' };

export interface MatchTypeDef {
  key: string;
  label: string;
  /** Default number of sides. */
  sides: number;
  /** Default competitors per side. */
  perSide: number;
  /** Every competitor for themselves (battle royal style): one entrant list, one winner. */
  freeForAll?: boolean;
  /** Suggests a blow-off / grudge stipulation. */
  stipulation?: boolean;
}

export const MATCH_TYPES: MatchTypeDef[] = [
  { key: 'singles', label: 'Singles', sides: 2, perSide: 1 },
  { key: 'tag', label: 'Tag Team', sides: 2, perSide: 2 },
  { key: 'six_man_tag', label: '6-Person Tag', sides: 2, perSide: 3 },
  { key: 'triple_threat', label: 'Triple Threat', sides: 3, perSide: 1 },
  { key: 'fatal_4_way', label: 'Fatal 4-Way', sides: 4, perSide: 1 },
  { key: 'tag_triple_threat', label: 'Triple Threat Tag', sides: 3, perSide: 2 },
  { key: 'battle_royal', label: 'Battle Royal', sides: 0, perSide: 1, freeForAll: true },
  { key: 'royal_rumble', label: 'Royal Rumble', sides: 0, perSide: 1, freeForAll: true },
  { key: 'ladder', label: 'Ladder Match', sides: 2, perSide: 1, stipulation: true },
  { key: 'tlc', label: 'Tables, Ladders & Chairs', sides: 2, perSide: 1, stipulation: true },
  { key: 'steel_cage', label: 'Steel Cage', sides: 2, perSide: 1, stipulation: true },
  { key: 'hell_in_a_cell', label: 'Hell in a Cell', sides: 2, perSide: 1, stipulation: true },
  { key: 'elimination_chamber', label: 'Elimination Chamber', sides: 6, perSide: 1, stipulation: true },
  { key: 'elimination_tag', label: 'Elimination Tag', sides: 2, perSide: 4 },
  { key: 'war_games', label: 'WarGames', sides: 2, perSide: 4, stipulation: true },
  { key: 'last_man_standing', label: 'Last Man Standing', sides: 2, perSide: 1, stipulation: true },
  { key: 'no_dq', label: 'No Disqualification', sides: 2, perSide: 1, stipulation: true },
  { key: 'street_fight', label: 'Street Fight', sides: 2, perSide: 1, stipulation: true },
  { key: 'i_quit', label: 'I Quit', sides: 2, perSide: 1, stipulation: true },
  { key: 'iron_man', label: 'Iron Man / Iron Woman', sides: 2, perSide: 1, stipulation: true },
  { key: 'mixed_tag', label: 'Mixed Tag', sides: 2, perSide: 2 },
];

export function matchTypeDef(key: string): MatchTypeDef {
  return MATCH_TYPES.find((m) => m.key === key) ?? { key, label: key, sides: 2, perSide: 1 };
}

export function matchTypeLabel(key: string): string {
  return matchTypeDef(key).label;
}

export const FINISHES = [
  'Pinfall',
  'Submission',
  'Knockout / Referee stoppage',
  'Disqualification',
  'Count-out',
  'Over the top rope',
  'Elimination',
  'Retrieved the object',
  'Escape',
  'Time-limit draw',
  'Double count-out',
  'Double DQ',
  'Interference / No contest',
  'Forfeit',
  'Other',
];

export const OUTCOME_LABEL = { win: 'Winner decided', draw: 'Draw', no_contest: 'No Contest' };

export const RIVALRY_STATUS_LABEL = { planned: 'Planned', active: 'Active', paused: 'Paused', ended: 'Ended' };
export const STORYLINE_STATUS_LABEL = {
  planning: 'Planning',
  active: 'Active',
  paused: 'Paused',
  concluded: 'Concluded',
  cancelled: 'Cancelled',
};

export const EVENT_SUGGESTIONS = [
  'Monday Night RAW',
  'Friday Night SmackDown',
  'NXT',
  'Saturday Night’s Main Event',
  'Royal Rumble',
  'Elimination Chamber',
  'WrestleMania',
  'Backlash',
  'King & Queen of the Ring',
  'Money in the Bank',
  'SummerSlam',
  'Clash in Paris',
  'Crown Jewel',
  'Survivor Series',
  'NXT Stand & Deliver',
  'NXT Deadline',
  'NXT Halloween Havoc',
];
