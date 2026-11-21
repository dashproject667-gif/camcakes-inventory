import React, { useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppCtx } from './App.jsx';
import { AppIcon, Badge, Empty, FilePick, NumInput, QuantityInput, Segmented, Stat } from './ui.jsx';
import { money, money0, num, isNum, longDate } from './lib/format.js';
import { key, norm } from './lib/engine.js';
import { IGNORE, lineKey, DEFAULT_IGNORED } from './lib/sales.js';
import { stockAlert } from './lib/engine.js';
import { readXlsx } from './lib/xlsx.js';
import { buildPhysicalInventoryCsv, buildPhysicalInventoryTemplate, parsePhysicalInventory, parsePhysicalInventoryCsv } from './lib/physicalInventory.js';
import { normalizeInitialStock, parseQuantityExpression } from './lib/quantity.js';

const ALERT_TONE = { OK: 'good', BAJO: 'warn', AGOTADO: 'bad', 'Sin stock capturado': 'none' };
const groupBy = (rows, f) => { const m = new Map(); for (const r of rows) { const k = f(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return [...m.entries()]; };

export default function Inventario() {
  const { doc, docName, loadDoc, errors, sales } = useContext(AppCtx);
  const [tab, setTab] = useState(doc ? 'teorico' : 'ventas');
  const unm = sales ? sales.rows.filter((r) => r.res.status === 'unmatched').length : 0;
  return (
    <section>
      <div className="section-head">
        <div><h1>Inventario</h1><p className="muted">Teórico = stock inicial + compras − lo que descuentan las ventas del POS. Después cuenta físico y compara.</p></div>
        {doc && <div className="period"><span className="muted small">Periodo del POS</span><strong>{doc.meta.periodo || docName}</strong></div>}
      </div>
      <Segmented value={tab} onChange={setTab} label="Inventario" options={[{ value: 'teorico', label: 'Teórico' }, { value: 'ventas', label: 'Ventas del POS', count: unm || null }, { value: 'conteo', label: 'Conteo físico' }]} />
      <div className="tab-body">
        {!doc && tab !== 'ventas' && <div className="note warn">Aún no cargas el DOC del POS: el consumo por ventas es 0. Súbelo en la pestaña “Ventas del POS”.</div>}
        {tab === 'teorico' && <Teorico />}
        {tab === 'ventas' && (doc ? <VentasPOS /> : <div className="picks one"><FilePick id="file-doc-inv" label="Reporte del POS (DOC)" hint="“Ventas por producto” exportado de Zettle (.xlsx)." accept=".xlsx" file={docName} onFile={loadDoc} error={errors.doc} /></div>)}
        {tab === 'conteo' && <Conteo />}
      </div>
    </section>
  );
}

function Teorico() {
  const { inventory, actions, costs } = useContext(AppCtx);
  const [q, setQ] = useState(''); const [flt, setFlt] = useState('all'); const [open, setOpen] = useState(null);
  const setStockInitial = (i, patch) => {
    const closed = patch.closed !== undefined ? patch.closed : i.stockClosed;
    const openValue = patch.open !== undefined ? patch.open : i.stockOpen;
    const presentationSize = i.unit === 'pza' ? i.cont : i.gPres;
    const normalized = normalizeInitialStock(closed, openValue, presentationSize);
    actions.setInsumo(i.row, {
      stockIni: normalized.presentaciones,
      stockClosed: normalized.cerradas,
      stockOpen: normalized.abierta,
    });
  };
  const stockUnit = (i) => i.unit === 'pza' ? 'piezas' : i.unit;
  const presentationUnit = (i) => i.unit === 'pza' ? 'presentaciones cerradas / paquetes' : 'presentaciones cerradas';
  const stockCalculation = (i) => {
    const closed = isNum(i.stockClosed) ? i.stockClosed : 0;
    const openValue = isNum(i.stockOpen) ? i.stockOpen : 0;
    const content = isNum(i.cont) && i.cont > 0 ? i.cont : null;
    if (i.unit === 'pza') {
      if (!content) return { closedText: 'Falta contenido por presentación', openText: '', totalText: '' };
      const closedTotal = closed * content;
      const total = closedTotal + openValue;
      return {
        closedText: `${num(closed, 0)} × ${num(content, 0)} piezas = ${num(closedTotal, 0)} piezas`,
        openText: openValue ? `+ ${num(openValue, 0)} piezas abierta` : '+ 0 piezas abierta',
        totalText: `Total: ${num(total, 0)} piezas`,
      };
    }
    if (!content) return { closedText: 'Falta contenido por presentación', openText: '', totalText: '' };
    const unit = stockUnit(i);
    const closedTotal = closed * content;
    const total = closedTotal + openValue;
    return {
      closedText: `${num(closed, 0)} × ${num(content, 1)} ${unit} = ${num(closedTotal, 1)} ${unit}`,
      openText: openValue ? `+ ${num(openValue, 1)} ${unit} abierta` : `+ 0 ${unit} abierta`,
      totalText: `Total: ${num(total, 1)} ${unit}`,
    };
  };
  const alertOf = (x) => stockAlert(x.teorico, x.ins.stockMin, x.hasStock);
  const rows = inventory.filter((x) => (!q || x.ins.name.toLowerCase().includes(q.toLowerCase())) && (flt === 'all' || (flt === 'mov' ? x.consumo !== 0 : alertOf(x) === flt)));
  const cnt = (a) => inventory.filter((x) => alertOf(x) === a).length;
  const valor = inventory.reduce((s, x) => s + (x.valor || 0), 0);
  return (
    <>
      <div className="stats row">
        <Stat label="Valor del inventario teórico" value={money0(valor)} sub="solo insumos con precio y stock" />
        <Stat label="Agotados" value={cnt('AGOTADO')} tone={cnt('AGOTADO') ? 'bad' : 'good'} />
        <Stat label="Bajo el mínimo" value={cnt('BAJO')} tone={cnt('BAJO') ? 'warn' : 'good'} />
        <Stat label="Sin stock capturado" value={cnt('Sin stock capturado')} sub="captura el stock inicial" tone={cnt('Sin stock capturado') ? 'warn' : undefined} />
      </div>
      <div className="toolbar">
        <input type="search" placeholder="Buscar insumo…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar insumo" />
        <select value={flt} onChange={(e) => setFlt(e.target.value)} aria-label="Filtro"><option value="all">Todos</option><option value="mov">Con consumo en el periodo</option><option value="AGOTADO">Agotados</option><option value="BAJO">Bajos</option><option value="Sin stock capturado">Sin stock capturado</option></select>
      </div>
      <div className="table-wrap">
        <table className="tbl compact">
          <thead><tr><th>Insumo</th><th>Cerradas<br /><small>(presentaciones completas)</small></th><th className="r">Abierta<br /><small>medida original</small></th><th className="r">Compras<br /><small>(presentaciones)</small></th><th className="r">Consumo por ventas</th><th className="r">Teórico</th><th className="r">Mínimo</th><th>Alerta</th></tr></thead>
          <tbody>
            {groupBy(rows, (x) => x.ins.cat).map(([cat, items]) => (
              <React.Fragment key={cat}>
                <tr className="group"><td colSpan={8}>{cat}</td></tr>
                {items.map((x) => {
                  const a = alertOf(x); const i = x.ins;
                  const stockCalc = stockCalculation(i);
                  return (
                    <React.Fragment key={i.row}>
                      <tr>
                        <td><strong>{i.name}</strong><div className="muted small">{i.pres || ''}{isNum(i.gPres) ? ` · ${num(i.gPres, 0)} ${i.unit === 'pza' ? 'g' : i.unit}/pres.` : ''}</div></td>
                        <td className="r">
                          <QuantityInput value={i.stockClosed} onChange={(v) => setStockInitial(i, { closed: v })} integerOnly aria-label={`${presentationUnit(i)} de ${i.name}`} />
                          <div className="muted small">{i.unit === 'pza' ? 'paquetes' : i.unit}</div>
                          <div className="stock-equation">{stockCalc.closedText}</div>
                        </td>
                        <td className="r">
                          <QuantityInput value={i.stockOpen} onChange={(v) => setStockInitial(i, { open: v })} aria-label={`Cantidad abierta de ${i.name}`} />
                          {stockCalc.openText && <div className="stock-equation">{stockCalc.openText}</div>}
                          {stockCalc.totalText && <div className="stock-total">{stockCalc.totalText}</div>}
                        </td>
                        <td className="r"><NumInput value={i.compras} onChange={(v) => actions.setInsumo(i.row, { compras: v })} aria-label={`Compras de ${i.name}`} /></td>
                        <td className="r">{x.consumo ? <button className="link" onClick={() => setOpen(open === i.row ? null : i.row)} aria-expanded={open === i.row}>{num(x.natural(x.consumo), 0)} {x.unitLabel}</button> : <span className="muted">0</span>}</td>
                        <td className="r"><strong className={isNum(x.teorico) && x.teorico <= 0 ? 'neg' : ''}>{isNum(x.teorico) ? `${num(x.natural(x.teorico), 0)} ${x.unitLabel}` : '—'}</strong>{isNum(x.presTeorica) ? <div className="muted small">≈ {num(x.presTeorica, 1)} pres.</div> : null}</td>
                        <td className="r"><NumInput value={i.stockMin} onChange={(v) => actions.setInsumo(i.row, { stockMin: v })} aria-label={`Mínimo de ${i.name} en ${i.unit}`} /></td>
                        <td><Badge tone={ALERT_TONE[a]}>{a}</Badge></td>
                      </tr>
                      {open === i.row && (
                        <tr className="sub"><td colSpan={8}>
                          <strong>De dónde sale el consumo:</strong>{' '}
                          {[...x.by.entries()].sort((p, q2) => Math.abs(q2[1]) - Math.abs(p[1])).map(([k, g]) => `${k}: ${num(x.natural(g), 0)} ${x.unitLabel}`).join(' · ')}
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">El stock mínimo se captura en la unidad del insumo (g, ml o piezas). El stock inicial debe corresponder al inicio del periodo del reporte del POS.</p>
    </>
  );
}

function VentasPOS() {
  const { sales, costs, doc, salesState, setSalesState, loadDoc, docName, errors } = useContext(AppCtx);
  const [newIgn, setNewIgn] = useState('');
  const rows = sales.rows;
  const groups = [['unmatched', 'Sin identificar', 'No descuentan insumos. Asigna un producto o ignóralos.'], ['ok', 'Identificadas', 'Descuentan insumos según la receta.'], ['ignored', 'Ignoradas', 'Registros viejos o descartados.']];
  const setOv = (l, v) => setSalesState((s) => { const o = { ...s.overrides }; if (v) o[lineKey(l)] = v; else delete o[lineKey(l)]; return { ...s, overrides: o }; });
  const ignoredList = [...salesState.ignored];
  const label = (n) => DEFAULT_IGNORED.find((d) => norm(d) === n) || n;
  const addIgn = () => { const n = norm(newIgn); if (!n) return; setSalesState((s) => ({ ...s, ignored: new Set([...s.ignored, n]) })); setNewIgn(''); };
  return (
    <>
      <div className="stats row">
        <Stat label="Unidades identificadas" value={num(sales.totals.qty, 0)} sub={money0(sales.totals.sinIva) + ' sin IVA'} tone="good" />
        <Stat label="Sin identificar" value={num(sales.totals.qtyUnm, 0)} sub={money0(sales.totals.sinIvaUnm) + ' sin IVA'} tone={sales.totals.qtyUnm ? 'warn' : 'good'} />
        <Stat label="Ignoradas" value={num(sales.totals.qtyIgn, 0)} sub={money0(sales.totals.sinIvaIgn) + ' sin IVA'} />
      </div>
      <div className="panel">
        <h3>Productos que se ignoran (registros viejos)</h3>
        <div className="chips">
          {ignoredList.map((n) => <span key={n} className="tag">{label(n)}<button aria-label={`Dejar de ignorar ${label(n)}`} onClick={() => setSalesState((s) => { const x = new Set(s.ignored); x.delete(n); return { ...s, ignored: x }; })}>✕</button></span>)}
          <input className="mini" placeholder="Agregar nombre exacto…" value={newIgn} onChange={(e) => setNewIgn(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addIgn(); }} aria-label="Agregar producto a ignorar" />
          <button className="btn" onClick={addIgn}>Agregar</button>
        </div>
        <label className="check"><input type="checkbox" checked={salesState.myoBase} onChange={(e) => setSalesState((s) => ({ ...s, myoBase: e.target.checked }))} /> Cada línea de “Crepa Make Your Own” (relleno) descuenta también masa, nieve y crema de 1 crepa</label>
        <div className="filepick inline"><span>Reporte cargado: <strong>{docName}</strong></span><label className="btn">Reemplazar DOC<input type="file" accept=".xlsx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) loadDoc(f); e.target.value = ''; }} /></label></div>
        {errors.doc ? <div className="fp-error">{errors.doc}</div> : null}
      </div>
      {groups.map(([st, title, hint]) => {
        const list = rows.filter((r) => r.res.status === st);
        if (!list.length) return null;
        return (
          <div key={st} className="panel">
            <h3>{title} <span className="muted">({list.length})</span></h3><p className="muted small">{hint}</p>
            <div className="table-wrap">
              <table className="tbl compact">
                <thead><tr><th>Producto en el POS</th><th>Variante</th><th className="r">Cant.</th><th className="r">Venta s/IVA</th><th>Se interpreta como</th><th>Asignar a</th></tr></thead>
                <tbody>
                  {list.map((r) => {
                    const l = r.line; const ov = salesState.overrides[lineKey(l)] || '';
                    const what = r.res.status === 'ok' ? `${r.res.producto || r.res.insumo}${r.res.kind === 'relleno' ? ' (relleno MYO)' : r.res.kind === 'topping' ? ' (topping MYO)' : ''}` : r.res.why;
                    return (
                      <tr key={l.id}>
                        <td>{l.nombre.trim()}</td><td className="muted">{l.variante.trim()}</td><td className="r">{num(l.qty, 0)}</td><td className="r">{money(l.sinIva)}</td>
                        <td>{r.res.status === 'ok' ? <>{what} <Badge tone="none">{r.res.via}</Badge>{r.warn ? <Badge tone="warn">{r.warn}</Badge> : null}</> : <span className="muted">{what}</span>}</td>
                        <td>
                          <select value={ov} onChange={(e) => setOv(l, e.target.value)} aria-label={`Asignar ${l.nombre}`}>
                            <option value="">{st === 'ok' ? 'Automático' : '— Elegir —'}</option>
                            <option value={IGNORE}>Ignorar</option>
                            {costs.prods.filter((p) => p.tipo !== 'MYO').map((p) => <option key={p.row} value={p.nombre}>{p.nombre}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}

function Conteo() {
  const { inventory, counts, setCounts, excluded, setExcluded, doc, notify } = useContext(AppCtx);
  const [blind, setBlind] = useState(true); const [onlyMov, setOnlyMov] = useState(false); const [who, setWho] = useState('');
  const [catSel, setCatSel] = useState(null);
  const [importName, setImportName] = useState('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const cats = [...new Set(inventory.map((x) => x.ins.cat))];
  const activeCats = catSel || new Set(cats);
  const list = inventory.filter((x) => activeCats.has(x.ins.cat) && !excluded.has(key(x.ins.name)) && (!onlyMov || x.consumo !== 0 || x.hasStock));
  const setC = (name, patch) => setCounts((c) => ({ ...c, [key(name)]: { cerrados: null, abierto: null, ...c[key(name)], ...patch } }));
  const contado = (x) => { const c = counts[key(x.ins.name)]; if (!c || (!isNum(c.cerrados) && !isNum(c.abierto)) || !isNum(x.ins.gPres)) return null; return (c.cerrados || 0) * x.ins.gPres + (c.abierto || 0); };
  const diff = (x) => { const c = contado(x); return c !== null && isNum(x.teorico) ? c - x.teorico : null; };
  const done = inventory.filter((x) => contado(x) !== null).length;
  const vDiff = inventory.reduce((s, x) => { const d = diff(x); return s + (d !== null && isNum(x.ins.costoG) ? d * x.ins.costoG : 0); }, 0);
  const toggleCat = (c) => { const n = new Set(activeCats); n.has(c) ? n.delete(c) : n.add(c); setCatSel(n); };

  const downloadExcel = async () => {
    try {
      const bytes = await buildPhysicalInventoryTemplate(inventory);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `conteo_fisico_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setImportError(`No se pudo generar el formato Excel: ${error.message || String(error)}`);
    }
  };
  const downloadCsvTemplate = () => {
    try {
      const blob = new Blob([buildPhysicalInventoryCsv(inventory)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conteo_fisico_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setImportError(`No se pudo generar el formato CSV: ${error.message || String(error)}`);
    }
  };
  const loadPhysicalCount = async (file) => {
    setImporting(true);
    setImportError('');
    try {
      const parsed = file.name.toLowerCase().endsWith('.csv')
        ? parsePhysicalInventoryCsv(await file.text(), inventory)
        : parsePhysicalInventory(await readXlsx(await file.arrayBuffer()), inventory);
      if (parsed.matched > 0) {
        setCounts((current) => {
          const next = { ...current };
          for (const [name, values] of Object.entries(parsed.counts)) {
            next[name] = { ...current[name], ...values };
          }
          return next;
        });
        setImportName(file.name);
        const details = [];
        if (parsed.unmatched.length) details.push(`${parsed.unmatched.length} fila(s) con insumos no reconocidos`);
        if (parsed.errors.length) details.push(`${parsed.errors.length} fila(s) con cantidades inválidas omitidas`);
        notify(`${parsed.matched} insumo(s) importado(s)${details.length ? `. ${details.join('; ')}.` : '.'}`);
        if (parsed.errors.length) setImportError(parsed.errors.slice(0, 3).join(' '));
      } else {
        setImportError(parsed.errors.slice(0, 3).join(' ') || 'No se encontraron conteos válidos para importar.');
      }
    } catch (error) {
      setImportError(error.message || 'No se pudo leer el archivo de inventario.');
    } finally {
      setImporting(false);
    }
  };

  const csv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Insumo', 'Categoría', 'Unidad', 'Teórico (g/ml)', 'Contado (g/ml)', 'Diferencia (g/ml)', 'Diferencia ($)'];
    const lines = inventory.map((x) => { const c = contado(x), d = diff(x); return [x.ins.name, x.ins.cat, x.ins.unit, isNum(x.teorico) ? Math.round(x.teorico) : '', c !== null ? Math.round(c) : '', d !== null ? Math.round(d) : '', d !== null && isNum(x.ins.costoG) ? (d * x.ins.costoG).toFixed(2) : '']; });
    const blob = new Blob(['﻿' + [head, ...lines].map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `conteo_fisico_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <div className="panel">
        <h3>Hoja para imprimir</h3>
        <p className="muted small">Descarga el formato Excel o CSV, llena las cantidades y cárgalo aquí. También puedes cargar el comparativo CSV descargado abajo. Las filas se relacionan por nombre de insumo.</p>
        <div className="print-opts">
          <label className="check"><input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} /> Conteo ciego (no mostrar el teórico en la hoja)</label>
          <label className="check"><input type="checkbox" checked={onlyMov} onChange={(e) => setOnlyMov(e.target.checked)} /> Solo insumos con stock o consumo</label>
          <input className="mini" placeholder="Nombre de quien cuenta (opcional)" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Nombre de quien cuenta" />
        </div>
        <div className="chips">{cats.map((c) => <button key={c} className={'chip-btn' + (activeCats.has(c) ? ' on' : '')} onClick={() => toggleCat(c)} aria-pressed={activeCats.has(c)}>{c}</button>)}</div>
        <p className="muted small">{list.length} insumos en la hoja. Quita uno con el botón “Quitar” de la tabla de abajo.</p>
        <div className="chips">
          <button className="btn primary" onClick={() => window.print()}><AppIcon name="printer" /> Imprimir hoja de conteo</button>
          <button className="btn" onClick={downloadExcel}><AppIcon name="download" /> Descargar formato Excel</button>
          <button className="btn" onClick={downloadCsvTemplate}><AppIcon name="download" /> Descargar formato CSV</button>
          <FilePick id="file-conteo-fisico" label="Cargar conteo físico" hint="Sube el formato .xlsx o .csv con las cantidades capturadas." accept=".xlsx,.csv,text/csv" file={importName} onFile={loadPhysicalCount} error={importError || (importing ? 'Leyendo archivo…' : '')} />
        </div>
      </div>
      <div className="stats row">
        <Stat label="Contados" value={`${done} de ${inventory.length}`} />
        <Stat label="Diferencia valorizada" value={money(vDiff)} sub="contado − teórico (− = faltante)" tone={Math.abs(vDiff) < 1 ? undefined : vDiff < 0 ? 'bad' : 'warn'} />
        <button className="btn" onClick={csv}><AppIcon name="download" /> Descargar comparativo (CSV)</button>
      </div>
      <div className="table-wrap">
        <table className="tbl compact">
          <thead><tr><th>Insumo</th><th className="r">Teórico</th><th className="r">Cerradas<br /><small>(presentaciones)</small></th><th className="r">Abierta<br /><small>(g / ml restantes)</small></th><th className="r">Contado</th><th className="r">Diferencia</th><th /></tr></thead>
          <tbody>
            {groupBy(list, (x) => x.ins.cat).map(([cat, items]) => (
              <React.Fragment key={cat}>
                <tr className="group"><td colSpan={7}>{cat}</td></tr>
                {items.map((x) => {
                  const i = x.ins; const c = counts[key(i.name)] || {}; const ct = contado(x); const d = diff(x);
                  return (
                    <tr key={i.row}>
                      <td><strong>{i.name}</strong><div className="muted small">{i.pres}{isNum(i.gPres) ? ` · ${num(i.gPres, 0)} ${i.unit === 'pza' ? 'g' : i.unit}` : ' · falta contenido'}</div></td>
                      <td className="r">{isNum(x.teorico) ? `${num(x.natural(x.teorico), 0)} ${x.unitLabel}` : '—'}</td>
                      <td className="r"><NumInput value={c.cerrados ?? null} onChange={(v) => setC(i.name, { cerrados: v })} aria-label={`Cerradas de ${i.name}`} /></td>
                      <td className="r"><NumInput value={c.abierto ?? null} onChange={(v) => setC(i.name, { abierto: v })} aria-label={`Abierta de ${i.name}`} /></td>
                      <td className="r">{ct !== null ? `${num(x.natural(ct), 0)} ${x.unitLabel}` : '—'}</td>
                      <td className="r">{d !== null ? <Badge tone={Math.abs(d) < 1 ? 'good' : d < 0 ? 'bad' : 'warn'}>{d > 0 ? '+' : ''}{num(x.natural(d), 0)} {x.unitLabel}</Badge> : '—'}</td>
                      <td><button className="link" onClick={() => { setExcluded((s) => new Set([...s, key(i.name)])); notify(`"${i.name}" quitado de la hoja.`); }}>Quitar</button></td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {excluded.size > 0 && <p className="muted small">{excluded.size} insumo(s) quitado(s) de la hoja. <button className="link" onClick={() => setExcluded(new Set())}>Restaurar todos</button></p>}
      {createPortal(<PrintSheet list={list} blind={blind} who={who} doc={doc} />, document.getElementById('print-root'))}
    </>
  );
}

function PrintSheet({ list, blind, who, doc }) {
  return (
    <div className="print-sheet">
      <header>
        <h1>Camcakes · Hoja de conteo de inventario físico</h1>
        <div className="meta">
          <span>Fecha: {longDate()}</span>
          <span>Periodo de ventas: {doc?.meta.periodo || '—'}</span>
          <span>Contó: {who || '________________'}</span>
          <span>Revisó: ________________</span>
        </div>
        <p>Cuenta las presentaciones <strong>cerradas</strong> y, de la que esté abierta, anota lo que queda (g, ml o piezas). {blind ? 'El teórico no se muestra a propósito.' : ''}</p>
      </header>
      {groupBy(list, (x) => x.ins.cat).map(([cat, items]) => (
        <table key={cat}>
          <caption>{cat}</caption>
          <thead><tr><th className="chk">✓</th><th>Insumo</th><th>Presentación</th>{!blind && <th className="r">Teórico</th>}<th className="box">Cerradas</th><th className="box">Abierta (g/ml/pza)</th><th className="obs">Observaciones</th></tr></thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.ins.row}>
                <td className="chk"><span className="print-check-box" /></td><td><strong>{x.ins.name}</strong></td>
                <td>{x.ins.pres || x.ins.unit}{isNum(x.ins.gPres) ? ` (${num(x.ins.gPres, 0)} ${x.ins.unit === 'pza' ? 'g' : x.ins.unit})` : ''}</td>
                {!blind && <td className="r">{isNum(x.teorico) ? `${num(x.natural(x.teorico), 0)} ${x.unitLabel}` : '—'}</td>}
                <td className="box" /><td className="box" /><td className="obs" />
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      <footer>Firma de quien contó: ____________________ &nbsp;&nbsp; Firma de quien revisó: ____________________</footer>
    </div>
  );
}
