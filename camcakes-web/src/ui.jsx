import React, { useEffect, useRef, useState } from 'react';
import { isNum } from './lib/format.js';

const ICONS = {
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
  receipt: <><path d="M4 3v18l3-2 3 2 3-2 3 2 4-2V3l-4 2-3-2-3 2-3-2z" /><path d="M8 9h8M8 13h8" /></>,
  printer: <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6zM18 12h.01" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>,
  trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6" /><path d="M10 11v5m4-5v5" /></>,
  close: <><path d="m18 6-12 12M6 6l12 12" /></>,
};

export function AppIcon({ name, size = 18, className = '' }) {
  return (
    <svg className={`app-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

export function NumInput({ value, onChange, className = '', placeholder, ...rest }) {
  const [txt, setTxt] = useState(isNum(value) ? String(value) : '');
  const focus = useRef(false);
  useEffect(() => { if (!focus.current) setTxt(isNum(value) ? String(value) : ''); }, [value]);
  const commit = () => {
    const t = txt.trim().replace(',', '.');
    if (t === '') { if (value !== null) onChange(null); return; }
    const n = Number(t);
    if (Number.isFinite(n)) { if (n !== value) onChange(n); } else setTxt(isNum(value) ? String(value) : '');
  };
  return (
    <input className={'num ' + className} inputMode="decimal" value={txt} placeholder={placeholder}
      onFocus={(e) => { focus.current = true; e.target.select(); }}
      onBlur={() => { focus.current = false; commit(); }}
      onChange={(e) => {
        const next = e.target.value;
        setTxt(next);
        const normalized = next.trim().replace(',', '.');
        if (normalized === '') { if (value !== null) onChange(null); return; }
        const n = Number(normalized);
        if (Number.isFinite(n) && n !== value) onChange(n);
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} {...rest} />
  );
}

export const Badge = ({ tone = 'none', children, title }) => <span className={`badge ${tone}`} title={title}>{children}</span>;

export function Stat({ label, value, sub, tone }) {
  return (
    <div className={`stat ${tone || ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </div>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}{o.count != null ? <span className="count">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export const Empty = ({ title, children, action }) => (
  <div className="empty"><h3>{title}</h3><p>{children}</p>{action}</div>
);

export function Drawer({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="drawer-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className={'drawer' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
        <header><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Cerrar"><AppIcon name="close" /></button></header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function FilePick({ label, hint, accept, file, onFile, tone, error, id }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef(null);
  return (
    <div className={`filepick ${file ? 'loaded' : ''} ${drag ? 'drag' : ''} ${error ? 'err' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}>
      <div className="fp-title">{label}</div>
      <div className="fp-hint">{hint}</div>
      {file ? <div className="fp-file">✓ {file}</div> : null}
      {error ? <div className="fp-error" role="alert">{error}</div> : null}
      <button className="btn" onClick={() => ref.current.click()}>{file ? 'Reemplazar archivo' : 'Elegir archivo'}</button>
      <input ref={ref} id={id} type="file" accept={accept} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </div>
  );
}
