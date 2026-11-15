// Convierte las hojas del Monitor_Operacion_CamCakes.xlsx en un modelo editable.
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v) => (v == null || typeof v === 'object' ? '' : String(v));

export const INS_FIRST = 6, INS_LAST = 90;
export const REC_FIRST = 6, REC_LAST = 405;
export const PROD_FIRST = 6, PROD_LAST = 65;

export function parseMonitor(sheets) {
  const need = ['Parametros', 'Insumos', 'Recetas', 'Productos'];
  const missing = need.filter((n) => !sheets[n]);
  if (missing.length) throw new Error(`Este archivo no parece ser el Monitor_Operacion_CamCakes: faltan las hojas ${missing.join(', ')}.`);
  const P = sheets.Parametros, I = sheets.Insumos, R = sheets.Recetas, Pr = sheets.Productos, Z = sheets.Zettle;

  const params = {
    relleno: num(P.get('B5')) ?? 125,
    tope: num(P.get('B6')) ?? 200,
    iva: num(P.get('B7')) ?? 0.16,
    empaque: num(P.get('B8')) ?? 0,
    masa: str(P.get('B9')) || 'Masa de crepa',
    nieve: str(P.get('B10')) || 'Nieve',
    crema: str(P.get('B11')) || 'Crema batida',
    leche: str(P.get('B15')) || 'Leche entera Kirkland',
    lechas: {},
  };
  for (let r = 18; r <= 22; r++) { const k = str(P.get('A' + r)); if (k) params.lechas[k] = str(P.get('B' + r)); }

  const insumos = [];
  for (let r = INS_FIRST; r <= INS_LAST; r++) {
    const name = str(I.get('B' + r)).trim();
    if (!name) continue;
    insumos.push({
      row: r, cat: str(I.get('A' + r)), name, unit: str(I.get('C' + r)) || 'g', pres: str(I.get('D' + r)),
      cont: num(I.get('E' + r)), precio: num(I.get('F' + r)), estado: str(I.get('G' + r)), pesoPza: num(I.get('H' + r)),
      usoMin: num(I.get('K' + r)), usoMax: num(I.get('L' + r)),
      stockIni: num(I.get('O' + r)), compras: num(I.get('P' + r)), stockMin: num(I.get('S' + r)),
      notas: str(I.get('V' + r)), myoMin: num(I.get('W' + r)), myoMax: num(I.get('X' + r)),
      cached: { costoG: num(I.get('J' + r)), consumo: num(I.get('Q' + r)), teorico: num(I.get('R' + r)), costoPorcion: num(I.get('N' + r)) },
    });
  }
  const recetas = [];
  for (let r = REC_FIRST; r <= REC_LAST; r++) {
    const ing = str(R.get('B' + r)).trim();
    if (!ing) continue;
    recetas.push({ row: r, producto: str(R.get('A' + r)).trim(), ingrediente: ing, tipo: str(R.get('C' + r)), manual: num(R.get('D' + r)), notas: str(R.get('I' + r)),
      cached: { gramos: num(R.get('E' + r)), costo: num(R.get('G' + r)) } });
  }
  const productos = [];
  for (let r = PROD_FIRST; r <= PROD_LAST; r++) {
    const nombre = str(Pr.get('B' + r)).trim();
    if (!nombre) continue;
    productos.push({ row: r, cat: str(Pr.get('A' + r)), nombre, tipo: str(Pr.get('C' + r)), kw1: str(Pr.get('D' + r)), kw2: str(Pr.get('E' + r)),
      precio: num(Pr.get('F' + r)), nieve: str(Pr.get('G' + r)) || 'NO', crema: str(Pr.get('H' + r)) || 'NO', cached: { total: num(Pr.get('M' + r)) } });
  }
  const zettle = [];
  if (Z) for (let r = 6; r <= 400; r++) {
    const prod = str(Z.get('B' + r)).trim();
    if (!prod) continue;
    zettle.push({ row: r, fila: num(Z.get('A' + r)), producto: prod, opcion: str(Z.get('C' + r)).trim(), precio: num(Z.get('D' + r)),
      tipo: str(Z.get('E' + r)), ref: str(Z.get('F' + r)).trim(), omitido: str(Z.get('G' + r)).trim(), leche: str(Z.get('L' + r)).trim(), cached: { costo: num(Z.get('H' + r)) } });
  }
  return { params, insumos, recetas, productos, zettle };
}

/** Lee el reporte "Ventas por producto" exportado del POS (Zettle). */
export function parseDoc(sheets) {
  const sh = sheets['Ventas por producto'] || Object.values(sheets)[0];
  if (!sh) throw new Error('El archivo DOC no tiene hojas.');
  // localizar encabezado
  let hdrRow = null;
  for (let r = 1; r <= 30; r++) if (str(sh.get('A' + r)).trim() === 'Nombre' && str(sh.get('F' + r)).toLowerCase().startsWith('cantidad')) { hdrRow = r; break; }
  if (!hdrRow) throw new Error('No encontré el encabezado "Nombre / Variante / Cantidad vendida…" en el DOC. ¿Es el reporte "Ventas por producto" del POS?');
  const cols = {}; // por texto de encabezado
  for (const c of 'ABCDEFGHIJKLMNOPQRS'.split('')) { const h = str(sh.get(c + hdrRow)).toLowerCase(); if (h) cols[h] = c; }
  const col = (frag) => { const k = Object.keys(cols).find((h) => h.startsWith(frag)); return k ? cols[k] : null; };
  const cVend = col('cantidad vendida'), cDev = col('cantidad devuelta'), cTot = col('cantidad total'), cMonto = col('monto vendido'),
    cSin = col('total sin iva'), cCon = col('total con iva'), cCat = col('categor'), cVar = col('variante'), cCosto = col('monto total del costo');
  const lines = [];
  for (let r = hdrRow + 1; r <= 2000; r++) {
    const name = str(sh.get('A' + r));
    if (!name && !str(sh.get('F' + r))) { if (r > hdrRow + 3 && lines.length) break; continue; }
    if (name.trim().toLowerCase() === 'total') continue;
    const vend = num(sh.get(cVend + r)) ?? 0, dev = cDev ? num(sh.get(cDev + r)) ?? 0 : 0;
    const qty = (cTot && num(sh.get(cTot + r)) != null) ? num(sh.get(cTot + r)) : vend - dev;
    lines.push({
      id: r, nombre: name, variante: cVar ? str(sh.get(cVar + r)) : '', categoria: cCat ? str(sh.get(cCat + r)) : '',
      qty, vendidas: vend, devueltas: dev, monto: cMonto ? num(sh.get(cMonto + r)) ?? 0 : 0,
      sinIva: cSin ? num(sh.get(cSin + r)) ?? 0 : 0, conIva: cCon ? num(sh.get(cCon + r)) ?? 0 : 0, costoPOS: cCosto ? num(sh.get(cCosto + r)) : null,
    });
  }
  const meta = {
    empresa: str(sh.get('B3')), rfc: str(sh.get('B4')), periodo: str(sh.get('B5')),
  };
  return { meta, lines };
}
