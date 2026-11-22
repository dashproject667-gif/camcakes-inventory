// Asigna cada línea del reporte del POS a un producto del Monitor y calcula
// el consumo teórico de insumos y el costo de lo vendido.
import { key, norm } from './engine.js';

export const DEFAULT_IGNORED = ['Crepa', 'Latte Premium', 'Bebida de temporada', 'Chai o Matcha'];
export const IGNORE = '__IGNORAR__';
const LECHAS = new Set(['entera', 'deslactosada', 'avena', 'almendra', 'soya']);
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const optValue = (o) => { const i = o.indexOf(':'); return i >= 0 ? o.slice(i + 1) : o; };
export const lineKey = (l) => `${norm(l.nombre)}|${norm(l.variante)}`;
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function buildCatalogIndex(model) {
  const idx = new Map();
  for (const z of model.zettle) {
    const k = `${norm(z.producto)}|${norm(optValue(z.opcion))}`;
    if (!idx.has(k)) idx.set(k, z);
  }
  return idx;
}

/** Devuelve cómo se interpreta una línea del reporte. */
export function resolveLine(line, model, costs, state, catalog) {
  const nName = norm(line.nombre), nVar = norm(line.variante);
  if (state.ignored.has(nName)) return { status: 'ignored', why: 'Registro viejo (lista de ignorados)' };
  const ov = state.overrides[lineKey(line)];
  if (ov === IGNORE) return { status: 'ignored', why: 'Ignorado manualmente' };
  const lecheTipo = LECHAS.has(nVar) ? capitalize(nVar) : '';
  if (ov) {
    const p = costs.prodByKey.get(key(ov));
    if (!p) return { status: 'unmatched', why: `Producto "${ov}" ya no existe` };
    return { status: 'ok', via: 'manual', kind: 'prod', producto: p.nombre, tipo: lecheTipo ? 'Receta + leche' : 'Receta completa', omit: '', leche: lecheTipo };
  }
  // 1) catálogo del POS (hoja Zettle)
  const z = catalog.get(`${nName}|${nVar}`) || (nVar ? null : catalog.get(`${nName}|`));
  if (z) {
    if (z.tipo === 'Relleno MYO (125 g)') return { status: 'ok', via: 'catálogo', kind: 'relleno', insumo: z.ref, zrow: z.row, tipo: z.tipo };
    if (z.tipo === 'Topping MYO (porción)') return { status: 'ok', via: 'catálogo', kind: 'topping', insumo: z.ref, zrow: z.row, tipo: z.tipo };
    if (z.tipo === 'Masa + nieve + crema') return { status: 'ok', via: 'catálogo', kind: 'crepa-base', tipo: z.tipo };
    return { status: 'ok', via: 'catálogo', kind: 'prod', producto: z.ref, tipo: z.tipo, omit: z.omitido, leche: z.leche, zrow: z.row };
  }
  // 2) palabras clave (misma regla que la hoja Ventas del Monitor)
  const text = `${nName} ${nVar}`;
  if (!text.includes('make your own')) {
    for (const p of model.productos) {
      if (p.tipo === 'MYO') continue;
      const hit = text.includes(norm(p.nombre)) || (norm(p.kw1) && text.includes(norm(p.kw1)) && (!norm(p.kw2) || text.includes(norm(p.kw2))));
      if (hit) return { status: 'ok', via: 'palabras clave', kind: 'prod', producto: p.nombre, tipo: lecheTipo ? 'Receta + leche' : 'Receta completa', omit: '', leche: lecheTipo };
    }
  }
  // 3) categoría del POS
  if (norm(line.categoria) === 'chocolate de temporada') {
    const p = costs.prodByKey.get(key('Chocolate Caliente Especial'));
    if (p) return {
      status: 'ok',
      via: 'categoría',
      kind: 'prod',
      producto: p.nombre,
      tipo: lecheTipo ? 'Receta + leche' : 'Receta completa',
      omit: '',
      leche: lecheTipo,
    };
  }
  return { status: 'unmatched', why: 'No coincide con ningún producto del Monitor' };
}

export function computeSales(model, costs, docLines, state) {
  const { params } = model;
  const catalog = buildCatalogIndex(model);
  const usage = new Map(); // insumo(key) -> {total, by: Map(label -> g)}
  const add = (name, g, label) => {
    if (!isNum(g) || g === 0) return;
    const k = key(name); let u = usage.get(k); if (!u) { u = { total: 0, by: new Map() }; usage.set(k, u); }
    u.total += g; u.by.set(label, (u.by.get(label) || 0) + g);
  };
  const myoProd = model.productos.find((p) => p.tipo === 'MYO');
  const myoNieve = (myoProd?.nieve ?? 'SI') === 'SI', myoCrema = (myoProd?.crema ?? 'SI') === 'SI';
  const nieveUso = costs.insOf(params.nieve)?.uso ?? 0, cremaUso = costs.insOf(params.crema)?.uso ?? 0, masaUso = costs.insOf(params.masa)?.uso ?? 0;
  const addMyoBase = (q) => {
    add(params.masa, masaUso * q, 'Crepa Make Your Own');
    if (myoNieve) add(params.nieve, nieveUso * q, 'Crepa Make Your Own');
    if (myoCrema) add(params.crema, cremaUso * q, 'Crepa Make Your Own');
    for (const item of params.crepeKit || []) add(item.name, item.qty * q, 'Crepa Make Your Own');
  };

  const rows = []; let costoTotal = 0, costoFaltante = 0;
  const totals = { sinIva: 0, conIva: 0, qty: 0, qtyIgn: 0, sinIvaIgn: 0, qtyUnm: 0, sinIvaUnm: 0, sinReceta: 0 };
  for (const line of docLines) {
    const res = resolveLine(line, model, costs, state, catalog);
    const row = { line, res, costoUnit: null, costo: null, warn: '' };
    const q = line.qty;
    if (res.status === 'ignored') { totals.qtyIgn += q; totals.sinIvaIgn += line.sinIva; rows.push(row); continue; }
    if (res.status === 'unmatched') { totals.qtyUnm += q; totals.sinIvaUnm += line.sinIva; rows.push(row); continue; }
    totals.qty += q; totals.sinIva += line.sinIva; totals.conIva += line.conIva;
    if (res.kind === 'relleno') {
      const ins = costs.insOf(res.insumo);
      add(res.insumo, params.relleno * q, 'Crepa Make Your Own');
      if (state.myoBase !== false) addMyoBase(q);
      let cu = ins && isNum(ins.costoG) ? params.relleno * ins.costoG : null;
      row.costoUnit = cu;
    } else if (res.kind === 'crepa-base') {
      addMyoBase(q);
      row.costoUnit = costs.base.masa + (myoNieve ? costs.base.nieve : 0) + (myoCrema ? costs.base.crema : 0) + params.empaque;
    } else if (res.kind === 'topping') {
      const ins = costs.insOf(res.insumo);
      add(res.insumo, (ins?.myo ?? 0) * q, 'Topping MYO');
      row.costoUnit = ins?.myoCosto ?? null;
    } else {
      const p = costs.prodByKey.get(key(res.producto));
      if (!p || p.lines.length === 0) { row.warn = 'Sin receta: no descuenta insumos'; totals.sinReceta += q; rows.push(row); continue; }
      const omit = key(res.omit);
      for (const l of p.lines) {
        if (omit && key(l.ingrediente) === omit) continue;
        if (isNum(l.gramos)) add(l.ingrediente, l.gramos * q, p.nombre);
      }
      if (p.tipo !== 'Bebida') {
        for (const item of params.crepeKit || []) add(item.name, item.qty * q, p.nombre);
      }
      if (p.nieve === 'SI') add(params.nieve, nieveUso * q, p.nombre);
      if (p.crema === 'SI') add(params.crema, cremaUso * q, p.nombre);
      let cu = p.total;
      if (res.omit && isNum(cu)) cu -= p.lines.filter((l) => key(l.ingrediente) === omit).reduce((s, l) => s + (l.costo || 0), 0);
      if (res.leche && res.leche !== 'Entera') {
        const ml = p.lines.filter((l) => key(l.ingrediente) === key(params.leche)).reduce((s, l) => s + (l.gramos || 0), 0);
        add(params.leche, -ml * q, p.nombre);
        add(params.lechas[res.leche], ml * q, p.nombre);
        const d = costs.lecheDelta(p.nombre, res.leche);
        cu = isNum(cu) && d !== null ? cu + d : null;
      }
      row.costoUnit = cu;
    }
    if (isNum(row.costoUnit)) { row.costo = row.costoUnit * q; costoTotal += row.costo; } else costoFaltante += q;
    rows.push(row);
  }
  return { rows, usage, costoTotal, costoFaltante, totals };
}

/** Inventario teórico por insumo = (stock inicial + compras) − consumo por ventas. */
export function buildInventory(costs, usage) {
  return costs.ins.map((i) => {
    const u = usage.get(key(i.name));
    const consumo = u ? u.total : 0;
    const hasStock = isNum(i.stockIni) || isNum(i.compras);
    const gPres = i.gPres;
    const entradaG = isNum(gPres) ? ((i.stockIni || 0) + (i.compras || 0)) * gPres : null;
    const teorico = hasStock && isNum(entradaG) ? entradaG - consumo : null;
    const natural = (g) => (g == null ? null : i.unit === 'pza' && isNum(i.pesoPza) && i.pesoPza > 0 ? g / i.pesoPza : g);
    return {
      ins: i, consumo, by: u ? u.by : new Map(), entradaG, teorico, hasStock,
      unitLabel: i.unit === 'pza' ? 'pza' : i.unit, natural,
      presTeorica: isNum(teorico) && isNum(gPres) ? teorico / gPres : null,
      valor: isNum(teorico) && isNum(i.costoG) ? Math.max(0, teorico) * i.costoG : null,
    };
  });
}
