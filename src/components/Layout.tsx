import {
  BarChart3,
  Brain,
  CalendarDays,
  Database,
  LayoutDashboard,
  Menu,
  Moon,
  Sparkles,
  Sun,
  Swords,
  Trophy,
  User,
  UserRound,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { BRANDS, brandLabel } from '../domain/constants';
import { formatDate, formatDateTime, matchesQuery } from '../domain/util';
import { mutate, reconnectFile, useData, useDerived, useStore } from '../store/store';
import { Avatar } from './ui';

export function Layout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const u = useData();
  useEffect(() => {
    document.documentElement.dataset.theme = u.settings.theme;
  }, [u.settings.theme]);

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Link to="/" className="sidebar-brand">
          <img src="./icon.svg" alt="" />
          <div>
            <div className="title metal-text">Universe</div>
            <div className="sub truncate" style={{ maxWidth: 170 }}>
              {u.meta.universeName}
            </div>
          </div>
        </Link>
        <nav className="nav">
          <NavLink to="/" end>
            <LayoutDashboard size={17} /> Dashboard
          </NavLink>
          <div className="nav-section">
            <div className="nav-label">Brands</div>
            {BRANDS.map((b) => (
              <NavLink key={b.key} to={`/brand/${b.key}`}>
                <span className="dot" style={{ background: b.color }} /> {b.name}
              </NavLink>
            ))}
          </div>
          <div className="nav-section">
            <div className="nav-label">Roster</div>
            <NavLink to="/roster/male">
              <User size={17} /> Men's Division
            </NavLink>
            <NavLink to="/roster/female">
              <UserRound size={17} /> Women's Division
            </NavLink>
            <NavLink to="/tag-teams">
              <Users size={17} /> Tag Teams
            </NavLink>
          </div>
          <div className="nav-section">
            <div className="nav-label">Booking</div>
            <NavLink to="/matches">
              <CalendarDays size={17} /> Matches
            </NavLink>
            <NavLink to="/matchmaker">
              <Brain size={17} /> Matchmaker
            </NavLink>
            <NavLink to="/rivalries">
              <Swords size={17} /> Rivalries
            </NavLink>
            <NavLink to="/storylines">
              <Sparkles size={17} /> Storylines
            </NavLink>
          </div>
          <div className="nav-section">
            <div className="nav-label">Records</div>
            <NavLink to="/championships">
              <Trophy size={17} /> Championships
            </NavLink>
            <NavLink to="/stats">
              <BarChart3 size={17} /> Stats & Rankings
            </NavLink>
            <NavLink to="/data">
              <Database size={17} /> Data & Backups
            </NavLink>
          </div>
        </nav>
        <SidebarFoot />
      </aside>
      <div className={`scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <GlobalSearch />
          <div className="spacer" />
          <SavePill />
          <button
            className="btn btn-ghost icon-btn"
            aria-label="Toggle theme"
            title="Toggle light / dark"
            onClick={() => mutate((x) => void (x.settings.theme = x.settings.theme === 'dark' ? 'light' : 'dark'))}
          >
            {u.settings.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>
        <main className="content">
          <Banners />
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarFoot() {
  const d = useDerived();
  const u = useData();
  return (
    <div className="sidebar-foot">
      <div className="row between">
        <span>Universe date</span>
        <Link to="/data#settings" className="strong" style={{ color: '#fff' }}>
          {formatDate(d.today)}
        </Link>
      </div>
      <div className="row between">
        <span>{u.superstars.length} superstars</span>
        <span>{d.completed.length} matches</span>
      </div>
    </div>
  );
}

function SavePill() {
  const { saveState, lastSavedAt, saveError, fileStatus } = useStore();
  const label = saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save failed' : 'Saved';
  return (
    <Link
      to="/data"
      className={`save-pill ${saveState} hide-sm`}
      title={saveState === 'error' ? saveError : `Saved in this browser ${formatDateTime(lastSavedAt)}${fileStatus === 'connected' ? ' and to your linked file' : ''}`}
    >
      <span className="led" /> {label}
      {fileStatus === 'connected' && ' + file'}
    </Link>
  );
}

function Banners() {
  const { loadWarnings, fileStatus, fileName, fileError, otherTabOpen, saveState, saveError } = useStore();
  return (
    <>
      {saveState === 'error' && (
        <div className="banner danger">
          <strong>Your changes could not be saved.</strong> <span className="grow">{saveError}</span>
          <Link className="btn btn-sm" to="/data">
            Download a backup
          </Link>
        </div>
      )}
      {fileStatus === 'needs-permission' && (
        <div className="banner info">
          <span className="grow">
            Auto-save to <strong>{fileName}</strong> is paused until you allow access again (browsers ask after a restart).
          </span>
          <button className="btn btn-sm btn-primary" onClick={() => void reconnectFile()}>
            Resume file auto-save
          </button>
        </div>
      )}
      {fileStatus === 'error' && (
        <div className="banner danger">
          <span className="grow">Could not write to the linked backup file: {fileError}</span>
          <Link className="btn btn-sm" to="/data">
            Fix in Data & Backups
          </Link>
        </div>
      )}
      {otherTabOpen && (
        <div className="banner warning">
          The tracker is open in another tab or window. Edit in one place only, or changes may overwrite each other.
        </div>
      )}
      {loadWarnings.length > 0 && (
        <div className="banner warning">
          <span className="grow">Data was repaired while loading: {loadWarnings.join(' ')}</span>
          <button className="btn btn-sm" onClick={() => useStore.setState({ loadWarnings: [] })}>
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}

interface Hit {
  group: string;
  to: string;
  label: string;
  sub: string;
  image?: string;
}

function GlobalSearch() {
  const u = useData();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const hits = useMemo<Hit[]>(() => {
    if (q.trim().length < 2) return [];
    const out: Hit[] = [];
    for (const s of u.superstars) if (matchesQuery(q, s.ringName, s.realName)) out.push({ group: 'Superstars', to: `/superstars/${s.id}`, label: s.ringName, sub: `${brandLabel(s.brand)} · ${s.gender === 'male' ? "Men's" : "Women's"}`, image: s.imageUrl });
    for (const t of u.tagTeams) if (matchesQuery(q, t.name)) out.push({ group: 'Tag teams', to: `/tag-teams/${t.id}`, label: t.name, sub: brandLabel(t.brand) });
    for (const c of u.championships) if (matchesQuery(q, c.name)) out.push({ group: 'Championships', to: `/championships/${c.id}`, label: c.name, sub: brandLabel(c.brand, 'event') });
    for (const r of u.rivalries) if (matchesQuery(q, r.name)) out.push({ group: 'Rivalries', to: `/rivalries/${r.id}`, label: r.name, sub: r.status });
    for (const s of u.storylines) if (matchesQuery(q, s.title)) out.push({ group: 'Storylines', to: `/storylines/${s.id}`, label: s.title, sub: s.status });
    return out.slice(0, 30);
  }, [q, u]);

  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const go = (h: Hit) => {
    nav(h.to);
    setQ('');
    setOpen(false);
  };

  let lastGroup = '';
  return (
    <div className="global-search search" ref={box}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        className="input"
        placeholder="Search superstars, teams, titles, rivalries…"
        value={q}
        onChange={(e) => (setQ(e.target.value), setOpen(true), setFocus(0))}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setFocus((f) => Math.min(f + 1, hits.length - 1)));
          if (e.key === 'ArrowUp') (e.preventDefault(), setFocus((f) => Math.max(f - 1, 0)));
          if (e.key === 'Enter' && hits[focus]) go(hits[focus]);
          if (e.key === 'Escape') setOpen(false);
        }}
        aria-label="Search"
      />
      {open && q.trim().length >= 2 && (
        <div className="search-pop">
          {!hits.length && <div className="muted small" style={{ padding: 12 }}>No results for “{q}”</div>}
          {hits.map((h, i) => {
            const header = h.group !== lastGroup ? <div className="group">{h.group}</div> : null;
            lastGroup = h.group;
            return (
              <div key={h.to}>
                {header}
                <a
                  href={`#${h.to}`}
                  className={i === focus ? 'focused' : ''}
                  onClick={(e) => (e.preventDefault(), go(h))}
                  onMouseEnter={() => setFocus(i)}
                >
                  <Avatar name={h.label} src={h.image} size={26} />
                  <span className="grow truncate">{h.label}</span>
                  <span className="muted tiny">{h.sub}</span>
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
