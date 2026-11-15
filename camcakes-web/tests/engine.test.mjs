import fs from 'node:fs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { setXmlImpl, readXlsx } from '../src/lib/xlsx.js';
import { parseMonitor, parseDoc } from '../src/lib/monitor.js';
import { computeCosts, norm } from '../src/lib/engine.js';
import { computeSales, buildInventory, DEFAULT_IGNORED } from '../src/lib/sales.js';
setXmlImpl(DOMParser, XMLSerializer);
const base = '/mnt/user-data/attachments/f8278f82-73d4-5140-a69f-660e8379fa07/';
const mon = parseMonitor(await readXlsx(fs.readFileSync(base + 'b3efadb4-Monitor_Operacion_CamCakes.xlsx')));
const doc = parseDoc(await readXlsx(fs.readFileSync(base + '7da3c633-DOC-20261114-WA0005.xlsx')));
const costs = computeCosts(mon);
const close = (a, b, t = 0.005) => (a === null || b === null ? a === b : Math.abs(a - b) <= t);
let bad = 0, n = 0;
const chk = (label, a, b, t) => { n++; if (!close(a, b, t)) { bad++; console.log('DIF', label, 'web=', a, 'excel=', b); } };
for (const i of costs.ins) { chk('costoG ' + i.name, i.costoG, i.cached.costoG, 1e-6); chk('porcion ' + i.name, i.costoPorcion, i.cached.costoPorcion, 1e-6); }
for (const r of costs.rec) { chk(`receta ${r.producto}/${r.ingrediente} gramos`, r.gramos, r.cached.gramos, 1e-6); chk(`receta ${r.producto}/${r.ingrediente} costo`, r.costo, r.cached.costo, 1e-6); }
for (const p of costs.prods) if (p.tipo !== 'MYO') chk('prod ' + p.nombre, p.total, p.cached.total, 1e-6);
for (const z of costs.zett) chk(`zettle fila ${z.fila} ${z.producto} ${z.opcion}`, z.costoCalc, z.cached.costo, 0.005);
console.log(`MYO peor=${costs.myo.peor?.toFixed(2)} (excel 86.99)  mejor=${costs.myo.mejor?.toFixed(2)} (excel 19.03)`);
console.log(`comparaciones: ${n}, diferencias: ${bad}`);
console.log('DOC:', doc.meta, doc.lines.length, 'líneas');
const state = { ignored: new Set(DEFAULT_IGNORED.map(norm)), overrides: {}, myoBase: true };
const s = computeSales(mon, costs, doc.lines, state);
for (const r of s.rows) console.log(r.line.nombre.padEnd(24), (r.line.variante || '').padEnd(14), String(r.line.qty).padStart(4), r.res.status.padEnd(9), (r.res.via || r.res.why || '').padEnd(16), r.res.producto || r.res.insumo || '', r.costoUnit != null ? r.costoUnit.toFixed(2) : '', r.warn);
console.log(s.totals, 'costo', s.costoTotal.toFixed(2), 'sin costo', s.costoFaltante);
const inv = buildInventory(costs, s.usage);
for (const x of inv.filter((x) => x.consumo)) console.log(x.ins.name.padEnd(32), 'ini', x.ins.stockIni, 'cons', x.consumo.toFixed(1), 'teor', x.teorico?.toFixed(1));
