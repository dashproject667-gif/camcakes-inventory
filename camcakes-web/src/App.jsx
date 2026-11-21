import React, { useCallback, useMemo, useRef, useState } from 'react';
import { readXlsx } from './lib/xlsx.js';
import { parseMonitor, parseDoc, INS_FIRST, INS_LAST, REC_FIRST, REC_LAST } from './lib/monitor.js';
import { computeCosts, key, norm } from './lib/engine.js';
import { computeSales, buildInventory, DEFAULT_IGNORED } from './lib/sales.js';
import { summarizeChanges } from './lib/export.js';
import { loadSession, saveSession } from './lib/session.js';
import { AppIcon, FilePick } from './ui.jsx';
import Menu from './Menu.jsx';
import Costos from './Costos.jsx';
import Inventario from './Inventario.jsx';
import ExportDialog from './ExportDialog.jsx';
import Monitores from './Monitores.jsx';

export const AppCtx = React.createContext(null);
const SECTIONS = [{ id: 'menu', label: 'Menú' }, { id: 'costos', label: 'Costos' }, { id: 'inventario', label: 'Inventario' }, { id: 'monitores', label: 'Monitores y trazabilidad' }];

export default function App() {
  const [restored] = useState(loadSession);
  const initial = restored.data;
  const bufferRef = useRef(initial?.buffer || null);
  const [monitorName, setMonitorName] = useState(initial?.monitorName || '');
  const [original, setOriginal] = useState(initial?.original || null);
  const [model, setModel] = useState(initial?.model || null);
  const [doc, setDoc] = useState(initial?.doc || null);
  const [docName, setDocName] = useState(initial?.docName || '');
  const [errors, setErrors] = useState({});
  const [section, setSection] = useState(initial?.section || 'menu');
  const [showExport, setShowExport] = useState(false);
  const [salesState, setSalesState] = useState(initial?.salesState
    ? { ...initial.salesState, ignored: new Set(initial.salesState.ignored) }
    : { ignored: new Set(DEFAULT_IGNORED.map(norm)), overrides: {}, myoBase: true });
  const [counts, setCounts] = useState(initial?.counts || {});
  const [excluded, setExcluded] = useState(new Set(initial?.excluded || []));
  const [toast, setToast] = useState('');
  const [persistenceError, setPersistenceError] = useState(restored.error);

  const notify = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 3500); }, []);

  const loadMonitor = async (file) => {
    try {
      const buf = await file.arrayBuffer();
      const m = parseMonitor(await readXlsx(buf));
      bufferRef.current = buf;
      setOriginal(structuredClone(m)); setModel(m); setMonitorName(file.name); setErrors((e) => ({ ...e, monitor: '' })); setCounts({});
    } catch (e) { setErrors((x) => ({ ...x, monitor: e.message || 'No pude leer el archivo.' })); }
  };
  const loadDoc = async (file) => {
    try {
      const d = parseDoc(await readXlsx(await file.arrayBuffer()));
      setDoc(d); setDocName(file.name); setErrors((e) => ({ ...e, doc: '' })); setSalesState((s) => ({ ...s, overrides: {} }));
    } catch (e) { setErrors((x) => ({ ...x, doc: e.message || 'No pude leer el archivo.' })); }
  };

  // ---------- acciones sobre el modelo ----------
  const actions = useMemo(() => {
    const upd = (fn) => setModel((m) => { const c = { ...m }; fn(c); return c; });
    return {
      setParam: (f, v) => upd((c) => { c.params = { ...c.params, [f]: v }; }),
      setInsumo: (row, patch) => upd((c) => { c.insumos = c.insumos.map((i) => (i.row === row ? { ...i, ...patch } : i)); }),
      renameInsumo: (row, newName) => {
        const cleanName = String(newName || '').trim();
        if (!cleanName) return false;
        const current = model?.insumos.find((i) => i.row === row);
        if (!current || key(current.name) === key(cleanName)) return true;
        if (model.insumos.some((i) => i.row !== row && key(i.name) === key(cleanName))) return false;
        const oldName = current.name;
        setCounts((countsState) => {
          const oldKey = key(oldName);
          const newKey = key(cleanName);
          if (!countsState[oldKey] || oldKey === newKey) return countsState;
          const next = { ...countsState, [newKey]: countsState[oldKey] };
          delete next[oldKey];
          return next;
        });
        upd((c) => {
          c.insumos = c.insumos.map((i) => (i.row === row ? { ...i, name: cleanName } : i));
          c.recetas = c.recetas.map((r) => (key(r.ingrediente) === key(oldName) ? { ...r, ingrediente: cleanName } : r));
          c.zettle = c.zettle.map((z) => ({
            ...z,
            ref: key(z.ref) === key(oldName) ? cleanName : z.ref,
            omitido: key(z.omitido) === key(oldName) ? cleanName : z.omitido,
          }));
          c.params = { ...c.params };
          for (const f of ['masa', 'nieve', 'crema', 'leche']) {
            if (key(c.params[f]) === key(oldName)) c.params[f] = cleanName;
          }
          c.params.lechas = { ...c.params.lechas };
          for (const [kind, name] of Object.entries(c.params.lechas)) {
            if (key(name) === key(oldName)) c.params.lechas[kind] = cleanName;
          }
        });
        return true;
      },
      renameCategoria: (oldName, newName) => {
        const cleanName = String(newName || '').trim();
        if (!cleanName) return false;
        if (key(oldName) === key(cleanName)) return true;
        upd((c) => {
          c.insumos = c.insumos.map((i) => (key(i.cat) === key(oldName) ? { ...i, cat: cleanName } : i));
        });
        return true;
      },
      createCategoria: (name) => {
        const cleanName = String(name || '').trim();
        if (!cleanName) return false;
        const exists = model?.categorias?.some((cat) => key(cat) === key(cleanName))
          || model?.insumos?.some((insumo) => key(insumo.cat) === key(cleanName));
        if (exists) return false;
        setModel((m) => ({ ...m, categorias: [...new Set([...(m.categorias || []), cleanName])] }));
        notify(`Categoría "${cleanName}" creada.`);
        return true;
      },
      addInsumo: (data) => {
        let ok = true;
        setModel((m) => {
          const used = new Set(m.insumos.map((i) => i.row));
          let row = null; for (let r = INS_FIRST; r <= INS_LAST; r++) if (!used.has(r)) { row = r; break; }
          if (row === null || m.insumos.some((i) => key(i.name) === key(data.name))) { ok = false; return m; }
          return { ...m, insumos: [...m.insumos, { row, cat: '', unit: 'g', pres: '', cont: null, precio: null, estado: 'Estimado', pesoPza: null, usoMin: null, usoMax: null, stockIni: null, compras: null, stockMin: null, notas: '', myoMin: null, myoMax: null, cached: {}, ...data }] };
        });
        return ok;
      },
      setProducto: (row, patch) => upd((c) => { c.productos = c.productos.map((p) => (p.row === row ? { ...p, ...patch } : p)); }),
      setReceta: (row, patch) => upd((c) => { c.recetas = c.recetas.map((r) => (r.row === row ? { ...r, ...patch } : r)); }),
      addReceta: (data) => setModel((m) => {
        const used = new Set(m.recetas.map((r) => r.row)); let row = null;
        for (let r = REC_FIRST; r <= REC_LAST; r++) if (!used.has(r)) { row = r; break; }
        if (row === null) return m;
        return { ...m, recetas: [...m.recetas, { row, tipo: 'Ingrediente', manual: null, notas: '', cached: {}, ...data }] };
      }),
      removeReceta: (row) => upd((c) => { c.recetas = c.recetas.filter((r) => r.row !== row); }),
    };
  }, [model, setCounts]);

  const costs = useMemo(() => (model ? computeCosts(model) : null), [model]);
  const sales = useMemo(() => (model && costs && doc ? computeSales(model, costs, doc.lines, salesState) : null), [model, costs, doc, salesState]);
  const inventory = useMemo(() => (costs ? buildInventory(costs, sales ? sales.usage : new Map()) : []), [costs, sales]);
  const changes = useMemo(() => (model && original ? summarizeChanges(original, model) : { total: 0, counts: {} }), [model, original]);
  const pendingCounts = Object.values(counts).filter((c) => c && (c.cerrados != null || c.abierto != null)).length;

  React.useEffect(() => {
    const h = (e) => { if (changes.total || pendingCounts) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [changes.total, pendingCounts]);

  React.useEffect(() => {
    if (!model || !original || !bufferRef.current) return;
    const result = saveSession({
      monitorName, original, model, buffer: bufferRef.current, doc, docName,
      section, salesState, counts, excluded,
    });
    setPersistenceError(result.error);
  }, [monitorName, original, model, doc, docName, section, salesState, counts, excluded]);

  const ctx = { model, original, costs, sales, inventory, doc, docName, actions, salesState, setSalesState, counts, setCounts, excluded, setExcluded, notify, setSection, loadDoc, errors, bufferRef };

  if (!model) {
    return (
      <div className="landing">
        <div className="landing-card">
          <div className="brand big"><img className="brand-logo" src="./camcakes-logo.png" alt="Logo Camcakes" /><div className="brand-text"><h1>Camcakes · Monitor</h1><p>Menú, costos e inventario en un solo lugar</p></div></div>
          <p className="lead">Carga tus archivos para empezar. Todo se procesa en tu navegador: <strong>nada se sube a un servidor ni se guarda de forma permanente</strong>. Tus cambios se conservan temporalmente en esta pestaña al recargar; al cerrar la pestaña se eliminan.</p>
          {persistenceError && <div className="fp-error" role="alert">{persistenceError}</div>}
          <div className="picks">
            <FilePick id="file-monitor" label="1 · Monitor_Operacion_CamCakes.xlsx" hint="Insumos, recetas, precios y parámetros. Es la base de todo." accept=".xlsx" file={monitorName} onFile={loadMonitor} error={errors.monitor} />
            <FilePick id="file-doc" label="2 · Reporte del POS (DOC) · opcional ahora" hint="“Ventas por producto” exportado de Zettle. Lo necesitas para el inventario teórico." accept=".xlsx" file={docName} onFile={loadDoc} error={errors.doc} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppCtx.Provider value={ctx}>
      <header className="topbar no-print">
        <div className="brand"><img className="brand-logo" src="./camcakes-logo.png" alt="Logo Camcakes" /><div className="brand-text"><strong>Camcakes</strong><span className="muted"> · Monitor</span></div></div>
        <nav aria-label="Secciones">
          {SECTIONS.map((s) => <button key={s.id} className={section === s.id ? 'on' : ''} onClick={() => setSection(s.id)}>{s.label}</button>)}
        </nav>
        <div className="top-actions">
          <label className="chip file" title="Reemplazar Monitor">
            <span><AppIcon name="file" /> {monitorName}</span>
            <input type="file" accept=".xlsx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) loadMonitor(f); e.target.value = ''; }} />
          </label>
          <label className={'chip file' + (doc ? '' : ' warn')} title="Cargar reporte de ventas del POS">
            <span><AppIcon name="receipt" /> {doc ? (doc.meta.periodo || docName) : 'Cargar DOC del POS'}</span>
            <input id="file-doc-top" type="file" accept=".xlsx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) loadDoc(f); e.target.value = ''; }} />
          </label>
          <button className="btn primary" onClick={() => setShowExport(true)}>Exportar Monitor{changes.total + pendingCounts ? <span className="dot">{changes.total + pendingCounts}</span> : null}</button>
        </div>
      </header>
      {persistenceError && <div className="fp-error" role="alert">{persistenceError}</div>}
      <main className="no-print">
        {section === 'menu' && <Menu />}
        {section === 'costos' && <Costos />}
        {section === 'inventario' && <Inventario />}
        {section === 'monitores' && <Monitores />}
      </main>
      {showExport && <ExportDialog onClose={() => setShowExport(false)} changes={changes} />}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </AppCtx.Provider>
  );
}
