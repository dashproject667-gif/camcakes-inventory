import React, { useContext } from 'react';
import { AppCtx } from './App.jsx';
import { Badge } from './ui.jsx';
import { money, money4, num, pct, costTone, isNum } from './lib/format.js';
import { key } from './lib/engine.js';

export function toneLabel(t) { return { good: 'Margen sano', warn: 'Atención', bad: 'Costo alto', none: 'Sin datos' }[t]; }

export function variantsOf(model, costs, p) {
  return costs.zett.filter((z) => key(z.ref) === key(p.nombre) && z.opcion && z.tipo !== 'Relleno MYO (125 g)');
}

export default function ProductDetail({ product, goal }) {
  const { costs, model } = useContext(AppCtx);
  const p = costs.prodByKey.get(key(product.nombre)) || product;
  const isMyo = p.tipo === 'MYO';
  const tone = costTone(p.pct, goal);
  const variants = variantsOf(model, costs, p);
  const total = p.lines.reduce((s, l) => s + (isNum(l.costo) ? l.costo : 0), 0);
  const extras = [];
  if (p.costoNieve) extras.push(['Nieve (porción)', p.costoNieve]);
  if (p.costoCrema) extras.push(['Crema batida (porción)', p.costoCrema]);
  if (p.empaque) extras.push(['Empaque', p.empaque]);
  return (
    <div className="detail">
      <div className="kpis">
        <div><span>Precio de menú</span><strong>{money(p.precio)}</strong></div>
        <div><span>Precio neto (sin IVA)</span><strong>{money(p.neto)}</strong></div>
        <div><span>Costo de producción</span><strong>{isMyo ? `${money(costs.myo.mejor)} – ${money(costs.myo.peor)}` : money(p.total)}</strong></div>
        <div><span>Utilidad</span><strong>{isMyo ? '—' : money(p.utilidad)}</strong></div>
        <div><span>Costo / precio neto</span><strong><Badge tone={tone}>{isMyo ? '—' : pct(p.pct)}</Badge></strong></div>
      </div>
      {isMyo ? (
        <div className="note">Make Your Own cambia según lo que elija el cliente. El costo va del <strong>mejor caso</strong> (relleno más barato, sin toppings) al <strong>peor caso</strong> (relleno más caro y todos los toppings hasta el tope). Usa la calculadora en Costos → Make Your Own.</div>
      ) : (
        <>
          <h3>Receta</h3>
          {p.lines.length === 0 ? <p className="muted">Este producto no tiene receta en el Monitor.</p> : (
            <table className="tbl compact">
              <thead><tr><th>Ingrediente</th><th>Tipo</th><th className="r">Cantidad</th><th className="r">$ / unidad</th><th className="r">Costo</th><th /></tr></thead>
              <tbody>
                {p.lines.map((l) => (
                  <tr key={l.row} className={l.estado !== 'OK' ? 'bad-row' : ''}>
                    <td>{l.ingrediente}</td><td className="muted">{l.tipo}</td>
                    <td className="r">{isNum(l.gramos) ? num(l.gramos, 1) : '—'}</td>
                    <td className="r">{money4(l.costoG)}</td>
                    <td className="r">{isNum(l.costo) ? money(l.costo) : <Badge tone="warn">{l.estado}</Badge>}
                      {isNum(l.costo) && total > 0 ? <div className="bar"><i style={{ width: `${Math.min(100, (l.costo / total) * 100)}%` }} /></div> : null}
                    </td>
                    <td />
                  </tr>
                ))}
                {extras.map(([n, v]) => <tr key={n}><td>{n}</td><td className="muted">Adicional</td><td /><td /><td className="r">{money(v)}</td><td /></tr>)}
                <tr className="total"><td colSpan={4}>Costo total</td><td className="r">{money(p.total)}</td><td /></tr>
              </tbody>
            </table>
          )}
        </>
      )}
      {variants.length > 0 && (
        <>
          <h3>Variantes en el POS</h3>
          <table className="tbl compact">
            <thead><tr><th>Opción</th><th className="r">Precio</th><th className="r">Costo</th><th className="r">Utilidad</th><th className="r">Costo %</th></tr></thead>
            <tbody>{variants.map((v) => (
              <tr key={v.row}><td>{v.opcion}</td><td className="r">{money(v.precio)}</td><td className="r">{money(v.costoCalc)}</td><td className="r">{money(v.utilidad)}</td><td className="r">{pct(v.pct)}</td></tr>
            ))}</tbody>
          </table>
        </>
      )}
    </div>
  );
}
