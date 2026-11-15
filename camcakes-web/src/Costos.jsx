import React, { useContext, useMemo, useState } from 'react';
import { AppCtx } from './App.jsx';
import ProductDetail, { toneLabel } from './ProductDetail.jsx';
import { Badge, Drawer, Empty, NumInput, Segmented, Stat } from './ui.jsx';
import { CAT_TITLE } from './Menu.jsx';
import { money, money4, num, pct, costTone, isNum } from './lib/format.js';
import { key, myoSelection } from './lib/engine.js';

const TABS = [['productos', 'Productos'], ['insumos', 'Insumos y precios'], ['recetas', 'Recetas'], ['myo', 'Make Your Own'], ['ventas', 'Ventas del periodo'], ['params', 'Parámetros']];

export default function Costos() {
  const [tab, setTab] = useState('productos');
  const { sales } = useContext(AppCtx);
  return (
    <section>
      <div className="section-head"><div><h1>Costos</h1><p className="muted">Cuánto cuesta producir cada producto y qué margen deja. Edita precios o recetas y se recalcula al instante.</p></div></div>
      <Segmented value={tab} onChange={setTab} label="Costos" options={TABS.map(([v, l]) => ({ value: v, label: l }))} />
      <div className="tab-body">
        {tab === 'productos' && <ProductosTab />}
        {tab === 'insumos' && <InsumosTab />}
        {tab === 'recetas' && <RecetasTab />}
        {tab === 'myo' && <MyoTab />}
        {tab === 'ventas' && <VentasTab />}
        {tab === 'params' && <ParamsTab />}
      </div>
    </section>
  );
}

function ProductosTab() {
  const { costs, actions } = useContext(AppCtx);
  const [sort, setSort] = useState({ k: 'pct', dir: -1 });
  const [cat, setCat] = useState('all');
  const [goalPct, setGoalPct] = useState(35);
  const [open, setOpen] = useState(null);
  const goal = goalPct / 100;
  const rows = useMemo(() => {
    const r = costs.prods.filter((p) => cat === 'all' || p.cat === cat);
    const get = { nombre: (p) => p.nombre, cat: (p) => p.cat, precio: (p) => p.precio, neto: (p) => p.neto, total: (p) => p.total, utilidad: (p) => p.utilidad, pct: (p) => p.pct };
    return [...r].sort((a, b) => { const x = get[sort.k](a), y = get[sort.k](b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * sort.dir; });
  }, [costs, sort, cat]);
  const cats = [...new Set(costs.prods.map((p) => p.cat))];
  const ok = costs.prods.filter((p) => isNum(p.pct));
  const worst = [...ok].sort((a, b) => b.pct - a.pct)[0], best = [...ok].sort((a, b) => a.pct - b.pct)[0];
  const over = ok.filter((p) => p.pct > goal).length;
  const th = (k, label, right) => (
    <th className={(right ? 'r ' : '') + 'sortable'} aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => setSort((s) => ({ k, dir: s.k === k ? -s.dir : -1 }))}>{label}{sort.k === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</button>
    </th>
  );
  return (
    <>
      <div className="stats row">
        <Stat label="Costo más alto" value={worst ? pct(worst.pct) : '—'} sub={worst?.nombre} tone="bad" />
        <Stat label="Costo más bajo" value={best ? pct(best.pct) : '—'} sub={best?.nombre} tone="good" />
        <Stat label={`Sobre la meta (${goalPct}%)`} value={`${over} de ${ok.length}`} tone={over ? 'warn' : 'good'} />
        <div className="stat goal"><div className="stat-label">Meta de costo (máx.)</div><div className="goal-input"><NumInput value={goalPct} onChange={(v) => setGoalPct(v ?? 35)} aria-label="Meta de costo en porcentaje" /> %</div><div className="stat-sub">Semáforo: verde ≤ meta, ámbar hasta +10 pts</div></div>
      </div>
      <div className="toolbar">
        <div className="chips">
          <button className={'chip-btn' + (cat === 'all' ? ' on' : '')} onClick={() => setCat('all')}>Todo</button>
          {cats.map((c) => <button key={c} className={'chip-btn' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{CAT_TITLE[c] || c}</button>)}
        </div>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr>{th('nombre', 'Producto')}{th('cat', 'Categoría')}{th('precio', 'Precio', 1)}{th('neto', 'Neto', 1)}{th('total', 'Costo', 1)}{th('utilidad', 'Utilidad', 1)}{th('pct', 'Costo %', 1)}<th>Estado</th></tr></thead>
          <tbody>
            {rows.map((p) => {
              const tone = costTone(p.pct, goal); const isMyo = p.tipo === 'MYO';
              return (
                <tr key={p.row} className="click" tabIndex={0} onClick={() => setOpen(p)} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(p); }}>
                  <td><strong>{p.nombre}</strong></td><td className="muted">{CAT_TITLE[p.cat] || p.cat}</td>
                  <td className="r" onClick={(e) => e.stopPropagation()}><NumInput value={p.precio} onChange={(v) => actions.setProducto(p.row, { precio: v })} aria-label={`Precio de ${p.nombre}`} /></td>
                  <td className="r">{money(p.neto)}</td>
                  <td className="r">{isMyo ? <span className="muted">{money(costs.myo.mejor)}–{money(costs.myo.peor)}</span> : money(p.total)}</td>
                  <td className="r">{isMyo ? '—' : money(p.utilidad)}</td>
                  <td className="r">{isMyo ? '—' : <Badge tone={tone} title={toneLabel(tone)}>{pct(p.pct)}</Badge>}</td>
                  <td>{p.estado === 'OK' || isMyo ? <span className="ok">●</span> : <Badge tone="warn">{p.estado}</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.nombre || ''}>{open ? <ProductDetail product={open} goal={goal} /> : null}</Drawer>
    </>
  );
}

function InsumosTab() {
  const { costs, actions, notify } = useContext(AppCtx);
  const [cat, setCat] = useState('all'); const [q, setQ] = useState(''); const [onlyEst, setOnlyEst] = useState(false); const [adv, setAdv] = useState(false);
  const [adding, setAdding] = useState(false); const [form, setForm] = useState({ cat: '', name: '', unit: 'g', pres: '', cont: null, precio: null });
  const cats = [...new Set(costs.ins.map((i) => i.cat))];
  const rows = costs.ins.filter((i) => (cat === 'all' || i.cat === cat) && (!onlyEst || i.estado !== 'Real') && (!q || i.name.toLowerCase().includes(q.toLowerCase())));
  const est = costs.ins.filter((i) => i.estado !== 'Real').length;
  const submit = () => {
    if (!form.name.trim() || !form.cat.trim()) { notify('Falta categoría o nombre del insumo.'); return; }
    const ok = actions.addInsumo({ ...form, name: form.name.trim(), cat: form.cat.trim(), estado: form.precio != null ? 'Real' : 'Estimado' });
    if (!ok) { notify('Ese insumo ya existe o el Monitor no tiene filas libres (máx. fila 90).'); return; }
    notify(`Insumo "${form.name.trim()}" agregado.`); setForm({ cat: '', name: '', unit: 'g', pres: '', cont: null, precio: null }); setAdding(false);
  };
  return (
    <>
      <div className="note">Los precios en <Badge tone="warn">Estimado</Badge> son aproximados. Al cambiar un precio se marca como <Badge tone="good">Real</Badge>. <strong>{est}</strong> de {costs.ins.length} insumos siguen estimados.</div>
      <div className="toolbar">
        <input type="search" placeholder="Buscar insumo…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar insumo" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría"><option value="all">Todas las categorías</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        <label className="check"><input type="checkbox" checked={onlyEst} onChange={(e) => setOnlyEst(e.target.checked)} /> Solo estimados</label>
        <label className="check"><input type="checkbox" checked={adv} onChange={(e) => setAdv(e.target.checked)} /> Mostrar porciones de uso</label>
        <button className="btn" onClick={() => setAdding((a) => !a)}>{adding ? 'Cancelar' : '+ Agregar insumo'}</button>
      </div>
      {adding && (
        <div className="form-row">
          <input list="cats" placeholder="Categoría" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} aria-label="Categoría del insumo" />
          <datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
          <input placeholder="Nombre exacto" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Nombre del insumo" />
          <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} aria-label="Unidad"><option>g</option><option>ml</option><option>pza</option></select>
          <input placeholder="Presentación (ej. Bote 3 kg)" value={form.pres} onChange={(e) => setForm({ ...form, pres: e.target.value })} aria-label="Presentación" />
          <NumInput value={form.cont} onChange={(v) => setForm({ ...form, cont: v })} placeholder="Contenido" aria-label="Contenido por presentación" />
          <NumInput value={form.precio} onChange={(v) => setForm({ ...form, precio: v })} placeholder="Precio $" aria-label="Precio de compra" />
          <button className="btn primary" onClick={submit}>Agregar</button>
        </div>
      )}
      <div className="table-wrap">
        <table className="tbl compact">
          <thead><tr><th>Insumo</th><th>Presentación</th><th className="r">Contenido</th><th>Unid.</th><th className="r">Precio $</th><th>Precio</th>{<th className="r">Peso/pza (g)</th>}<th className="r">Costo por g/ml/pza</th>{adv && <><th className="r">Uso mín</th><th className="r">Uso máx</th><th className="r">MYO mín</th><th className="r">MYO máx</th></>}<th className="r">Costo por porción</th></tr></thead>
          <tbody>
            {rows.map((i) => {
              const d = costs.insOf(i.name);
              return (
                <tr key={i.row}>
                  <td><strong>{i.name}</strong><div className="muted small">{i.cat}</div></td>
                  <td className="muted">{i.pres}</td>
                  <td className="r"><NumInput value={i.cont} onChange={(v) => actions.setInsumo(i.row, { cont: v })} aria-label={`Contenido de ${i.name}`} /></td>
                  <td className="muted">{i.unit}</td>
                  <td className="r"><NumInput value={i.precio} onChange={(v) => actions.setInsumo(i.row, { precio: v, estado: v == null ? i.estado : 'Real' })} aria-label={`Precio de ${i.name}`} /></td>
                  <td><select value={i.estado || 'Estimado'} onChange={(e) => actions.setInsumo(i.row, { estado: e.target.value })} className={'est ' + (i.estado === 'Real' ? 'good' : 'warn')} aria-label={`Estado del precio de ${i.name}`}><option>Real</option><option>Estimado</option></select></td>
                  <td className="r">{i.unit === 'pza' ? <NumInput value={i.pesoPza} onChange={(v) => actions.setInsumo(i.row, { pesoPza: v })} aria-label={`Peso por pieza de ${i.name}`} /> : <span className="muted">—</span>}</td>
                  <td className="r">{money4(d.costoG)}</td>
                  {adv && ['usoMin', 'usoMax', 'myoMin', 'myoMax'].map((f) => <td className="r" key={f}><NumInput value={i[f]} onChange={(v) => actions.setInsumo(i.row, { [f]: v })} aria-label={`${f} de ${i.name}`} /></td>)}
                  <td className="r">{money(d.costoPorcion)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RecetasTab() {
  const { costs, actions, model } = useContext(AppCtx);
  const [sel, setSel] = useState(costs.prods.find((p) => p.tipo !== 'MYO')?.nombre || '');
  const p = costs.prodByKey.get(key(sel));
  const [add, setAdd] = useState({ ing: '', tipo: 'Ingrediente', manual: null });
  if (!p) return <Empty title="Sin productos">El Monitor no tiene productos.</Empty>;
  const insNames = costs.ins.map((i) => i.name);
  const submit = () => {
    if (!costs.insOf(add.ing)) return;
    actions.addReceta({ producto: p.nombre, ingrediente: costs.insOf(add.ing).name, tipo: add.tipo, manual: add.manual });
    setAdd({ ing: '', tipo: 'Ingrediente', manual: null });
  };
  return (
    <>
      <div className="toolbar">
        <select value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Producto">
          {costs.prods.filter((x) => x.tipo !== 'MYO').map((x) => <option key={x.row} value={x.nombre}>{x.nombre}</option>)}
        </select>
        <div className="inline-fields">
          <label>Precio de menú <NumInput value={p.precio} onChange={(v) => actions.setProducto(p.row, { precio: v })} /></label>
          {p.tipo !== 'Bebida' && <>
            <label>Nieve <select value={p.nieve} onChange={(e) => actions.setProducto(p.row, { nieve: e.target.value })}><option>SI</option><option>NO</option></select></label>
            <label>Crema <select value={p.crema} onChange={(e) => actions.setProducto(p.row, { crema: e.target.value })}><option>SI</option><option>NO</option></select></label></>}
        </div>
      </div>
      <div className="note">Deja “Cantidad manual” vacío para usar la porción estándar del insumo (o los {model.params.relleno} g de relleno repartidos). Escribe un número solo si en ESTE producto lleva otra cantidad.</div>
      <div className="table-wrap">
        <table className="tbl compact">
          <thead><tr><th>Ingrediente</th><th>Tipo</th><th className="r">Estándar</th><th className="r">Cantidad manual</th><th className="r">Usado</th><th className="r">Costo</th><th /></tr></thead>
          <tbody>
            {p.lines.map((l) => {
              const std = costs.insOf(l.ingrediente)?.uso;
              return (
                <tr key={l.row} className={l.estado !== 'OK' ? 'bad-row' : ''}>
                  <td>{l.ingrediente}{l.estado === 'No encontrado' ? <Badge tone="bad">No existe en Insumos</Badge> : null}</td><td className="muted">{l.tipo}</td>
                  <td className="r muted">{l.tipo === 'Relleno' ? 'reparto' : num(std, 1)}</td>
                  <td className="r"><NumInput value={l.manual} onChange={(v) => actions.setReceta(l.row, { manual: v })} aria-label={`Cantidad manual de ${l.ingrediente}`} /></td>
                  <td className="r">{num(l.gramos, 1)}</td><td className="r">{isNum(l.costo) ? money(l.costo) : <Badge tone="warn">{l.estado}</Badge>}</td>
                  <td><button className="icon-btn" onClick={() => actions.removeReceta(l.row)} aria-label={`Quitar ${l.ingrediente}`}>🗑</button></td>
                </tr>
              );
            })}
            <tr className="total"><td colSpan={5}>Costo total (incluye nieve, crema y empaque si aplican)</td><td className="r">{money(p.total)}</td><td /></tr>
          </tbody>
        </table>
      </div>
      <div className="form-row">
        <input list="insnames" placeholder="Agregar ingrediente (nombre del insumo)" value={add.ing} onChange={(e) => setAdd({ ...add, ing: e.target.value })} aria-label="Ingrediente a agregar" />
        <datalist id="insnames">{insNames.map((n) => <option key={n} value={n} />)}</datalist>
        <select value={add.tipo} onChange={(e) => setAdd({ ...add, tipo: e.target.value })} aria-label="Tipo"><option>Ingrediente</option><option>Topping</option><option>Relleno</option><option>Empaque</option></select>
        <NumInput value={add.manual} onChange={(v) => setAdd({ ...add, manual: v })} placeholder="Cantidad manual" aria-label="Cantidad manual" />
        <button className="btn" onClick={submit} disabled={!costs.insOf(add.ing)}>+ Agregar</button>
      </div>
    </>
  );
}

function MyoTab() {
  const { costs, model } = useContext(AppCtx);
  const [selR, setSelR] = useState(new Set()); const [selT, setSelT] = useState(new Set()); const [nieve, setNieve] = useState(true); const [crema, setCrema] = useState(true);
  const toggle = (set, setter, name) => { const n = new Set(set); n.has(name) ? n.delete(name) : n.add(name); setter(n); };
  const r = myoSelection(model, costs, { rellenos: selR, toppings: selT, nieve, crema });
  const myoP = costs.prods.find((p) => p.tipo === 'MYO');
  const neto = myoP?.neto;
  const over = r.rawG > model.params.tope;
  return (
    <div className="myo">
      <div className="myo-cols">
        <div>
          <h3>Rellenos <small className="muted">({model.params.relleno} g en total, repartidos)</small></h3>
          <div className="checks">{costs.rellenos.map((i) => <label key={i.name} className="check"><input type="checkbox" checked={selR.has(i.name)} onChange={() => toggle(selR, setSelR, i.name)} /> {i.name} <span className="muted small">{money4(i.costoG)}/g</span></label>)}</div>
        </div>
        <div>
          <h3>Toppings <small className="muted">(tope {model.params.tope} g)</small></h3>
          <div className="checks">{costs.toppings.map((i) => <label key={i.name} className="check"><input type="checkbox" checked={selT.has(i.name)} onChange={() => toggle(selT, setSelT, i.name)} /> {i.name} <span className="muted small">{num(i.myo, 0)} g · {money(i.myoCosto)}</span></label>)}</div>
        </div>
        <aside className="myo-result">
          <h3>Esta crepa</h3>
          <dl>
            <dt>Masa</dt><dd>{money(r.cMasa)}</dd>
            <dt>Rellenos ({num(r.gramosRelleno, 0)} g)</dt><dd>{money(r.cR)}</dd>
            <dt>Toppings ({num(r.gramosToppings, 0)} g)</dt><dd>{money(r.cT)}</dd>
            <dt><label className="check"><input type="checkbox" checked={nieve} onChange={(e) => setNieve(e.target.checked)} /> Nieve</label></dt><dd>{money(r.cNieve)}</dd>
            <dt><label className="check"><input type="checkbox" checked={crema} onChange={(e) => setCrema(e.target.checked)} /> Crema batida</label></dt><dd>{money(r.cCrema)}</dd>
            <dt>Empaque</dt><dd>{money(r.empaque)}</dd>
            <dt className="tot">Costo total</dt><dd className="tot">{money(r.total)}</dd>
            <dt>Utilidad</dt><dd>{money(isNum(neto) ? neto - r.total : null)}</dd>
            <dt>Costo / precio neto</dt><dd><Badge tone={costTone(isNum(neto) ? r.total / neto : null)}>{pct(isNum(neto) ? r.total / neto : null)}</Badge></dd>
          </dl>
          {over && <p className="warn-text">Los toppings suman {num(r.rawG, 0)} g y pasan el tope de {model.params.tope} g: se reducen a {num(r.gramosToppings, 0)} g (factor {r.factor.toFixed(2)}).</p>}
          {r.missing > 0 && <p className="warn-text">{r.missing} opción(es) seleccionada(s) sin precio de insumo: el costo está incompleto.</p>}
        </aside>
      </div>
      <div className="stats row">
        <Stat label="Mejor caso" value={money(costs.myo.mejor)} sub="relleno más barato, sin toppings" tone="good" />
        <Stat label="Peor caso" value={money(costs.myo.peor)} sub="relleno más caro + todos los toppings al tope" tone="bad" />
        <Stat label="Precio neto" value={money(neto)} sub={`Precio de menú ${money(myoP?.precio)}`} />
        <Stat label="Utilidad en peor caso" value={money(isNum(neto) && isNum(costs.myo.peor) ? neto - costs.myo.peor : null)} />
      </div>
    </div>
  );
}

function VentasTab() {
  const { sales, doc, setSection } = useContext(AppCtx);
  const agg = useMemo(() => {
    if (!sales) return [];
    const m = new Map();
    for (const r of sales.rows) {
      if (r.res.status !== 'ok') continue;
      const label = r.res.kind === 'prod' ? r.res.producto : r.res.kind === 'relleno' || r.res.kind === 'topping' ? 'Crepa Make Your Own (relleno + toppings)' : '?';
      const a = m.get(label) || { label, qty: 0, neto: 0, costo: 0, falta: 0 };
      if (r.res.kind !== 'topping') a.qty += r.line.qty;
      a.neto += r.line.sinIva;
      if (isNum(r.costo)) a.costo += r.costo; else a.falta += r.line.qty;
      m.set(label, a);
    }
    return [...m.values()].sort((a, b) => b.neto - a.neto);
  }, [sales]);
  if (!sales) return <Empty title="Falta el reporte del POS">Carga el DOC de “Ventas por producto” (botón 🧾 arriba) para ver la rentabilidad real del periodo.</Empty>;
  const t = sales.totals; const util = t.sinIva - sales.costoTotal;
  return (
    <>
      <p className="muted">Periodo del reporte: <strong>{doc.meta.periodo || '—'}</strong>. Solo se cuentan las ventas identificadas con receta.</p>
      <div className="stats row">
        <Stat label="Venta neta identificada" value={money(t.sinIva)} sub={`${num(t.qty, 0)} unidades`} />
        <Stat label="Costo de lo vendido" value={money(sales.costoTotal)} sub={sales.costoFaltante ? `${sales.costoFaltante} u. sin costo completo` : undefined} />
        <Stat label="Utilidad estimada" value={money(util)} sub={pct(t.sinIva ? sales.costoTotal / t.sinIva : null) + ' costo'} tone="good" />
        <Stat label="Sin identificar / ignoradas" value={`${num(t.qtyUnm, 0)} / ${num(t.qtyIgn, 0)}`} sub={`${money(t.sinIvaUnm)} sin identificar`} tone={t.qtyUnm ? 'warn' : undefined} />
      </div>
      {t.qtyUnm > 0 && <div className="note warn">Hay ventas sin identificar ({money(t.sinIvaUnm)} sin IVA). <button className="link" onClick={() => setSection('inventario')}>Asígnalas en Inventario → Ventas del POS</button> para que descuenten insumos.</div>}
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Producto</th><th className="r">Unidades</th><th className="r">Venta neta</th><th className="r">Costo</th><th className="r">Utilidad</th><th className="r">Costo %</th></tr></thead>
          <tbody>
            {agg.map((a) => (
              <tr key={a.label}><td><strong>{a.label}</strong></td><td className="r">{num(a.qty, 0)}</td><td className="r">{money(a.neto)}</td><td className="r">{money(a.costo)}{a.falta ? <Badge tone="warn" title="Faltan precios">incompleto</Badge> : null}</td>
                <td className="r">{money(a.neto - a.costo)}</td><td className="r">{a.neto > 0 ? pct(a.costo / a.neto) : '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ParamsTab() {
  const { model, actions } = useContext(AppCtx);
  const p = model.params;
  const F = ({ label, hint, children }) => <div className="param"><label><span>{label}</span>{children}</label><small className="muted">{hint}</small></div>;
  return (
    <div className="params">
      <F label="Relleno total por crepa (g)" hint="Con 2 rellenos se reparte en partes iguales."><NumInput value={p.relleno} onChange={(v) => actions.setParam('relleno', v ?? 0)} /></F>
      <F label="Tope de toppings en Make Your Own (g)" hint="Si el cliente elige más, se reducen proporcionalmente."><NumInput value={p.tope} onChange={(v) => actions.setParam('tope', v ?? 0)} /></F>
      <F label="IVA incluido en el precio de menú (%)" hint="Para calcular precio neto. Usa 0 si prefieres ver todo con IVA."><NumInput value={Math.round(p.iva * 10000) / 100} onChange={(v) => actions.setParam('iva', (v ?? 0) / 100)} /></F>
      <F label="Empaque por crepa ($)" hint="Caja, tenedor, servilleta… se suma al costo de cada crepa."><NumInput value={p.empaque} onChange={(v) => actions.setParam('empaque', v ?? 0)} /></F>
    </div>
  );
}
