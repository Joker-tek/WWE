import { X } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ALIGNMENT_LABEL, STATUS_LABEL, brandInfo, brandLabel } from '../domain/constants';
import type { Alignment, BrandKey, SuperstarStatus } from '../domain/schema';
import type { CompetitorRecord, Res } from '../domain/stats';
import { initials } from '../domain/util';

export function PageHeader({ title, sub, eyebrow, actions }: { title: ReactNode; sub?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="metal-text">{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div className="btn-group">{actions}</div>}
    </div>
  );
}

export function Card({ title, icon, actions, children, flush, className = '' }: { title?: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-header">
          <h2 className="card-title">
            {icon}
            {title}
          </h2>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div className={`card-body ${flush ? 'flush' : ''}`}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, foot, accent, to }: { label: string; value: ReactNode; foot?: ReactNode; accent?: boolean; to?: string }) {
  const body = (
    <div className={`stat ${accent ? 'accent' : ''} ${to ? 'card hoverable' : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {foot && <div className="foot">{foot}</div>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export function BrandBadge({ brand, context = 'roster' }: { brand: BrandKey; context?: 'roster' | 'event' }) {
  const info = brandInfo(brand);
  return (
    <span className={`badge badge-brand ${brand}`} style={{ background: info.color }}>
      {brandLabel(brand, context)}
    </span>
  );
}

export function AlignmentBadge({ alignment }: { alignment: Alignment }) {
  return <span className={`badge badge-${alignment}`}>{ALIGNMENT_LABEL[alignment]}</span>;
}

export function StatusBadge({ status, label }: { status: SuperstarStatus | string; label?: string }) {
  return <span className={`badge badge-${status}`}>{label ?? STATUS_LABEL[status as SuperstarStatus] ?? status}</span>;
}

export function Avatar({ name, src, size = 40, brand, square }: { name: string; src?: string; size?: number; brand?: BrandKey; square?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const color = brand ? brandInfo(brand).color : '#555';
  return (
    <span
      className={`avatar ${square ? 'square' : ''}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, ${color}, #15151b 120%)`,
        borderColor: brand ? `${color}88` : undefined,
      }}
      aria-hidden
    >
      {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : initials(name)}
    </span>
  );
}

export function ResultPill({ r }: { r: Res }) {
  return <span className={`res res-${r}`}>{r}</span>;
}

export function Form({ form }: { form: Res[] }) {
  if (!form.length) return <span className="muted small">No matches</span>;
  return (
    <span className="row" style={{ gap: 3 }} title="Most recent first">
      {form.map((r, i) => (
        <ResultPill key={i} r={r} />
      ))}
    </span>
  );
}

export function Streak({ rec }: { rec: CompetitorRecord }) {
  if (!rec.streak) return <span className="muted">—</span>;
  return (
    <span className={`strong streak-${rec.streak.type}`}>
      {rec.streak.type}
      {rec.streak.count}
    </span>
  );
}

export function RecordText({ rec }: { rec: CompetitorRecord }) {
  return (
    <span className="mono">
      {rec.wins}-{rec.losses}-{rec.draws}
    </span>
  );
}

export function Meter({ value, max = 10 }: { value: number; max?: number }) {
  return (
    <span className="meter" title={`${value}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < value ? `on ${value >= 8 ? 'hot' : ''}` : ''} />
      ))}
    </span>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="icon">{icon}</div>}
      <h3>{title}</h3>
      {text && <p className="small">{text}</p>}
      {action}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, size }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'wide' | 'narrow' }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size ?? ''}`} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn btn-ghost icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export interface TabDef<K extends string> {
  key: K;
  label: ReactNode;
  count?: number;
}

export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: TabDef<K>[]; value: K; onChange: (k: K) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} className={`tab ${value === t.key ? 'active' : ''}`} onClick={() => onChange(t.key)}>
          {t.label}
          {t.count !== undefined && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Chips<K extends string>({ options, value, onChange }: { options: { key: K; label: ReactNode }[]; value: K; onChange: (k: K) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o.key} className={`chip ${value === o.key ? 'active' : ''}`} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, error, children, className = '' }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`field ${className}`}>
      <label>{label}</label>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="error">{error}</span>}
    </div>
  );
}

// ---- Sortable table ---------------------------------------------------------

export interface Column<T> {
  key: string;
  label: ReactNode;
  render: (row: T, index: number) => ReactNode;
  sort?: (row: T) => number | string;
  num?: boolean;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  initialSort,
  empty,
  limit,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  empty?: ReactNode;
  limit?: number;
}) {
  const [sort, setSort] = useState(initialSort);
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sort || !sort) return rows;
    const get = col.sort;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, columns, sort]);
  if (!rows.length) return <>{empty ?? <Empty title="Nothing to show" />}</>;
  const visible = limit && !showAll ? sorted.slice(0, limit) : sorted;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`${c.sort ? 'sortable' : ''} ${c.num ? 'num' : ''}`}
                onClick={() => c.sort && setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))}
              >
                {c.label}
                {sort?.key === c.key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, i) => (
            <tr key={rowKey(row)} className={onRowClick ? 'clickable' : ''} onClick={() => onRowClick?.(row)}>
              {columns.map((c) => (
                <td key={c.key} className={`${c.num ? 'num' : ''} ${c.className ?? ''}`}>
                  {c.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {limit && rows.length > limit && (
        <div className="center" style={{ padding: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show less' : `Show all ${rows.length}`}
          </button>
        </div>
      )}
    </div>
  );
}
