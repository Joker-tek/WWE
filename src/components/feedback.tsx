import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { mutate } from '../store/store';
import type { Universe } from '../domain/schema';
import { Modal } from './ui';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}
interface ConfirmOpts {
  title: string;
  text: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

interface FeedbackApi {
  toast: (text: string, kind?: ToastKind) => void;
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
}

const Ctx = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const nextId = useRef(1);

  const toast = useCallback((text: string, kind: ToastKind = 'success') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);

  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })), []);

  const close = (v: boolean) => {
    pending?.resolve(v);
    setPending(null);
  };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            {t.kind === 'success' ? <CheckCircle2 size={18} color="var(--success)" /> : t.kind === 'error' ? <AlertTriangle size={18} color="var(--danger)" /> : <Info size={18} color="var(--info)" />}
            <div className="grow">{t.text}</div>
          </div>
        ))}
      </div>
      {pending && (
        <Modal
          title={pending.title}
          size="narrow"
          onClose={() => close(false)}
          footer={
            <>
              <button className="btn" onClick={() => close(false)}>
                Cancel
              </button>
              <button className={`btn ${pending.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>
                {pending.confirmLabel ?? 'Confirm'}
              </button>
            </>
          }
        >
          <div className="text-2">{pending.text}</div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('FeedbackProvider missing');
  return v;
}

/**
 * Run a data change, showing a success toast, or an error toast when the domain
 * rejects it. Returns true when the change was applied.
 */
export function useMutation() {
  const { toast } = useFeedback();
  return useCallback(
    (recipe: (u: Universe) => void, success?: string): boolean => {
      try {
        mutate(recipe);
        if (success) toast(success);
        return true;
      } catch (e) {
        toast((e as Error).message || 'Something went wrong.', 'error');
        return false;
      }
    },
    [toast],
  );
}
