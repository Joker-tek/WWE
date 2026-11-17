import type { BrandKey, Championship, Division, Gender, Superstar, TagTeam, Universe } from './schema';
import { emptyUniverse } from './schema';
import { nowIso, uid } from './util';

/**
 * Optional starter roster so a new universe isn't empty. It reflects roughly the 2025
 * roster: edit, transfer or delete anyone. Championships start vacant so you can crown
 * your own champions.
 */

type Row = [ringName: string, brand: BrandKey, gender: Gender, alignment: 'face' | 'heel' | 'tweener', division: Division, popularity: number];

const ROSTER: Row[] = [
  // RAW men
  ['CM Punk', 'raw', 'male', 'face', 'main_event', 94],
  ['Seth Rollins', 'raw', 'male', 'heel', 'main_event', 90],
  ['Gunther', 'raw', 'male', 'heel', 'main_event', 86],
  ['Roman Reigns', 'raw', 'male', 'face', 'main_event', 96],
  ['Bron Breakker', 'raw', 'male', 'heel', 'upper_mid', 82],
  ['Bronson Reed', 'raw', 'male', 'heel', 'upper_mid', 70],
  ['Jey Uso', 'raw', 'male', 'face', 'upper_mid', 85],
  ['Dominik Mysterio', 'raw', 'male', 'heel', 'upper_mid', 80],
  ['Penta', 'raw', 'male', 'face', 'midcard', 78],
  ['Finn Bálor', 'raw', 'male', 'heel', 'midcard', 72],
  ['JD McDonagh', 'raw', 'male', 'heel', 'tag_specialist', 58],
  ['Rey Mysterio', 'raw', 'male', 'face', 'midcard', 76],
  ['Dragon Lee', 'raw', 'male', 'face', 'midcard', 62],
  ['AJ Styles', 'raw', 'male', 'face', 'upper_mid', 80],
  // RAW women
  ['Rhea Ripley', 'raw', 'female', 'face', 'main_event', 92],
  ['IYO SKY', 'raw', 'female', 'face', 'main_event', 84],
  ['Becky Lynch', 'raw', 'female', 'heel', 'main_event', 88],
  ['Stephanie Vaquer', 'raw', 'female', 'face', 'main_event', 82],
  ['Raquel Rodriguez', 'raw', 'female', 'heel', 'upper_mid', 64],
  ['Roxanne Perez', 'raw', 'female', 'heel', 'midcard', 66],
  ['Lyra Valkyria', 'raw', 'female', 'face', 'upper_mid', 70],
  ['Bayley', 'raw', 'female', 'tweener', 'upper_mid', 74],
  // SmackDown men
  ['Cody Rhodes', 'smackdown', 'male', 'face', 'main_event', 97],
  ['John Cena', 'smackdown', 'male', 'face', 'main_event', 95],
  ['Drew McIntyre', 'smackdown', 'male', 'heel', 'main_event', 84],
  ['Randy Orton', 'smackdown', 'male', 'face', 'main_event', 88],
  ['Solo Sikoa', 'smackdown', 'male', 'heel', 'upper_mid', 68],
  ['Jacob Fatu', 'smackdown', 'male', 'tweener', 'upper_mid', 80],
  ['Sami Zayn', 'smackdown', 'male', 'face', 'upper_mid', 84],
  ['LA Knight', 'smackdown', 'male', 'face', 'upper_mid', 83],
  ['Carmelo Hayes', 'smackdown', 'male', 'heel', 'midcard', 66],
  ['Damian Priest', 'smackdown', 'male', 'face', 'upper_mid', 75],
  ['Shinsuke Nakamura', 'smackdown', 'male', 'heel', 'midcard', 64],
  ['Aleister Black', 'smackdown', 'male', 'heel', 'midcard', 67],
  // SmackDown women
  ['Tiffany Stratton', 'smackdown', 'female', 'face', 'main_event', 85],
  ['Jade Cargill', 'smackdown', 'female', 'face', 'main_event', 80],
  ['Nia Jax', 'smackdown', 'female', 'heel', 'upper_mid', 66],
  ['Charlotte Flair', 'smackdown', 'female', 'face', 'main_event', 86],
  ['Alexa Bliss', 'smackdown', 'female', 'face', 'upper_mid', 79],
  ['Giulia', 'smackdown', 'female', 'heel', 'upper_mid', 70],
  ['Chelsea Green', 'smackdown', 'female', 'heel', 'midcard', 72],
  ['Naomi', 'smackdown', 'female', 'heel', 'upper_mid', 73],
  // NXT men
  ['Oba Femi', 'nxt', 'male', 'face', 'main_event', 80],
  ['Trick Williams', 'nxt', 'male', 'tweener', 'main_event', 78],
  ['Ricky Saints', 'nxt', 'male', 'face', 'upper_mid', 72],
  ['Je’Von Evans', 'nxt', 'male', 'face', 'upper_mid', 70],
  ['Ethan Page', 'nxt', 'male', 'heel', 'upper_mid', 66],
  ['Tony D’Angelo', 'nxt', 'male', 'face', 'midcard', 64],
  // NXT women
  ['Jacy Jayne', 'nxt', 'female', 'heel', 'main_event', 68],
  ['Jordynne Grace', 'nxt', 'female', 'face', 'main_event', 72],
  ['Sol Ruca', 'nxt', 'female', 'face', 'upper_mid', 74],
  ['Kelani Jordan', 'nxt', 'female', 'face', 'midcard', 62],
  ['Lash Legend', 'nxt', 'female', 'heel', 'upper_mid', 62],
  ['Fallon Henley', 'nxt', 'female', 'heel', 'midcard', 60],
];

type TitleRow = [name: string, brand: BrandKey, gender: Gender, type: 'singles' | 'tag', tier: Championship['tier']];
const TITLES: TitleRow[] = [
  ['World Heavyweight Championship', 'raw', 'male', 'singles', 'world'],
  ["Women's World Championship", 'raw', 'female', 'singles', 'world'],
  ['Intercontinental Championship', 'raw', 'male', 'singles', 'secondary'],
  ["Women's Intercontinental Championship", 'raw', 'female', 'singles', 'secondary'],
  ['World Tag Team Championship', 'raw', 'male', 'tag', 'secondary'],
  ['Undisputed WWE Championship', 'smackdown', 'male', 'singles', 'world'],
  ["WWE Women's Championship", 'smackdown', 'female', 'singles', 'world'],
  ['United States Championship', 'smackdown', 'male', 'singles', 'secondary'],
  ["Women's United States Championship", 'smackdown', 'female', 'singles', 'secondary'],
  ['WWE Tag Team Championship', 'smackdown', 'male', 'tag', 'secondary'],
  ["WWE Women's Tag Team Championship", 'none', 'female', 'tag', 'secondary'],
  ['NXT Championship', 'nxt', 'male', 'singles', 'world'],
  ["NXT Women's Championship", 'nxt', 'female', 'singles', 'world'],
  ['NXT North American Championship', 'nxt', 'male', 'singles', 'secondary'],
  ["NXT Women's North American Championship", 'nxt', 'female', 'singles', 'secondary'],
  ['NXT Tag Team Championship', 'nxt', 'male', 'tag', 'secondary'],
];

const TEAMS: [name: string, brand: BrandKey, gender: Gender, members: string[]][] = [
  ['The Judgment Day', 'raw', 'male', ['Finn Bálor', 'JD McDonagh']],
  ['The LWO', 'raw', 'male', ['Rey Mysterio', 'Dragon Lee']],
];

export function starterUniverse(name: string): Universe {
  const u = emptyUniverse(name);
  const now = nowIso();
  const byName = new Map<string, Superstar>();
  for (const [ringName, brand, gender, alignment, division, popularity] of ROSTER) {
    const s: Superstar = {
      id: uid('star'),
      ringName,
      realName: '',
      imageUrl: '',
      brand,
      gender,
      alignment,
      division,
      status: 'active',
      popularity,
      hometown: '',
      height: '',
      weight: '',
      finisher: '',
      debutDate: '',
      notes: '',
      career: [],
      createdAt: now,
      updatedAt: now,
    };
    byName.set(ringName, s);
    u.superstars.push(s);
  }
  TITLES.forEach(([tName, brand, gender, type, tier], i) => {
    u.championships.push({ id: uid('title'), name: tName, brand, gender, type, tier, active: true, description: '', order: i, createdAt: now });
  });
  for (const [tName, brand, gender, members] of TEAMS) {
    const team: TagTeam = {
      id: uid('team'),
      name: tName,
      memberIds: members.map((m) => byName.get(m)!.id),
      brand,
      gender,
      status: 'active',
      formedDate: '',
      disbandedDate: '',
      imageUrl: '',
      notes: '',
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    u.tagTeams.push(team);
  }
  return u;
}
