import { FileUp, Sparkles, Users } from 'lucide-react';
import { useRef, useState } from 'react';
import { useFeedback } from '../components/feedback';
import { Field } from '../components/ui';
import { emptyUniverse, validateUniverse } from '../domain/schema';
import { starterUniverse } from '../domain/seed';
import { replaceUniverse } from '../store/store';

export function Welcome({ loadError }: { loadError: string }) {
  const [name, setName] = useState('My WWE Universe');
  const [mode, setMode] = useState<'starter' | 'empty'>('starter');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useFeedback();

  const create = () => {
    if (!name.trim()) return setError('Give your universe a name.');
    replaceUniverse(mode === 'starter' ? starterUniverse(name.trim()) : emptyUniverse(name.trim()));
    toast('Universe created. Welcome to the show!');
  };

  const restore = async (file: File) => {
    try {
      const res = validateUniverse(JSON.parse(await file.text()));
      if (!res.ok) return setError(`That file isn't a valid backup: ${res.errors.join('; ')}`);
      replaceUniverse(res.data!);
      toast(`Restored “${res.data!.meta.universeName}”`);
    } catch {
      setError("That file couldn't be read as JSON.");
    }
  };

  return (
    <div className="welcome">
      <div className="panel card card-pad stack">
        <div className="row">
          <img src="./icon.svg" alt="" width={48} height={48} />
          <div>
            <div className="eyebrow">WWE Universe Tracker</div>
            <h1 className="display metal-text" style={{ fontSize: 28 }}>
              Start your universe
            </h1>
          </div>
        </div>
        {loadError && <div className="banner danger small">{loadError}</div>}
        <Field label="Universe name" error={error}>
          <input className="input" value={name} onChange={(e) => (setName(e.target.value), setError(''))} />
        </Field>
        <button className={`option-card ${mode === 'starter' ? 'selected' : ''}`} onClick={() => setMode('starter')}>
          <Users size={22} />
          <div>
            <div className="strong">Starter roster</div>
            <div className="small muted">
              About 55 superstars across RAW, SmackDown and NXT (roughly the 2025 roster), all 16 current championships (vacant, so you crown your own champions) and two tag teams. Edit anything.
            </div>
          </div>
        </button>
        <button className={`option-card ${mode === 'empty' ? 'selected' : ''}`} onClick={() => setMode('empty')}>
          <Sparkles size={22} />
          <div>
            <div className="strong">Blank universe</div>
            <div className="small muted">Build every superstar, title and team yourself.</div>
          </div>
        </button>
        <button className="btn btn-primary" style={{ height: 42 }} onClick={create}>
          Create universe
        </button>
        <div className="divider" />
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <FileUp size={16} /> Restore from a backup file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void restore(f);
          }}
        />
        <p className="tiny muted center">Everything is stored on this device. Nothing is uploaded anywhere.</p>
      </div>
    </div>
  );
}
