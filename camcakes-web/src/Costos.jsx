import React, { useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppCtx } from './App.jsx';
import ProductDetail, { toneLabel } from './ProductDetail.jsx';
import { AppIcon, Badge, Drawer, Empty, NumInput, Segmented, Stat } from './ui.jsx';
import { CAT_TITLE } from './Menu.jsx';
import { money, money4, num, pct, costTone, isNum } from './lib/format.js';
import { key, myoSelection } from './lib/engine.js';
import { computeExpenses } from './lib/expenses.js';

const TABS = [['productos', 'Productos'], ['insumos', 'Insumos y precios'], ['recetas', 'Recetas'], ['myo', 'Make Your Own'], ['ventas', 'Ventas del periodo'], ['gastos', 'Gastos'], ['params', 'Parámetros'], ['sinliga', 'Sin receta']];

export default function Costos() {
  const [tab, setTab] = useState('productos');
  const { sales } = useContext(AppCtx);
  const [printTab, setPrintTab] = useState(null);
  const printPdf = () => {
    setPrintTab(tab);
    setTimeout(() => window.print(), 100);
  };
  return (
    <section>
      <div className="section-head">
        <div><h1>Costos</h1><p className="muted">Cuánto cuesta producir cada producto y qué margen deja. Edita precios o recetas y se recalcula al instante.</p></div>
        <button className="btn" onClick={printPdf}><AppIcon name="printer" /> Generar PDF</button>
      </div>
      <Segmented value={tab} onChange={setTab} label="Costos" options={TABS.map(([v, l]) => ({ value: v, label: l }))} />
      <div className="tab-body">
        {tab === 'productos' && <ProductosTab />}
        {tab === 'insumos' && <InsumosTab />}
        {tab === 'recetas' && <RecetasTab />}
        {tab === 'myo' && <MyoTab />}
        {tab === 'ventas' && <VentasTab />}
        {tab === 'gastos' && <GastosTab />}
        {tab === 'params' && <ParamsTab />}
        {tab === 'sinliga' && <SinRecetaTab onOpenRecetas={() => setTab('recetas')} />}
      </div>
      {createPortal(<CostsPrintSheet tab={printTab} />, document.getElementById('print-root'))}
    </section>
  );
}

function GastosTab() {
  const { model, costs, sales, actions } = useContext(AppCtx);
  const [fixedVisible, setFixedVisible] = useState(null);
  const [variableVisible, setVariableVisible] = useState(null);
  const expenses = model.expenses;
  const summary = useMemo(() => computeExpenses(expenses, costs, sales), [expenses, costs, sales]);

  if (!expenses) return <Empty title="Este Monitor no incluye la hoja Gastos">Carga el archivo de Monitor que contiene la hoja <strong>Gastos</strong> para consultar, editar y exportar sus datos.</Empty>;

  const fixedLast = expenses.fixed.reduce((last, item, index) => (item.name.trim() ? index + 1 : last), 0);
  const variableLast = expenses.variable.reduce((last, item, index) => (item.name.trim() ? index + 1 : last), 0);
  const visibleFixed = Math.max(fixedVisible ?? fixedLast + 1, 1);
  const visibleVariable = Math.max(variableVisible ?? variableLast + 1, 1);
  const updateExpense = (group, row, patch) => actions.setExpenseRow(group, row, patch);
  const numField = (value, onChange, label, percent = false) => (
    <span className="expense-number">
      <NumInput value={percent ? (isNum(value) ? value * 100 : null) : value}
        onChange={(v) => onChange(v == null ? null : Math.max(0, percent ? v / 100 : v))}
        aria-label={label} />
      {percent ? '%' : null}
    </span>
  );
  const textField = (value, onChange, label) => (
    <input value={value || ''} onChange={(e) => onChange(e.target.value)} aria-label={label} />
  );
  const updateListItem = (group, row, patch) => actions.setExpenses({
    [group]: expenses[group].map((item) => (item.row === row ? { ...item, ...patch } : item)),
  });
  const frequencyByName = new Map(expenses.frequencies.map((frequency) => [frequency.name, frequency.payments]));
  const status = (item) => !item.name.trim() ? ''
    : item.include === 'NO' ? 'Excluido'
      : !isNum(item.amount) ? 'Falta monto'
        : !frequencyByName.has(item.frequency) ? 'Falta frecuencia' : 'OK';

  return (
    <>
      <p className="muted">Captura los gastos del periodo. Las cantidades se guardan en la hoja <strong>Gastos</strong> del Excel; los cálculos del Monitor se actualizan aquí al instante.</p>
      <div className="params expense-settings">
        <div className="param"><label><span>Días del periodo</span><NumInput value={expenses.periodDays} onChange={(v) => actions.setExpenses({ periodDays: Math.max(0, v ?? 0) })} aria-label="Días del periodo" /></label><small className="muted">Los gastos fijos se prorratean por día.</small></div>
        <div className="param"><label><span>Fuente de venta</span><select value={expenses.source} onChange={(e) => actions.setExpenses({ source: e.target.value })}><option>Hoja Ventas</option><option>Manual</option></select></label><small className="muted">Hoja Ventas usa las ventas identificadas del reporte POS cargado en la web.</small></div>
        <div className="param"><label><span>Venta neta manual</span><NumInput value={expenses.manualSales} disabled={expenses.source !== 'Manual'} onChange={(v) => actions.setExpenses({ manualSales: v == null ? null : Math.max(0, v) })} aria-label="Venta neta manual sin IVA" /></label><small className="muted">Sin IVA; solo se usa con fuente Manual.</small></div>
        <div className="param"><label><span>Margen bruto manual</span><span className="expense-number"><NumInput value={isNum(expenses.manualMargin) ? expenses.manualMargin * 100 : null} disabled={expenses.source !== 'Manual'} onChange={(v) => actions.setExpenses({ manualMargin: v == null ? null : Math.max(0, v / 100) })} aria-label="Margen bruto manual en porcentaje" />%</span></label><small className="muted">Opcional. Si queda vacío se usa el promedio del menú.</small></div>
      </div>
      {expenses.source === 'Hoja Ventas' && !sales && <div className="note warn">Carga el reporte del POS para calcular ventas y utilidad de este periodo; también puedes cambiar la fuente a Manual.</div>}
      {expenses.source === 'Hoja Ventas' && sales?.costoFaltante > 0 && <div className="note warn">Hay {sales.costoFaltante} unidad(es) vendida(s) sin costo completo; la utilidad calculada puede quedar incompleta.</div>}
      {expenses.source === 'Hoja Ventas' && sales?.totals.sinReceta > 0 && <div className="note warn">Hay {sales.totals.sinReceta} unidad(es) identificada(s) sin receta; su costo no está incluido en la utilidad calculada.</div>}
      <div className="expense-lookups">
        <div>
          <h3>Frecuencias de pago</h3>
          <div className="table-wrap"><table className="tbl compact"><thead><tr><th>Frecuencia</th><th className="r">Pagos por año</th></tr></thead>
            <tbody>{expenses.frequencies.map((item) => <tr key={item.row}><td>{textField(item.name, (name) => updateListItem('frequencies', item.row, { name }), `Frecuencia de pago fila ${item.row}`)}</td><td className="r">{numField(item.payments, (payments) => updateListItem('frequencies', item.row, { payments }), `Pagos por año de ${item.name}`)}</td></tr>)}</tbody>
          </table></div>
        </div>
        <div>
          <h3>Categorías de gastos fijos</h3>
          <div className="table-wrap"><table className="tbl compact"><thead><tr><th>Categoría</th></tr></thead>
            <tbody>{expenses.categories.map((item) => <tr key={item.row}><td>{textField(item.name, (name) => updateListItem('categories', item.row, { name }), `Categoría de gasto fila ${item.row}`)}</td></tr>)}</tbody>
          </table></div>
        </div>
      </div>
      <div className="stats row">
        <Stat label="Venta neta" value={money(summary.revenue)} sub="sin IVA" />
        <Stat label="Utilidad bruta" value={money(summary.grossProfit)} sub={`Margen ${pct(summary.grossMargin)}`} />
        <Stat label="Gastos fijos" value={money(summary.fixedTotal)} sub={`${money(summary.fixedMonthly)} al mes`} />
        <Stat label="Gastos variables" value={money(summary.variableTotal)} sub={pct(summary.variableRate)} />
        <Stat label="Utilidad después de gastos" value={money(summary.profitAfterExpenses)} tone={isNum(summary.profitAfterExpenses) && summary.profitAfterExpenses < 0 ? 'bad' : 'good'} />
      </div>
      <div className="stats row">
        <Stat label="Punto de equilibrio" value={isNum(summary.breakEven) ? money(summary.breakEven) : isNum(summary.marginAfterVariable) ? 'No alcanza' : '—'} sub="venta neta del periodo" />
        <Stat label="Venta diaria de equilibrio" value={money(summary.dailyBreakEven)} />
        <Stat label="Avance contra equilibrio" value={pct(summary.breakEvenProgress)} tone={isNum(summary.breakEvenProgress) && summary.breakEvenProgress >= 1 ? 'good' : 'warn'} />
      </div>
      <h2>Gastos fijos</h2>
      <div className="table-wrap">
        <table className="tbl expense-table">
          <thead><tr><th>Concepto</th><th>Categoría</th><th>Frecuencia</th><th className="r">Monto por pago</th><th>Incluir</th><th className="r">Mensual</th><th className="r">Periodo</th><th>Notas</th><th>Estado</th><th></th></tr></thead>
          <tbody>{expenses.fixed.slice(0, visibleFixed).map((item) => {
            const result = summary.fixed.find((row) => row.row === item.row);
            return <tr key={item.row}>
              <td>{textField(item.name, (name) => updateExpense('fixed', item.row, { name }), `Concepto de gasto fijo fila ${item.row}`)}</td>
              <td><select value={item.category} onChange={(e) => updateExpense('fixed', item.row, { category: e.target.value })} aria-label={`Categoría de ${item.name || 'gasto fijo'}`}><option value="">Sin categoría</option>{expenses.categories.filter((cat) => cat.name).map((cat) => <option key={cat.row} value={cat.name}>{cat.name}</option>)}</select></td>
              <td><select value={item.frequency} onChange={(e) => updateExpense('fixed', item.row, { frequency: e.target.value })} aria-label={`Frecuencia de ${item.name || 'gasto fijo'}`}><option value="">Sin frecuencia</option>{expenses.frequencies.filter((frequency) => frequency.name).map((frequency) => <option key={frequency.row} value={frequency.name}>{frequency.name}</option>)}</select></td>
              <td className="r">{numField(item.amount, (amount) => updateExpense('fixed', item.row, { amount }), `Monto de ${item.name || 'gasto fijo'}`)}</td>
              <td><select value={item.include} onChange={(e) => updateExpense('fixed', item.row, { include: e.target.value })} aria-label={`Incluir ${item.name || 'gasto fijo'}`}><option>SI</option><option>NO</option></select></td>
              <td className="r">{money(result?.monthly)}</td><td className="r">{money(result?.period)}</td>
              <td>{textField(item.notes, (notes) => updateExpense('fixed', item.row, { notes }), `Notas de ${item.name || 'gasto fijo'}`)}</td>
              <td><Badge tone={status(item) === 'OK' || status(item) === 'Excluido' ? 'good' : 'warn'}>{status(item)}</Badge></td>
              <td><button className="icon-btn" onClick={() => updateExpense('fixed', item.row, { name: '', category: '', frequency: '', amount: null, include: 'SI', notes: '' })} aria-label={`Quitar gasto fijo ${item.name || item.row}`}><AppIcon name="trash" /></button></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {visibleFixed < expenses.fixed.length && <button className="btn" onClick={() => setFixedVisible(Math.min(visibleFixed + 1, expenses.fixed.length))}>+ Agregar gasto fijo</button>}
      <div className="table-wrap expense-categories">
        <table className="tbl compact"><thead><tr><th>Categoría</th><th className="r">Mensual</th><th className="r">En el periodo</th></tr></thead>
          <tbody>{summary.categoryTotals.map((item) => <tr key={item.name}><td>{item.name}</td><td className="r">{money(item.monthly)}</td><td className="r">{money(item.period)}</td></tr>)}</tbody>
        </table>
      </div>
      <h2>Gastos variables</h2>
      <p className="muted">Se capturan como porcentaje de la venta neta y cambian conforme a las ventas del periodo.</p>
      <div className="table-wrap">
        <table className="tbl expense-table">
          <thead><tr><th>Concepto</th><th className="r">% de la venta neta</th><th>Incluir</th><th className="r">Monto del periodo</th><th>Notas</th><th></th></tr></thead>
          <tbody>{expenses.variable.slice(0, visibleVariable).map((item) => {
            const result = summary.variable.find((row) => row.row === item.row);
            return <tr key={item.row}>
              <td>{textField(item.name, (name) => updateExpense('variable', item.row, { name }), `Concepto de gasto variable fila ${item.row}`)}</td>
              <td className="r">{numField(item.rate, (rate) => updateExpense('variable', item.row, { rate }), `Porcentaje de ${item.name || 'gasto variable'}`, true)}</td>
              <td><select value={item.include} onChange={(e) => updateExpense('variable', item.row, { include: e.target.value })} aria-label={`Incluir ${item.name || 'gasto variable'}`}><option>SI</option><option>NO</option></select></td>
              <td className="r">{money(result?.period)}</td>
              <td>{textField(item.notes, (notes) => updateExpense('variable', item.row, { notes }), `Notas de ${item.name || 'gasto variable'}`)}</td>
              <td><button className="icon-btn" onClick={() => updateExpense('variable', item.row, { name: '', rate: null, include: 'SI', notes: '' })} aria-label={`Quitar gasto variable ${item.name || item.row}`}><AppIcon name="trash" /></button></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {visibleVariable < expenses.variable.length && <button className="btn" onClick={() => setVariableVisible(Math.min(visibleVariable + 1, expenses.variable.length))}>+ Agregar gasto variable</button>}
      <h2>Escenarios de venta</h2>
      <div className="table-wrap"><table className="tbl compact"><thead><tr><th>Escenario</th><th className="r">% del equilibrio</th><th className="r">Venta neta</th><th className="r">Utilidad bruta</th><th className="r">Gastos fijos</th><th className="r">Gastos variables</th><th className="r">Utilidad final</th></tr></thead>
        <tbody>{summary.scenarios.map((scenario) => <tr key={scenario.row}>
          <td>Escenario {scenario.row - 29}</td><td className="r">{numField(expenses.scenarios.find((item) => item.row === scenario.row)?.factor, (factor) => actions.setExpenses({ scenarios: expenses.scenarios.map((item) => item.row === scenario.row ? { ...item, factor } : item) }), `Porcentaje del equilibrio escenario ${scenario.row - 29}`, true)}</td>
          <td className="r">{money(scenario.revenue)}</td><td className="r">{money(scenario.grossProfit)}</td><td className="r">{money(scenario.fixed)}</td><td className="r">{money(scenario.variable)}</td><td className="r">{money(scenario.profit)}</td>
        </tr>)}</tbody>
      </table></div>
    </>
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

function EditableName({ value, onCommit, label, className = '', datalistId, placeholder }) {
  const [draft, setDraft] = useState(value || '');
  useEffect(() => setDraft(value || ''), [value]);
  const commit = () => {
    const clean = draft.trim();
    if (!clean) { setDraft(value || ''); return; }
    if (clean !== value && onCommit(clean) === false) setDraft(value || '');
  };
  return (
    <input
      className={className}
      value={draft}
      list={datalistId}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      aria-label={label}
    />
  );
}

function InsumosTab() {
  const { costs, model, actions, notify } = useContext(AppCtx);
  const [cat, setCat] = useState('all'); const [q, setQ] = useState(''); const [onlyEst, setOnlyEst] = useState(false); const [adv, setAdv] = useState(false);
  const [adding, setAdding] = useState(false); const [form, setForm] = useState({ cat: '', name: '', unit: 'g', pres: '', cont: null, precio: null });
  const [catRename, setCatRename] = useState(''); const [catNewName, setCatNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const cats = [...new Set([...(model.categorias || []), ...costs.ins.map((i) => i.cat)])].filter(Boolean);
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
      <div className="form-row category-manager">
        <input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (actions.createCategoria(newCategory)) setNewCategory('');
              else if (newCategory.trim()) notify('Esa categoría ya existe.');
            }
          }}
          placeholder="Nombre de nueva categoría"
          aria-label="Nueva categoría"
        />
        <button
          className="btn"
          onClick={() => {
            if (actions.createCategoria(newCategory)) setNewCategory('');
            else if (newCategory.trim()) notify('Esa categoría ya existe.');
          }}
          disabled={!newCategory.trim()}
        >
          + Crear categoría
        </button>
        <select value={catRename} onChange={(e) => setCatRename(e.target.value)} aria-label="Categoría a renombrar">
          <option value="">Categoría a renombrar</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <EditableName
          value={catNewName}
          onCommit={(name) => {
            if (!catRename) { notify('Primero selecciona la categoría que quieres renombrar.'); return false; }
            const ok = actions.renameCategoria(catRename, name);
            if (!ok) return false;
            notify(`Categoría "${catRename}" renombrada como "${name}".`);
            setCatRename(name);
            setCatNewName('');
            return true;
          }}
          label="Nuevo nombre de categoría"
          placeholder="Nuevo nombre"
        />
        <span className="muted small">Las categorías también pueden escribirse directamente al editar A: Categoría o al agregar un insumo.</span>
      </div>
      <datalist id="inscategories">{cats.map((c) => <option key={c} value={c} />)}</datalist>
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
          <thead><tr><th>Insumo</th><th>Categoría</th><th>Presentación</th><th className="r">Contenido</th><th>Unid.</th><th className="r">Precio $</th><th>Precio</th>{<th className="r">Peso/pza (g)</th>}<th className="r">Costo por g/ml/pza</th>{adv && <><th className="r">Uso mín</th><th className="r">Uso máx</th><th className="r">MYO mín</th><th className="r">MYO máx</th></>}<th className="r">Costo por porción</th></tr></thead>
          <tbody>
            {rows.map((i) => {
              const d = costs.insOf(i.name);
              return (
                <tr key={i.row}>
                  <td>
                    <EditableName
                      value={i.name}
                      onCommit={(name) => {
                        const ok = actions.renameInsumo(i.row, name);
                        if (!ok) notify('Ese nombre ya existe en los insumos.');
                        return ok;
                      }}
                      label={`Nombre del insumo ${i.name}`}
                      className="name-edit"
                    />
                  </td>
                  <td>
                    <EditableName
                      value={i.cat}
                      onCommit={(name) => {
                        actions.setInsumo(i.row, { cat: name });
                        return true;
                      }}
                      label={`Categoría de ${i.name}`}
                      className="category-edit"
                      datalistId="inscategories"
                    />
                  </td>
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
                  <td><button className="icon-btn" onClick={() => actions.removeReceta(l.row)} aria-label={`Quitar ${l.ingrediente}`}><AppIcon name="trash" /></button></td>
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
  if (!sales) return <Empty title="Falta el reporte del POS">Carga el DOC de “Ventas por producto” desde el botón de reporte de la barra superior para ver la rentabilidad real del periodo.</Empty>;
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
  const costsContext = useContext(AppCtx);
  const kit = p.crepeKit || [];
  const F = ({ label, hint, children }) => <div className="param"><label><span>{label}</span>{children}</label><small className="muted">{hint}</small></div>;
  const setKitItem = (index, patch) => {
    const next = kit.map((item, i) => (i === index ? { ...item, ...patch } : item));
    actions.setParam('crepeKit', next);
  };
  const removeKitItem = (index) => actions.setParam('crepeKit', kit.filter((_, i) => i !== index));
  const addKitItem = () => {
    const first = costsContext.costs?.ins?.find((item) => /empaque/i.test(item.cat));
    if (!first) return;
    if (kit.length >= 12) return;
    actions.setParam('crepeKit', [...kit, { name: first.name, qty: 1 }]);
  };
  return (
    <div className="params">
      <F label="Relleno total por crepa (g)" hint="Con 2 rellenos se reparte en partes iguales."><NumInput value={p.relleno} onChange={(v) => actions.setParam('relleno', v ?? 0)} /></F>
      <F label="Tope de toppings en Make Your Own (g)" hint="Si el cliente elige más, se reducen proporcionalmente."><NumInput value={p.tope} onChange={(v) => actions.setParam('tope', v ?? 0)} /></F>
      <F label="IVA incluido en el precio de menú (%)" hint="Para calcular precio neto. Usa 0 si prefieres ver todo con IVA."><NumInput value={Math.round(p.iva * 10000) / 100} onChange={(v) => actions.setParam('iva', (v ?? 0) / 100)} /></F>
      <F label="Empaque por crepa ($)" hint={kit.length ? 'Calculado automáticamente con los insumos del kit de empaque.' : 'Sin kit configurado; puede capturarse manualmente.'}>
        {kit.length ? <strong>{money(p.crepeKitCost)}</strong> : <NumInput value={p.empaque} onChange={(v) => actions.setParam('empaque', v ?? 0)} />}
      </F>
      <div className="param kit-param">
        <div className="kit-param-head">
          <div>
            <strong>Kit de empaque por crepa</strong>
            <small className="muted">Se descuenta automáticamente por cada crepa vendida.</small>
          </div>
          <strong>{money(p.crepeKitCost)}</strong>
        </div>
        {kit.map((item, index) => (
          <div className="kit-row" key={`${item.name}-${index}`}>
            <select value={item.name} onChange={(e) => setKitItem(index, { name: e.target.value })} aria-label={`Insumo del kit ${index + 1}`}>
              {costsContext.costs.ins.map((ins) => <option key={ins.row} value={ins.name}>{ins.name}</option>)}
            </select>
            <NumInput value={item.qty} onChange={(qty) => setKitItem(index, { qty: qty ?? 0 })} placeholder="Piezas" aria-label={`Piezas de ${item.name}`} />
            <button type="button" className="icon-btn" onClick={() => removeKitItem(index)} aria-label={`Quitar ${item.name}`}><AppIcon name="trash" /></button>
          </div>
        ))}
        <button type="button" className="btn" onClick={addKitItem} disabled={kit.length >= 12}>+ Agregar pieza al kit</button>
      </div>
    </div>
  );
}

function SinRecetaTab({ onOpenRecetas }) {
  const { costs, model } = useContext(AppCtx);
  const linked = new Set();
  for (const recipe of model.recetas || []) linked.add(key(recipe.ingrediente));
  for (const insumo of costs.ins) {
    if (insumo.cat === 'Relleno' || (isNum(insumo.myo) && /^Topping/i.test(insumo.cat))) linked.add(key(insumo.name));
  }
  for (const item of model.params.crepeKit || []) linked.add(key(item.name));
  for (const name of [model.params.masa, model.params.nieve, model.params.crema, model.params.leche]) {
    if (name) linked.add(key(name));
  }
  for (const name of Object.values(model.params.lechas || {})) if (name) linked.add(key(name));

  const unlinked = costs.ins.filter((insumo) => !linked.has(key(insumo.name))).sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name));
  return (
    <>
      <div className="note warn">
        <strong>{unlinked.length} insumo(s) sin usar en recetas</strong>. Revisa si deben agregarse a una receta o si son insumos de venta directa.
      </div>
      {unlinked.length === 0 ? <Empty title="Todo está ligado">Todos los insumos aparecen en al menos una receta o configuración especial.</Empty> : (
        <div className="table-wrap">
          <table className="tbl compact">
            <thead><tr><th>Categoría</th><th>Insumo</th><th>Presentación</th><th className="r">Contenido</th><th className="r">Stock inicial</th><th>Acción</th></tr></thead>
            <tbody>
              {unlinked.map((insumo) => (
                <tr key={insumo.row}>
                  <td className="muted">{insumo.cat || 'Sin categoría'}</td>
                  <td><strong>{insumo.name}</strong></td>
                  <td className="muted">{insumo.pres || '—'}</td>
                  <td className="r">{isNum(insumo.cont) ? `${num(insumo.cont, 1)} ${insumo.unit}` : '—'}</td>
                  <td className="r">{isNum(insumo.stockIni) ? num(insumo.stockIni, 3) : 'Sin capturar'}</td>
                  <td><button className="link" onClick={onOpenRecetas}>Agregar a receta</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function CostsPrintSheet({ tab }) {
  const { costs, model, sales } = useContext(AppCtx);
  if (!tab) return null;
  const expenses = computeExpenses(model.expenses, costs, sales);
  const date = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <div className="print-sheet costs-print-sheet">
      <header>
        <h1>Camcakes · {tab === 'recetas' ? 'Recetas' : tab === 'sinliga' ? 'Insumos sin receta' : tab === 'gastos' ? 'Gastos' : 'Costos'}</h1>
        <p>Generado el {date}</p>
      </header>
      {tab === 'productos' && (
        <table>
          <thead><tr><th>Producto</th><th>Categoría</th><th className="r">Precio</th><th className="r">Neto</th><th className="r">Costo</th><th className="r">Utilidad</th><th className="r">Costo %</th></tr></thead>
          <tbody>{costs.prods.filter((p) => p.tipo !== 'MYO').map((p) => (
            <tr key={p.row}><td>{p.nombre}</td><td>{CAT_TITLE[p.cat] || p.cat}</td><td className="r">{money(p.precio)}</td><td className="r">{money(p.neto)}</td><td className="r">{money(p.total)}</td><td className="r">{money(p.utilidad)}</td><td className="r">{pct(p.pct)}</td></tr>
          ))}</tbody>
        </table>
      )}
      {tab === 'recetas' && (
        <>{[...new Map(costs.rec.map((line) => [line.producto, []])).keys()].map((productName) => {
          const lines = costs.rec.filter((line) => line.producto === productName);
          if (!lines.length) return null;
          const product = costs.prodByKey.get(key(productName));
          return (
            <table key={productName}>
              <caption>{productName}</caption>
              <thead><tr><th>Ingrediente</th><th>Tipo</th><th className="r">Cantidad</th><th className="r">Costo</th></tr></thead>
              <tbody>{lines.map((line) => (
                <tr key={line.row}><td>{line.ingrediente}</td><td>{line.tipo}</td><td className="r">{isNum(line.gramos) ? `${num(line.gramos, 2)} g` : '—'}</td><td className="r">{money(line.costo)}</td></tr>
              ))}
              <tr><td colSpan={3}><strong>Costo total</strong></td><td className="r"><strong>{money(product?.total)}</strong></td></tr></tbody>
            </table>
          );
        })}</>
      )}
      {tab === 'insumos' && (
        <table>
          <thead><tr><th>Categoría</th><th>Insumo</th><th>Presentación</th><th className="r">Contenido</th><th className="r">Precio</th><th>Estado</th><th className="r">Costo / unidad</th></tr></thead>
          <tbody>{costs.ins.map((insumo) => (
            <tr key={insumo.row}><td>{insumo.cat}</td><td>{insumo.name}</td><td>{insumo.pres}</td><td className="r">{isNum(insumo.cont) ? `${num(insumo.cont, 1)} ${insumo.unit}` : '—'}</td><td className="r">{money(insumo.precio)}</td><td>{insumo.estado}</td><td className="r">{money4(insumo.costoG)}</td></tr>
          ))}</tbody>
        </table>
      )}
      {tab === 'gastos' && expenses && (
        <>
          <table>
            <thead><tr><th>Resultado</th><th className="r">Monto</th></tr></thead>
            <tbody>
              <tr><td>Venta neta</td><td className="r">{money(expenses.revenue)}</td></tr>
              <tr><td>Utilidad bruta</td><td className="r">{money(expenses.grossProfit)}</td></tr>
              <tr><td>Gastos fijos del periodo</td><td className="r">{money(expenses.fixedTotal)}</td></tr>
              <tr><td>Gastos variables</td><td className="r">{money(expenses.variableTotal)}</td></tr>
              <tr><td><strong>Utilidad después de gastos</strong></td><td className="r"><strong>{money(expenses.profitAfterExpenses)}</strong></td></tr>
              <tr><td>Punto de equilibrio</td><td className="r">{money(expenses.breakEven)}</td></tr>
            </tbody>
          </table>
          <table>
            <thead><tr><th>Gasto fijo</th><th>Categoría</th><th>Frecuencia</th><th className="r">Monto por pago</th><th className="r">En el periodo</th></tr></thead>
            <tbody>{expenses.fixed.filter((item) => item.name.trim()).map((item) => (
              <tr key={item.row}><td>{item.name}</td><td>{item.category}</td><td>{item.frequency}</td><td className="r">{money(item.amount)}</td><td className="r">{money(item.period)}</td></tr>
            ))}</tbody>
          </table>
          <table>
            <thead><tr><th>Gasto variable</th><th className="r">% de la venta</th><th className="r">En el periodo</th></tr></thead>
            <tbody>{expenses.variable.filter((item) => item.name.trim()).map((item) => (
              <tr key={item.row}><td>{item.name}</td><td className="r">{pct(item.rate)}</td><td className="r">{money(item.period)}</td></tr>
            ))}</tbody>
          </table>
        </>
      )}
      {tab === 'sinliga' && (
        <table>
          <thead><tr><th>Categoría</th><th>Insumo</th><th>Presentación</th><th className="r">Contenido</th><th className="r">Stock inicial</th></tr></thead>
          <tbody>{(() => {
            const linked = new Set();
            for (const recipe of model.recetas || []) linked.add(key(recipe.ingrediente));
            for (const insumo of costs.ins) {
              if (insumo.cat === 'Relleno' || (isNum(insumo.myo) && /^Topping/i.test(insumo.cat))) linked.add(key(insumo.name));
            }
            for (const item of model.params.crepeKit || []) linked.add(key(item.name));
            for (const name of [model.params.masa, model.params.nieve, model.params.crema, model.params.leche]) if (name) linked.add(key(name));
            for (const name of Object.values(model.params.lechas || {})) if (name) linked.add(key(name));
            return costs.ins.filter((insumo) => !linked.has(key(insumo.name))).map((insumo) => (
              <tr key={insumo.row}><td>{insumo.cat || 'Sin categoría'}</td><td>{insumo.name}</td><td>{insumo.pres}</td><td className="r">{isNum(insumo.cont) ? `${num(insumo.cont, 1)} ${insumo.unit}` : '—'}</td><td className="r">{isNum(insumo.stockIni) ? num(insumo.stockIni, 3) : '—'}</td></tr>
            ));
          })()}</tbody>
        </table>
      )}
      {['myo', 'ventas', 'params'].includes(tab) && (
        <table>
          <thead><tr><th>Información</th><th>Detalle</th></tr></thead>
          <tbody>
            {tab === 'myo' && <>
              <tr><td>Mejor caso MYO</td><td>{money(costs.myo.mejor)}</td></tr>
              <tr><td>Peor caso MYO</td><td>{money(costs.myo.peor)}</td></tr>
              <tr><td>Relleno total</td><td>{num(model.params.relleno, 1)} g</td></tr>
              <tr><td>Tope de toppings</td><td>{num(model.params.tope, 1)} g</td></tr>
            </>}
            {tab === 'params' && <>
              <tr><td>Relleno por crepa</td><td>{num(model.params.relleno, 1)} g</td></tr>
              <tr><td>Tope MYO</td><td>{num(model.params.tope, 1)} g</td></tr>
              <tr><td>IVA</td><td>{pct(model.params.iva)}</td></tr>
              <tr><td>Empaque por crepa</td><td>{money(model.params.empaque)}</td></tr>
            </>}
            {tab === 'ventas' && <tr><td>Reporte del periodo</td><td>Usa la pestaña Ventas del periodo en la pantalla web para ver el detalle completo.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
