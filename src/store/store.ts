import { produce } from 'immer';
import { create } from 'zustand';
import type { Universe } from '../domain/schema';
import { getDerived, type Derived } from '../domain/stats';
import { nowIso } from '../domain/util';
import * as P from './persistence';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export type FileStatus = 'unsupported' | 'none' | 'connected' | 'needs-permission' | 'error';

interface AppState {
  data: Universe | null;
  loaded: boolean;
  loadError: string;
  loadWarnings: string[];
  saveState: SaveState;
  lastSavedAt: string;
  saveError: string;
  fileStatus: FileStatus;
  fileName: string;
  fileWrittenAt: string;
  fileError: string;
  otherTabOpen: boolean;
}

export const useStore = create<AppState>(() => ({
  data: null,
  loaded: false,
  loadError: '',
  loadWarnings: [],
  saveState: 'idle',
  lastSavedAt: '',
  saveError: '',
  fileStatus: P.fileSystemAccessSupported ? 'none' : 'unsupported',
  fileName: '',
  fileWrittenAt: '',
  fileError: '',
  otherTabOpen: false,
}));

/** Current universe; only call inside pages rendered after loading. */
export function useData(): Universe {
  const data = useStore((s) => s.data);
  if (!data) throw new Error('Universe not loaded');
  return data;
}

export function useDerived(): Derived {
  return getDerived(useData());
}

/**
 * Apply a change to the universe. The recipe works on an immer draft; if it throws,
 * nothing is changed and the error propagates to the caller (to show a message).
 */
export function mutate(recipe: (draft: Universe) => void) {
  const { data } = useStore.getState();
  if (!data) throw new Error('Universe not loaded');
  const next = produce(data, (draft) => {
    recipe(draft);
    draft.meta.updatedAt = nowIso();
  });
  useStore.setState({ data: next });
}

/** Replace the whole universe (new universe, import, snapshot restore). */
export function replaceUniverse(u: Universe) {
  useStore.setState({ data: u, loadWarnings: [] });
}

// --- Saving --------------------------------------------------------------------

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let fileHandle: Awaited<ReturnType<typeof P.getLinkedFile>>;

async function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  const { data } = useStore.getState();
  if (!data) return;
  useStore.setState({ saveState: 'saving' });
  try {
    await P.saveUniverse(data);
    useStore.setState({ saveState: 'saved', lastSavedAt: nowIso(), saveError: '' });
  } catch (e) {
    useStore.setState({ saveState: 'error', saveError: (e as Error).message || 'Could not save to browser storage.' });
  }
  if (fileHandle && useStore.getState().fileStatus === 'connected') {
    try {
      await P.writeFile(fileHandle, data);
      useStore.setState({ fileWrittenAt: nowIso(), fileError: '' });
    } catch (e) {
      useStore.setState({ fileStatus: 'error', fileError: (e as Error).message || 'Could not write the backup file.' });
    }
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  useStore.setState({ saveState: 'saving' });
  saveTimer = setTimeout(flushSave, 400);
}

useStore.subscribe((s, prev) => {
  if (s.loaded && s.data && s.data !== prev.data) scheduleSave();
});

export const saveNow = flushSave;

// --- Startup -------------------------------------------------------------------

let initStarted = false;

export async function initStore() {
  if (initStarted) return;
  initStarted = true;
  try {
    const { data, warnings, error } = await P.loadUniverse();
    useStore.setState({ data, loadWarnings: warnings, loadError: error ?? '' });
    if (data) await maybeDailySnapshot(data);
  } catch (e) {
    useStore.setState({ loadError: `Browser storage is unavailable: ${(e as Error).message}` });
  }
  useStore.setState({ loaded: true });
  void P.requestPersistence();
  void restoreFileLink();
  watchOtherTabs();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && saveTimer) void flushSave();
    });
    window.addEventListener('beforeunload', (e) => {
      if (saveTimer) {
        void flushSave();
        e.preventDefault();
      }
    });
  }
}

async function maybeDailySnapshot(u: Universe) {
  try {
    const list = await P.listSnapshots();
    const newest = list[0];
    if (!newest || Date.now() - Date.parse(newest.createdAt) > 24 * 3600 * 1000) {
      await P.createSnapshot(u, 'Automatic daily snapshot');
    }
  } catch {
    /* snapshots are best-effort */
  }
}

async function restoreFileLink() {
  if (!P.fileSystemAccessSupported) return;
  try {
    fileHandle = await P.getLinkedFile();
    if (!fileHandle) return;
    const perm = await P.filePermission(fileHandle, false);
    useStore.setState({ fileName: fileHandle.name, fileStatus: perm === 'granted' ? 'connected' : 'needs-permission' });
  } catch {
    useStore.setState({ fileStatus: 'none' });
  }
}

/** Link a new auto-save file (must be called from a click handler). */
export async function linkFile() {
  const data = useStore.getState().data;
  if (!data) return;
  fileHandle = await P.pickBackupFile(P.backupFileName(data).replace(/-backup-.*/, '-autosave.json'));
  useStore.setState({ fileName: fileHandle.name, fileStatus: 'connected', fileError: '' });
  await flushSave();
}

/** Re-grant write permission after a browser restart (must be called from a click handler). */
export async function reconnectFile() {
  if (!fileHandle) return;
  const perm = await P.filePermission(fileHandle, true);
  if (perm === 'granted') {
    useStore.setState({ fileStatus: 'connected', fileError: '' });
    await flushSave();
  } else {
    useStore.setState({ fileStatus: 'needs-permission' });
  }
}

export async function disconnectFile() {
  fileHandle = undefined;
  await P.unlinkFile();
  useStore.setState({ fileStatus: 'none', fileName: '', fileWrittenAt: '' });
}

function watchOtherTabs() {
  if (typeof BroadcastChannel === 'undefined') return;
  const ch = new BroadcastChannel('wwe-universe-tracker');
  ch.onmessage = (e) => {
    if (e.data === 'hello') ch.postMessage('present');
    if (e.data === 'hello' || e.data === 'present') useStore.setState({ otherTabOpen: true });
  };
  ch.postMessage('hello');
}
