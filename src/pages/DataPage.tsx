import { Camera, Download, FileJson, FileSpreadsheet, HardDrive, Link2, Link2Off, RotateCcw, Save, Settings2, Share2, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFeedback, useMutation } from '../components/feedback';
import { Card, Field, Modal, PageHeader } from '../components/ui';
import { matchesCsv, reignsCsv, superstarsCsv, teamsCsv } from '../domain/csv';
import { type Universe, validateUniverse } from '../domain/schema';
import { universeToday } from '../domain/stats';
import { addDays, formatDate, formatDateTime, nowIso, plural, realToday } from '../domain/util';
import * as P from '../store/persistence';
import { disconnectFile, linkFile, mutate, reconnectFile, replaceUniverse, saveNow, useData, useDerived, useStore } from '../store/store';

export function DataPage() {
  const u = useData();
  const d = useDerived();
  const run = useMutation();
  const { toast, confirm } = useFeedback();
  const st = useStore();
  const [snaps, setSnaps] = useState<P.SnapshotMeta[]>([]);
  const [storage, setStorage] = useState<{ persisted: boolean | null; usage?: number; quota?: number }>({ persisted: null });
  const [preview, setPreview] = useState<{ data: Universe; warnings: string[]; fileName: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setSnaps(await P.listSnapshots());
      setStorage(await P.storageInfo());
    } catch {
      /* storage info is optional */
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (location.hash.includes('settings')) document.getElementById('settings')?.scrollIntoView();
  }, []);

  const markBackedUp = () => mutate((x) => void (x.meta.lastBackupAt = nowIso()));

  const download = () => {
    P.downloadBackup(u);
    markBackedUp();
    toast('Backup downloaded. Keep it somewhere safe (cloud drive, USB, email).');
  };

  const canShareFiles = typeof navigator !== 'undefined' && 'canShare' in navigator;
  const share = async () => {
    const file = new File([JSON.stringify(P.backupEnvelope(u))], P.backupFileName(u), { type: 'application/json' });
    if (!navigator.canShare?.({ files: [file] })) return toast('Sharing files is not supported in this browser. Use Download instead.', 'error');
    try {
      await navigator.share({ files: [file], title: 'WWE Universe backup' });
      markBackedUp();
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast((e as Error).message, 'error');
    }
  };

  const onImportFile = async (f: File) => {
    try {
      const res = validateUniverse(JSON.parse(await f.text()));
      if (!res.ok) return toast(`Not a valid backup: ${res.errors.join('; ')}`, 'error');
      setPreview({ data: res.data!, warnings: res.warnings, fileName: f.name });
    } catch {
      toast("That file couldn't be read as JSON.", 'error');
    }
  };

  const restore = async (data: Universe, label: string) => {
    await P.createSnapshot(u, `Before ${label}`);
    replaceUniverse(data);
    await saveNow();
    await refresh();
    toast(`Restored “${data.meta.universeName}”. Your previous data was saved as a snapshot.`);
  };

  const exportCsv = (name: string, csv: string) => P.downloadText(`${name}-${realToday()}.csv`, csv, 'text/csv');

  const fmtBytes = (n?: number) => (n === undefined ? '?' : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);
  const dataSize = new Blob([JSON.stringify(u)]).size;

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Data & Backups" sub="Your universe lives on this device. Back it up regularly." />

      <div className="grid grid-2 mb">
        <Card title="Storage status" icon={<ShieldCheck size={16} />}>
          <table className="table">
            <tbody>
              <tr>
                <td className="muted">Saved in this browser</td>
                <td className="num">{st.saveState === 'error' ? <span style={{ color: 'var(--danger)' }}>Failed: {st.saveError}</span> : formatDateTime(st.lastSavedAt || u.meta.updatedAt)}</td>
              </tr>
              <tr>
                <td className="muted">Protected from automatic cleanup</td>
                <td className="num">{storage.persisted === null ? 'Unknown' : storage.persisted ? 'Yes' : 'No (the browser may clear it under storage pressure, so keep backups)'}</td>
              </tr>
              <tr>
                <td className="muted">Universe size</td>
                <td className="num">{fmtBytes(dataSize)}</td>
              </tr>
              <tr>
                <td className="muted">Storage used / available</td>
                <td className="num">
                  {fmtBytes(storage.usage)} / {fmtBytes(storage.quota)}
                </td>
              </tr>
              <tr>
                <td className="muted">Last manual backup</td>
                <td className="num">{formatDateTime(u.meta.lastBackupAt)}</td>
              </tr>
              <tr>
                <td className="muted">Linked auto-save file</td>
                <td className="num">{st.fileStatus === 'connected' ? `${st.fileName} (written ${formatDateTime(st.fileWrittenAt)})` : st.fileStatus === 'unsupported' ? 'Not supported here' : st.fileStatus === 'needs-permission' ? 'Paused' : 'None'}</td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card title="Backup" icon={<FileJson size={16} />}>
          <div className="stack-sm">
            <p className="small muted">A full backup contains every superstar, title, reign, match, rivalry, storyline and picture. Restore it on any device with this app.</p>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={download}>
                <Download size={15} /> Download full backup
              </button>
              {canShareFiles && (
                <button className="btn" onClick={() => void share()}>
                  <Share2 size={15} /> Share / save to cloud
                </button>
              )}
              <button className="btn" onClick={() => fileRef.current?.click()}>
                <Upload size={15} /> Import / restore backup
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void onImportFile(f);
                }}
              />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-2 mb">
        <Card title="Auto-save to a file" icon={<HardDrive size={16} />}>
          {st.fileStatus === 'unsupported' ? (
            <p className="small muted">
              This browser can't write to files directly (supported in desktop Chrome and Edge). Use “Download full backup” regularly instead. On phones, “Share / save to cloud” can send the backup to Google Drive, iCloud or Files.
            </p>
          ) : (
            <div className="stack-sm">
              <p className="small muted">
                Pick a file on your computer (ideally in a synced folder like OneDrive, Dropbox or Google Drive). The whole universe is rewritten to it after every change, so your data lives outside the browser too.
              </p>
              <div className="btn-group">
                {st.fileStatus === 'none' && (
                  <button className="btn btn-primary" onClick={() => void linkFile().catch((e: Error) => e.name !== 'AbortError' && toast(e.message, 'error'))}>
                    <Link2 size={15} /> Choose auto-save file
                  </button>
                )}
                {(st.fileStatus === 'needs-permission' || st.fileStatus === 'error') && (
                  <button className="btn btn-primary" onClick={() => void reconnectFile()}>
                    <Save size={15} /> Resume auto-save
                  </button>
                )}
                {st.fileStatus !== 'none' && (
                  <>
                    <button className="btn" onClick={() => void linkFile().catch((e: Error) => e.name !== 'AbortError' && toast(e.message, 'error'))}>
                      <Link2 size={15} /> Choose a different file
                    </button>
                    <button className="btn btn-ghost" onClick={() => void disconnectFile().then(() => toast('Auto-save file unlinked', 'info'))}>
                      <Link2Off size={15} /> Unlink
                    </button>
                  </>
                )}
              </div>
              {st.fileError && <div className="form-error">{st.fileError}</div>}
            </div>
          )}
        </Card>

        <Card title="Export statistics" icon={<FileSpreadsheet size={16} />}>
          <p className="small muted mb">CSV files open in Excel, Google Sheets or Numbers.</p>
          <div className="btn-group">
            <button className="btn" onClick={() => exportCsv('superstars', superstarsCsv(u, d))}>
              Superstars & records
            </button>
            <button className="btn" onClick={() => exportCsv('matches', matchesCsv(u, d))}>
              Match history
            </button>
            <button className="btn" onClick={() => exportCsv('title-reigns', reignsCsv(u, d))}>
              Title reigns
            </button>
            <button className="btn" onClick={() => exportCsv('tag-teams', teamsCsv(u, d))}>
              Tag teams
            </button>
          </div>
        </Card>
      </div>

      <Card
        title="Snapshots"
        icon={<Camera size={16} />}
        className="mb"
        actions={
          <button className="btn btn-sm" onClick={async () => (await P.createSnapshot(u, 'Manual snapshot'), await refresh(), toast('Snapshot saved'))}>
            <Camera size={14} /> Take snapshot
          </button>
        }
        flush
      >
        <p className="small muted" style={{ padding: '12px 18px 0' }}>
          Restore points saved inside this browser: one automatically each day, plus before every import or restore. The newest 20 are kept. They don't replace downloaded backups.
        </p>
        {snaps.length ? (
          <div className="list">
            {snaps.map((s) => (
              <div key={s.id} className="list-item">
                <div className="grow">
                  <div className="strong">{s.label}</div>
                  <div className="tiny muted">
                    {formatDateTime(s.createdAt)} · {s.universeName} · {plural(s.counts.superstars, 'superstar')}, {plural(s.counts.matches, 'match', 'matches')}
                  </div>
                </div>
                <button
                  className="btn btn-sm"
                  onClick={async () => {
                    if (!(await confirm({ title: 'Restore this snapshot?', text: 'Your current data is snapshotted first, so you can switch back.', confirmLabel: 'Restore' }))) return;
                    const data = await P.readSnapshot(s.id);
                    if (!data) return toast('That snapshot could not be read.', 'error');
                    await restore(data, 'snapshot restore');
                  }}
                >
                  <RotateCcw size={14} /> Restore
                </button>
                <button className="btn btn-ghost btn-sm icon-btn" aria-label="Delete snapshot" onClick={async () => (await P.deleteSnapshot(s.id), await refresh())}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted small" style={{ padding: 18 }}>
            No snapshots yet.
          </div>
        )}
      </Card>

      <div id="settings">
        <Settings />
      </div>

      <Card title="Danger zone" className="mt">
        <div className="row wrap between">
          <p className="small muted grow">Delete this universe from the browser and start over. A snapshot is saved first, but download a backup if you want to keep it.</p>
          <button
            className="btn btn-danger"
            onClick={async () => {
              const ok = await confirm({ title: 'Delete the whole universe?', text: `“${u.meta.universeName}” will be removed from this browser. A snapshot is kept, and you can restore it from the welcome screen via a backup file only, so download one first.`, confirmLabel: 'Delete everything', danger: true });
              if (!ok) return;
              await P.createSnapshot(u, 'Before deleting universe');
              P.downloadBackup(u);
              await P.clearUniverse();
              useStore.setState({ data: null });
              void run;
            }}
          >
            <Trash2 size={15} /> Delete universe
          </button>
        </div>
      </Card>

      {preview && (
        <Modal
          title="Restore this backup?"
          onClose={() => setPreview(null)}
          footer={
            <>
              <button className="btn" onClick={() => setPreview(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  const p = preview;
                  setPreview(null);
                  await restore(p.data, `importing ${p.fileName}`);
                }}
              >
                Replace current universe
              </button>
            </>
          }
        >
          <div className="stack-sm">
            <p>
              <strong>{preview.data.meta.universeName}</strong> from <span className="muted">{preview.fileName}</span>
            </p>
            <p className="small muted">
              {plural(preview.data.superstars.length, 'superstar')} · {plural(preview.data.tagTeams.length, 'tag team')} · {plural(preview.data.championships.length, 'championship')} · {plural(preview.data.reigns.length, 'reign')} ·{' '}
              {plural(preview.data.matches.length, 'match', 'matches')} · {plural(preview.data.rivalries.length, 'rivalry', 'rivalries')} · {plural(preview.data.storylines.length, 'storyline')}
            </p>
            <p className="small muted">Last changed {formatDateTime(preview.data.meta.updatedAt)}</p>
            {preview.warnings.length > 0 && <div className="banner warning small">{preview.warnings.join(' ')}</div>}
            <div className="banner info small">Your current universe is saved as a snapshot first, so this can be undone.</div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Settings() {
  const u = useData();
  const run = useMutation();
  const [name, setName] = useState(u.meta.universeName);
  const s = u.settings;
  const set = (fn: (x: Universe) => void, msg = 'Settings saved') => run(fn, msg);
  return (
    <Card title="Universe settings" icon={<Settings2 size={16} />}>
      <div className="form-grid">
        <Field label="Universe name">
          <div className="row">
            <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn" disabled={!name.trim() || name === u.meta.universeName} onClick={() => set((x) => void (x.meta.universeName = name.trim()), 'Renamed')}>
              Save
            </button>
          </div>
        </Field>
        <Field label="Universe date" hint="Used for title reign lengths, defaults on new records and notifications">
          <select className="select" value={s.dateMode} onChange={(e) => set((x) => void (x.settings.dateMode = e.target.value as 'real' | 'custom'))}>
            <option value="real">Follow today's real date</option>
            <option value="custom">Custom in-universe calendar</option>
          </select>
        </Field>
        {s.dateMode === 'custom' && (
          <Field label={`Current universe date: ${formatDate(universeToday(u))}`}>
            <div className="row wrap">
              <input className="input" style={{ width: 170 }} type="date" value={s.customDate} onChange={(e) => e.target.value && set((x) => void (x.settings.customDate = e.target.value), 'Date updated')} />
              <button className="btn btn-sm" onClick={() => set((x) => void (x.settings.customDate = addDays(x.settings.customDate, 1)), 'Advanced 1 day')}>
                +1 day
              </button>
              <button className="btn btn-sm" onClick={() => set((x) => void (x.settings.customDate = addDays(x.settings.customDate, 7)), 'Advanced 1 week')}>
                +1 week
              </button>
            </div>
          </Field>
        )}
        <Field label="Minimum matches for win % leaderboard">
          <input className="input" type="number" min={0} value={s.minMatchesForPct} onChange={(e) => set((x) => void (x.settings.minMatchesForPct = Math.max(0, Number(e.target.value) || 0)))} />
        </Field>
        <Field label="Remind me to back up after (days)">
          <input className="input" type="number" min={1} value={s.backupReminderDays} onChange={(e) => set((x) => void (x.settings.backupReminderDays = Math.max(1, Number(e.target.value) || 1)))} />
        </Field>
        <Field label="Theme">
          <select className="select" value={s.theme} onChange={(e) => set((x) => void (x.settings.theme = e.target.value as 'dark' | 'light'))}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </Field>
        <Field label="Custom match types" className="span-all" hint="Created from the match form. Removing one here doesn't change existing matches.">
          <div className="chips">
            {u.customMatchTypes.map((t) => (
              <span key={t} className="picker-tag">
                {t}
                <button aria-label={`Remove ${t}`} onClick={() => set((x) => void (x.customMatchTypes = x.customMatchTypes.filter((y) => y !== t)), 'Match type removed')}>
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
            {!u.customMatchTypes.length && <span className="muted small">None yet</span>}
          </div>
        </Field>
      </div>
    </Card>
  );
}
