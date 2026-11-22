import React, { useContext, useMemo, useState } from 'react';
import { AppCtx } from './App.jsx';
import ProductDetail, { variantsOf, toneLabel } from './ProductDetail.jsx';
import { AppIcon, Badge, Drawer, Stat } from './ui.jsx';
import { money, money0, pct, costTone, isNum } from './lib/format.js';
import MenuImport from './MenuImport.jsx';

export const CAT_ORDER = ['Clásica', 'Especial', 'MYO', 'Café', 'No coffee', 'Premium', 'Malteada'];
export const CAT_TITLE = { Clásica: 'Crepas clásicas', Especial: 'Crepas especiales', MYO: 'Make Your Own', Café: 'Café', 'No coffee': 'No coffee', Premium: 'Latte premium', Malteada: 'Malteadas' };
const CAT_NOTE = { Clásica: 'Incluyen nieve y crema batida', Especial: 'Incluyen nieve y crema batida', Malteada: 'Todas al mismo precio' };

export default function Menu() {
  const { costs, model } = useContext(AppCtx);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [showCost, setShowCost] = useState(true);
  const [open, setOpen] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const goal = 0.35;

  const groups = useMemo(() => {
    const map = new Map();
    for (const p of costs.prods) { if (!map.has(p.cat)) map.set(p.cat, []); map.get(p.cat).push(p); }
    const order = [...CAT_ORDER.filter((c) => map.has(c)), ...[...map.keys()].filter((c) => !CAT_ORDER.includes(c))];
    return order.map((c) => ({ cat: c, items: map.get(c) }));
  }, [costs]);

  const filtered = groups.map((g) => ({ ...g, items: g.items.filter((p) => (cat === 'all' || p.cat === cat) && (!q || p.nombre.toLowerCase().includes(q.toLowerCase()) || p.lines.some((l) => l.ingrediente.toLowerCase().includes(q.toLowerCase())))) })).filter((g) => g.items.length);
  const withCost = costs.prods.filter((p) => isNum(p.pct));
  const avgPct = withCost.length ? withCost.reduce((s, p) => s + p.pct, 0) / withCost.length : null;
  const noRecipe = costs.prods.filter((p) => p.estado !== 'OK' && p.tipo !== 'MYO').length;
  const myoRellenos = costs.rellenos, myoToppings = costs.toppings;

  return (
    <section>
      <div className="section-head">
        <div><h1>Menú</h1><p className="muted">Lo que se vende, a qué precio y cómo se prepara.</p></div>
        <button className="btn" onClick={() => setShowImport(true)}><AppIcon name="file" /> Importar menú oficial</button>
        <div className="stats">
          <Stat label="Productos en menú" value={costs.prods.length} />
          <Stat label="Costo promedio" value={pct(avgPct)} sub="sobre precio neto" tone={costTone(avgPct, goal)} />
          <Stat label="Con datos incompletos" value={noRecipe} tone={noRecipe ? 'warn' : 'good'} />
        </div>
      </div>
      <div className="toolbar">
        <input type="search" placeholder="Buscar producto o ingrediente…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        <div className="chips">
          <button className={'chip-btn' + (cat === 'all' ? ' on' : '')} onClick={() => setCat('all')}>Todo</button>
          {groups.map((g) => <button key={g.cat} className={'chip-btn' + (cat === g.cat ? ' on' : '')} onClick={() => setCat(g.cat)}>{CAT_TITLE[g.cat] || g.cat}</button>)}
        </div>
        <label className="check"><input type="checkbox" checked={showCost} onChange={(e) => setShowCost(e.target.checked)} /> Mostrar costos</label>
      </div>
      {filtered.length === 0 && <p className="muted pad">No hay productos que coincidan.</p>}
      {filtered.map((g) => (
        <div key={g.cat} className="menu-group">
          <h2>{CAT_TITLE[g.cat] || g.cat}{CAT_NOTE[g.cat] ? <small> · {CAT_NOTE[g.cat]}</small> : null}</h2>
          <div className="cards">
            {g.items.map((p) => {
              const isMyo = p.tipo === 'MYO';
              const parts = p.lines.filter((l) => l.tipo !== 'Masa' && l.tipo !== 'Empaque').map((l) => l.ingrediente);
              const extras = variantsOf(model, costs, p).filter((v) => v.tipo === 'Receta + leche' && isNum(v.precio) && v.precio !== p.precio && v.opcion.startsWith('Leche'));
              const tone = costTone(p.pct, goal);
              return (
                <button key={p.row} className="card" onClick={() => setOpen(p)}>
                  <div className="card-top"><h3>{p.nombre}</h3><span className="price">{money0(p.precio)}</span></div>
                  <p className="ing">
                    {isMyo ? `Tú eliges: relleno (${model.params.relleno} g en total) y toppings (hasta ${model.params.tope} g).` : parts.length ? parts.join(' · ') : 'Sin receta capturada'}
                    {p.nieve === 'SI' && p.crema === 'SI' && !isMyo ? ' · Nieve y crema batida' : ''}
                  </p>
                  {extras.length > 0 && <p className="vars">{extras.map((v) => `${v.opcion.replace('Leche: ', '')} +${money0(v.precio - p.precio)}`).filter((x, i, a) => a.indexOf(x) === i).join(' · ')}</p>}
                  {showCost && (
                    <div className="card-foot">
                      {isMyo ? <span className="muted small">Costo {money0(costs.myo.mejor)}–{money0(costs.myo.peor)}</span>
                        : <><span className="small">Costo {money(p.total)}</span><Badge tone={tone} title={toneLabel(tone)}>{pct(p.pct)}</Badge></>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {g.cat === 'MYO' && (
            <div className="myo-lists">
              <div><h4>Rellenos</h4><p>{myoRellenos.map((r) => r.name.replace(/ \(.*\)$/, '')).join(' · ')}</p></div>
              <div><h4>Toppings</h4><p>{myoToppings.map((r) => r.name).join(' · ')}</p></div>
            </div>
          )}
        </div>
      ))}
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.nombre || ''}>{open ? <ProductDetail product={open} goal={goal} /> : null}</Drawer>
      {showImport && <MenuImport onClose={() => setShowImport(false)} />}
    </section>
  );
}
