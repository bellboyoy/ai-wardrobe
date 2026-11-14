'use client';
/* eslint-disable @next/next/no-img-element */
import { createContext, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { X, Loader2 } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger'; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: ReactNode };
export function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-300 ease-[var(--ease-out-soft)] active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100',
        size === 'sm' && 'h-9 rounded-full px-4 text-[13px]',
        size === 'md' && 'h-11 rounded-full px-5 text-sm',
        size === 'lg' && 'h-13 rounded-full px-7 text-[15px]',
        variant === 'primary' && 'bg-ink text-white hover:bg-black hover:shadow-lift',
        variant === 'secondary' && 'border border-line bg-white text-ink hover:border-ink/30 hover:shadow-soft',
        variant === 'ghost' && 'text-ink hover:bg-soft',
        variant === 'quiet' && 'h-auto rounded-none px-0 text-muted underline-offset-4 hover:text-ink hover:underline',
        variant === 'danger' && 'border border-line bg-white text-danger hover:border-danger/40',
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : icon}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, active, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      {...rest}
      className={cx('grid size-9 place-items-center rounded-full transition-all duration-300 hover:bg-soft active:scale-95', active && 'text-ink', className)}
    >
      {children}
    </button>
  );
}

export function Chip({ active, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...rest}
      className={cx(
        'h-9 shrink-0 rounded-full border px-4 text-[13px] transition-all duration-300',
        active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:border-ink/30',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('label-xs', className)}>{children}</div>;
}

export function SectionHeader({ label, title, action, className }: { label?: string; title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('mb-5 flex items-end justify-between gap-4', className)}>
      <div>
        {label && <Label className="mb-2">{label}</Label>}
        <h2 className="text-[22px] font-[450] tracking-[-0.02em] md:text-[26px]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ label, title, intro, action }: { label: string; title: ReactNode; intro?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-10 flex flex-col gap-6 md:mb-14 md:flex-row md:items-end md:justify-between animate-fade-up">
      <div className="max-w-2xl">
        <Label className="mb-4">{label}</Label>
        <h1 className="display text-[40px] md:text-[56px]">{title}</h1>
        {intro && <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">{intro}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-3">{action}</div>}
    </header>
  );
}

const fieldCls = 'w-full rounded-ctl border border-line bg-white px-4 text-[15px] text-ink placeholder:text-muted/70 transition-colors duration-200 focus:border-ink/40 focus:outline-none';
export function Input({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const el = <input {...rest} className={cx(fieldCls, 'h-12', className)} />;
  return label ? <label className="block"><span className="label-xs mb-2 block">{label}</span>{el}</label> : el;
}
export function Select({ label, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const el = <select {...rest} className={cx(fieldCls, 'h-12 appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 fill=%27none%27 stroke=%27%23888%27 stroke-width=%271.5%27%3E%3Cpath d=%27M3 4.5l3 3 3-3%27/%3E%3C/svg%3E")] bg-[right_16px_center] bg-no-repeat pr-10', className)}>{children}</select>;
  return label ? <label className="block"><span className="label-xs mb-2 block">{label}</span>{el}</label> : el;
}
export function Textarea({ label, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const el = <textarea {...rest} className={cx(fieldCls, 'min-h-24 py-3 leading-relaxed', className)} />;
  return label ? <label className="block"><span className="label-xs mb-2 block">{label}</span>{el}</label> : el;
}

/** Image that fades in once loaded, with a soft shimmer before. */
export function Photo({ src, alt = '', className, fit = 'cover', onClick }: { src?: string; alt?: string; className?: string; fit?: 'cover' | 'contain'; onClick?: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <div className={cx('relative overflow-hidden bg-canvas', !ok && 'skeleton', className)} onClick={onClick}>
      {src && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setOk(true)}
          className={cx('absolute inset-0 size-full transition-all duration-700 ease-[var(--ease-out-soft)]', fit === 'cover' ? 'object-cover' : 'object-contain p-[8%]', ok ? 'opacity-100' : 'opacity-0 scale-[1.01]')}
        />
      )}
    </div>
  );
}

export function Sheet({ open, onClose, title, label, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; label?: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/25 backdrop-blur-[2px] animate-[fade-up_0.3s_ease-out_both]" onClick={onClose} />
      <div className={cx('relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[24px] bg-white shadow-lift md:rounded-[24px] animate-fade-up', wide ? 'md:max-w-4xl' : 'md:max-w-lg')}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-white/95 px-6 pt-6 pb-4 backdrop-blur md:px-8 md:pt-8">
          <div>
            {label && <Label className="mb-2">{label}</Label>}
            {title && <h2 className="text-[22px] font-[450] tracking-[-0.02em]">{title}</h2>}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1"><X className="size-5" strokeWidth={1.5} /></IconButton>
        </div>
        <div className="px-6 pb-8 md:px-8">{children}</div>
      </div>
    </div>
  );
}

/** A small in-app confirm step for actions that can't be undone. */
export function Confirm({ open, title, text, confirmLabel = 'Delete', onConfirm, onClose }: { open: boolean; title: string; text?: ReactNode; confirmLabel?: string; onConfirm: () => Promise<void> | void; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={() => !busy && onClose()} title={title}>
      {text && <p className="text-[14px] leading-relaxed text-ink-2">{text}</p>}
      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button variant="danger" loading={busy} onClick={async () => { setBusy(true); try { await onConfirm(); onClose(); } finally { setBusy(false); } }}>{confirmLabel}</Button>
      </div>
    </Sheet>
  );
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line bg-canvas/50 px-6 py-16 text-center">
      {icon && <div className="mb-5 grid size-12 place-items-center rounded-full bg-white text-ink shadow-soft">{icon}</div>}
      <h3 className="text-lg font-[450] tracking-[-0.01em]">{title}</h3>
      {text && <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-5 animate-spin text-muted', className)} strokeWidth={1.5} />;
}

// ---------- toasts ----------
type Toast = { id: number; text: string; tone?: 'error' };
const ToastCtx = createContext<(text: string, tone?: 'error') => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone?: 'error') => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, text, tone }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), tone === 'error' ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-8">
        {list.map((t) => (
          <div key={t.id} className={cx('pointer-events-auto max-w-md rounded-full px-5 py-3 text-sm shadow-lift animate-fade-up', t.tone === 'error' ? 'bg-white text-danger border border-danger/20' : 'bg-ink text-white')}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
