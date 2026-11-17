import { ImagePlus, Search, Trash2, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { brandLabel } from '../domain/constants';
import type { BrandKey, CompetitorRef, Gender, Superstar, TagTeam } from '../domain/schema';
import { matchesQuery } from '../domain/util';
import { useData } from '../store/store';
import { Avatar } from './ui';

interface PickerFilter {
  gender?: Gender | 'all';
  brand?: BrandKey | 'all';
  includeInactive?: boolean;
  exclude?: string[];
}

function sortStars(list: Superstar[], brand?: BrandKey | 'all') {
  return [...list].sort((a, b) => {
    if (brand && brand !== 'all') {
      const pa = a.brand === brand ? 0 : 1;
      const pb = b.brand === brand ? 0 : 1;
      if (pa !== pb) return pa - pb;
    }
    return a.ringName.localeCompare(b.ringName);
  });
}

/** Searchable multi-select for superstars. Brand filter only ranks the brand first; other brands remain selectable. */
export function SuperstarPicker({
  value,
  onChange,
  filter = {},
  max,
  placeholder = 'Search superstars…',
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  filter?: PickerFilter;
  max?: number;
  placeholder?: string;
}) {
  const u = useData();
  const [q, setQ] = useState('');
  const options = useMemo(() => {
    const list = u.superstars.filter(
      (s) =>
        (filter.includeInactive || s.status === 'active' || value.includes(s.id)) &&
        (!filter.gender || filter.gender === 'all' || s.gender === filter.gender) &&
        !filter.exclude?.includes(s.id) &&
        matchesQuery(q, s.ringName, s.realName),
    );
    return sortStars(list, filter.brand);
  }, [u.superstars, filter.gender, filter.brand, filter.includeInactive, filter.exclude, q, value]);
  const byId = new Map(u.superstars.map((s) => [s.id, s]));
  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else if (max === 1) onChange([id]);
    else if (!max || value.length < max) onChange([...value, id]);
  };
  return (
    <div className="picker">
      <div className="picker-selected">
        {value.length === 0 && <span className="muted small">Nobody selected</span>}
        {value.map((id) => (
          <span key={id} className="picker-tag">
            {byId.get(id)?.ringName ?? 'Unknown'}
            <button type="button" onClick={() => toggle(id)} aria-label="Remove">
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
      <input className="input picker-search" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="picker-list">
        {options.map((s) => (
          <button type="button" key={s.id} className={`picker-option ${value.includes(s.id) ? 'selected' : ''}`} onClick={() => toggle(s.id)}>
            <Avatar name={s.ringName} src={s.imageUrl} brand={s.brand} size={26} />
            <span className="grow truncate">{s.ringName}</span>
            <span className="muted tiny">
              {brandLabel(s.brand)} · {s.gender === 'male' ? 'M' : 'W'}
              {s.status !== 'active' ? ` · ${s.status}` : ''}
            </span>
          </button>
        ))}
        {!options.length && <div className="muted small" style={{ padding: 10 }}>No matches</div>}
      </div>
    </div>
  );
}

/** Multi-select for superstars and tag teams (rivalries). */
export function CompetitorPicker({ value, onChange, brand, gender }: { value: CompetitorRef[]; onChange: (v: CompetitorRef[]) => void; brand?: BrandKey | 'all'; gender?: Gender | 'all' }) {
  const u = useData();
  const [q, setQ] = useState('');
  const has = (r: CompetitorRef) => value.some((v) => v.type === r.type && v.id === r.id);
  const toggle = (r: CompetitorRef) => onChange(has(r) ? value.filter((v) => !(v.type === r.type && v.id === r.id)) : [...value, r]);
  const g = (x: { gender: Gender }) => !gender || gender === 'all' || x.gender === gender;
  const teams = u.tagTeams.filter((t) => g(t) && matchesQuery(q, t.name) && (t.status === 'active' || has({ type: 'team', id: t.id })));
  const stars = sortStars(
    u.superstars.filter((s) => g(s) && matchesQuery(q, s.ringName) && (s.status !== 'released' || has({ type: 'superstar', id: s.id }))),
    brand,
  );
  const name = (r: CompetitorRef) => (r.type === 'team' ? u.tagTeams.find((t) => t.id === r.id)?.name : u.superstars.find((s) => s.id === r.id)?.ringName) ?? 'Unknown';
  return (
    <div className="picker">
      <div className="picker-selected">
        {!value.length && <span className="muted small">Pick two or more superstars or teams</span>}
        {value.map((r) => (
          <span key={r.type + r.id} className="picker-tag">
            {r.type === 'team' && <span className="badge" style={{ height: 18 }}>Team</span>}
            {name(r)}
            <button type="button" onClick={() => toggle(r)} aria-label="Remove">
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
      <input className="input picker-search" placeholder="Search superstars and teams…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="picker-list">
        {teams.map((t: TagTeam) => (
          <button type="button" key={t.id} className={`picker-option ${has({ type: 'team', id: t.id }) ? 'selected' : ''}`} onClick={() => toggle({ type: 'team', id: t.id })}>
            <Avatar name={t.name} src={t.imageUrl} brand={t.brand} size={26} square />
            <span className="grow truncate">{t.name}</span>
            <span className="muted tiny">Team · {brandLabel(t.brand)}</span>
          </button>
        ))}
        {stars.map((s) => (
          <button type="button" key={s.id} className={`picker-option ${has({ type: 'superstar', id: s.id }) ? 'selected' : ''}`} onClick={() => toggle({ type: 'superstar', id: s.id })}>
            <Avatar name={s.ringName} src={s.imageUrl} brand={s.brand} size={26} />
            <span className="grow truncate">{s.ringName}</span>
            <span className="muted tiny">{brandLabel(s.brand)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Shrinks an uploaded image to a small JPEG data URL so backups stay compact. */
export async function resizeImage(file: File, max = 320): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That file is not a readable image.'));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ImageInput({ value, onChange, name }: { value: string; onChange: (v: string) => void; name: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <Avatar name={name || '?'} src={value} size={72} />
      <div className="stack-sm grow">
        <div className="btn-group">
          <button type="button" className="btn btn-sm" onClick={() => ref.current?.click()}>
            <ImagePlus size={15} /> Upload picture
          </button>
          {value && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange('')}>
              <Trash2 size={15} /> Remove
            </button>
          )}
        </div>
        <input
          className="input"
          placeholder="…or paste an image URL"
          value={value.startsWith('data:') ? '' : value}
          onChange={(e) => onChange(e.target.value.trim())}
        />
        {value.startsWith('data:') && <span className="hint small muted">Uploaded image (stored in your universe data)</span>}
        {error && <span className="error small">{error}</span>}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              setError('');
              onChange(await resizeImage(f));
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        />
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="search">
      <Search size={15} />
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
