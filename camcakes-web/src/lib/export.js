// Construye las escrituras que regeneran el Monitor_Operacion_CamCakes.xlsx.
import { patchXlsx } from './xlsx.js';
import { isNum } from './format.js';

const INS_COLS = { cat: 'A', name: 'B', unit: 'C', pres: 'D', cont: 'E', precio: 'F', estado: 'G', pesoPza: 'H', usoMin: 'K', usoMax: 'L', stockIni: 'O', compras: 'P', stockMin: 'S', notas: 'V', myoMin: 'W', myoMax: 'X' };
const REC_COLS = { producto: 'A', ingrediente: 'B', tipo: 'C', manual: 'D', notas: 'I' };
const PROD_COLS = { precio: 'F', nieve: 'G', crema: 'H' };
const PARAM_CELLS = { relleno: 'B5', tope: 'B6', iva: 'B7', empaque: 'B8' };
const val = (v) => (v === '' || v === undefined ? null : v);

function diffRows(origRows, curRows, cols, ops, sheet, extraClear = []) {
  const o = new Map(origRows.map((r) => [r.row, r])); const c = new Map(curRows.map((r) => [r.row, r]));
  let changes = 0;
  for (const [row, cur] of c) {
    const orig = o.get(row);
    for (const [f, col] of Object.entries(cols)) {
      if (!orig || val(orig[f]) !== val(cur[f])) { ops[sheet].push({ ref: col + row, value: val(cur[f]) }); }
    }
    if (!orig || Object.keys(cols).some((f) => val(orig[f]) !== val(cur[f]))) changes++;
  }
  for (const [row, orig] of o) if (!c.has(row)) { for (const col of [...Object.values(cols), ...extraClear]) ops[sheet].push({ ref: col + row, value: null }); changes++; }
  return changes;
}

export function summarizeChanges(original, model) {
  const ops = { Insumos: [], Recetas: [], Productos: [], Parametros: [] };
  const nIns = diffRows(original.insumos, model.insumos, INS_COLS, ops, 'Insumos');
  const nRec = diffRows(original.recetas, model.recetas, REC_COLS, ops, 'Recetas');
  const nProd = diffRows(original.productos, model.productos, PROD_COLS, ops, 'Productos');
  let nPar = 0;
  for (const [f, ref] of Object.entries(PARAM_CELLS)) if (original.params[f] !== model.params[f]) { ops.Parametros.push({ ref, value: model.params[f] }); nPar++; }
  return { ops, counts: { insumos: nIns, recetas: nRec, productos: nProd, parametros: nPar }, total: nIns + nRec + nProd + nPar };
}

/**
 * @param {ArrayBuffer} buffer  Monitor original
 * opts: { close: bool, clearVentas: bool, inventory: [...], counts: {key:{cerrados,abierto}} , keyOf }
 */
export async function buildMonitor(buffer, original, model, opts = {}) {
  const { ops } = summarizeChanges(original, model);
  const clearRanges = {};
  let closed = 0;
  if (opts.close) {
    const byRow = new Map();
    for (const x of opts.inventory) {
      const i = x.ins; const gPres = i.gPres; if (!isNum(gPres)) continue;
      const c = opts.counts[opts.keyOf(i.name)];
      const counted = c && (isNum(c.cerrados) || isNum(c.abierto)) ? (c.cerrados || 0) * gPres + (c.abierto || 0) : null;
      const baseG = counted !== null ? counted : x.teorico;
      if (!isNum(baseG)) continue;
      byRow.set(i.row, Math.round((Math.max(0, baseG) / gPres) * 1000) / 1000); closed++;
    }
    // quitar escrituras previas de O/P para esas filas y escribir el nuevo inicio
    ops.Insumos = ops.Insumos.filter((op) => !(byRow.has(+op.ref.slice(1)) && (op.ref[0] === 'O' || op.ref[0] === 'P')));
    for (const [row, v] of byRow) { ops.Insumos.push({ ref: 'O' + row, value: v }); ops.Insumos.push({ ref: 'P' + row, value: null }); }
  }
  if (opts.clearVentas) clearRanges.Ventas = [{ rows: [7, 506], cols: ['A', 'S'] }, { rows: [7, 506], cols: ['AE', 'AF'] }];
  const res = await patchXlsx(buffer, ops, { clearRanges });
  return { ...res, closed };
}
