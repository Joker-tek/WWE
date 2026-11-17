import { createStore, del, entries, get, set } from 'idb-keyval';
import { SCHEMA_VERSION, validateUniverse, type Universe } from '../domain/schema';
import { nowIso, realToday, uid } from '../domain/util';

/*
 * Storage layers:
 *  1. IndexedDB (primary, survives restarts; we request "persistent" storage so the browser won't evict it).
 *  2. Optional linked JSON file on disk (File System Access API, desktop Chrome/Edge): rewritten after every change.
 *  3. Rolling snapshots inside IndexedDB (automatic daily + before risky operations).
 *  4. Manual JSON backup downloads / imports.
 */

const kv = createStore('wwe-universe', 'kv');
const snapshots = createStore('wwe-universe-snapshots', 'snapshots');
const DATA_KEY = 'universe';
const FILE_KEY = 'linkedFile';
const MAX_SNAPSHOTS = 20;

export async function loadUniverse(): Promise<{ data: Universe | null; warnings: string[]; error?: string }> {
  const raw = await get(DATA_KEY, kv);
  if (raw === undefined) return { data: null, warnings: [] };
  const res = validateUniverse(raw);
  if (!res.ok) return { data: null, warnings: [], error: `Saved data could not be read: ${res.errors.join('; ')}` };
  return { data: res.data!, warnings: res.warnings };
}

export async function saveUniverse(u: Universe): Promise<void> {
  await set(DATA_KEY, u, kv);
}

export async function clearUniverse(): Promise<void> {
  await del(DATA_KEY, kv);
}

// --- Backup envelope / downloads -------------------------------------------

export function backupEnvelope(u: Universe) {
  return { app: 'wwe-universe-tracker', schemaVersion: SCHEMA_VERSION, exportedAt: nowIso(), data: u };
}

export function backupFileName(u: Universe): string {
  const slug = u.meta.universeName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'universe';
  return `${slug}-backup-${realToday()}.json`;
}

export function downloadText(filename: string, text: string, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadBackup(u: Universe) {
  downloadText(backupFileName(u), JSON.stringify(backupEnvelope(u), null, 2));
}

// --- Snapshots ---------------------------------------------------------------

export interface SnapshotMeta {
  id: string;
  createdAt: string;
  label: string;
  universeName: string;
  counts: { superstars: number; matches: number; championships: number };
}

interface SnapshotRecord {
  meta: SnapshotMeta;
  data: Universe;
}

export async function listSnapshots(): Promise<SnapshotMeta[]> {
  const all = (await entries<string, SnapshotRecord>(snapshots)).map(([, v]) => v.meta);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createSnapshot(u: Universe, label: string): Promise<SnapshotMeta> {
  const meta: SnapshotMeta = {
    id: uid('snap'),
    createdAt: nowIso(),
    label,
    universeName: u.meta.universeName,
    counts: { superstars: u.superstars.length, matches: u.matches.length, championships: u.championships.length },
  };
  await set(meta.id, { meta, data: u } satisfies SnapshotRecord, snapshots);
  const list = await listSnapshots();
  for (const old of list.slice(MAX_SNAPSHOTS)) await del(old.id, snapshots);
  return meta;
}

export async function readSnapshot(id: string): Promise<Universe | null> {
  const rec = await get<SnapshotRecord>(id, snapshots);
  if (!rec) return null;
  const res = validateUniverse(rec.data);
  return res.ok ? res.data! : null;
}

export async function deleteSnapshot(id: string) {
  await del(id, snapshots);
}

// --- Linked auto-save file (File System Access API) --------------------------

type PermissionMode = { mode: 'readwrite' };
interface FsHandle extends FileSystemFileHandle {
  queryPermission?: (d: PermissionMode) => Promise<PermissionState>;
  requestPermission?: (d: PermissionMode) => Promise<PermissionState>;
}

export const fileSystemAccessSupported = typeof window !== 'undefined' && 'showSaveFilePicker' in window;

export async function pickBackupFile(suggestedName: string): Promise<FsHandle> {
  const picker = (window as unknown as { showSaveFilePicker: (o: object) => Promise<FsHandle> }).showSaveFilePicker;
  const handle = await picker({
    suggestedName,
    types: [{ description: 'WWE Universe backup', accept: { 'application/json': ['.json'] } }],
  });
  await set(FILE_KEY, handle, kv);
  return handle;
}

export async function getLinkedFile(): Promise<FsHandle | undefined> {
  if (!fileSystemAccessSupported) return undefined;
  return get<FsHandle>(FILE_KEY, kv);
}

export async function unlinkFile() {
  await del(FILE_KEY, kv);
}

export async function filePermission(handle: FsHandle, request: boolean): Promise<PermissionState> {
  const opts: PermissionMode = { mode: 'readwrite' };
  if (!handle.queryPermission) return 'granted';
  const state = await handle.queryPermission(opts);
  if (state === 'granted' || !request || !handle.requestPermission) return state;
  return handle.requestPermission(opts);
}

export async function writeFile(handle: FsHandle, u: Universe) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(backupEnvelope(u), null, 2));
  await writable.close();
}

export async function readFileHandle(handle: FsHandle): Promise<unknown> {
  const file = await handle.getFile();
  return JSON.parse(await file.text());
}

// --- Persistent storage ------------------------------------------------------

export async function requestPersistence(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

export async function storageInfo(): Promise<{ persisted: boolean | null; usage?: number; quota?: number }> {
  if (!navigator.storage) return { persisted: null };
  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : null;
  const est = navigator.storage.estimate ? await navigator.storage.estimate() : {};
  return { persisted, usage: est.usage, quota: est.quota };
}
