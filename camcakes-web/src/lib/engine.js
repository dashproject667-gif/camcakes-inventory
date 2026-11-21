// Motor de cálculo: replica la lógica del Monitor_Operacion_CamCakes.xlsx.
export const key = (s) => String(s ?? '').trim().toLowerCase();
/** Normaliza textos del POS: minúsculas, sin acentos ni signos. */
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`´"]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').trim();
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const avg = (a, b) => (isNum(a) && isNum(b) ? (a + b) / 2 : null);

export function computeCosts(model) {
  const { params, insumos, recetas, productos, zettle } = model;
  const insByKey = new Map();
  const ins = insumos.map((i) => {
    const gPres = i.unit === 'pza' ? (isNum(i.pesoPza) && isNum(i.cont) ? i.cont * i.pesoPza : null) : (isNum(i.cont) ? i.cont : 0);
    const costoG = isNum(i.precio) && isNum(gPres) && gPres > 0 ? i.precio / gPres : null;
    const uso = avg(i.usoMin, i.usoMax);
    const myo = avg(i.myoMin, i.myoMax);
    const d = {
      ...i, gPres: isNum(gPres) && gPres > 0 ? gPres : null, costoG, uso, costoPorcion: isNum(uso) && isNum(costoG) ? uso * costoG : null,
      myo, myoCosto: isNum(myo) && isNum(costoG) ? myo * costoG : null,
    };
    insByKey.set(key(i.name), d);
    return d;
  });
  const insOf = (name) => insByKey.get(key(name)) || null;
  const crepeKit = (params.crepeKit || []).map((item) => ({ ...item, ins: insOf(item.name) }));
  const crepeKitCost = crepeKit.reduce((sum, item) => {
    const costoG = item.ins?.costoG;
    return isNum(costoG) && isNum(item.qty) ? sum + item.qty * costoG : sum;
  }, 0);
  const effectiveParams = { ...params, empaque: crepeKit.length ? crepeKitCost : (isNum(params.empaque) ? params.empaque : 0) };
  params.empaque = effectiveParams.empaque;
  params.crepeKitCost = crepeKitCost;

  // Recetas
  const relCount = new Map();
  for (const r of recetas) if (r.tipo === 'Relleno') relCount.set(key(r.producto), (relCount.get(key(r.producto)) || 0) + 1);
  const rec = recetas.map((r) => {
    const insu = insOf(r.ingrediente);
    let gramos = null;
    if (isNum(r.manual)) gramos = r.manual;
    else if (r.tipo === 'Relleno') gramos = params.relleno / relCount.get(key(r.producto));
    else gramos = insu && isNum(insu.uso) ? insu.uso : null;
    const costoG = insu ? insu.costoG : null;
    const costo = isNum(gramos) && isNum(costoG) ? gramos * costoG : null;
    const estado = !insu ? 'No encontrado' : !isNum(gramos) ? 'Falta cantidad' : !isNum(costoG) ? 'Falta precio' : 'OK';
    return { ...r, gramos, costoG, costo, estado };
  });
  const recByProd = new Map();
  for (const r of rec) { const k = key(r.producto); if (!recByProd.has(k)) recByProd.set(k, []); recByProd.get(k).push(r); }

  const cNieve = insOf(params.nieve)?.costoPorcion ?? 0, cCrema = insOf(params.crema)?.costoPorcion ?? 0, cMasa = insOf(params.masa)?.costoPorcion ?? 0;
  const base = { nieve: cNieve, crema: cCrema, masa: cMasa };

  const prods = productos.map((p) => {
    const lines = recByProd.get(key(p.nombre)) || [];
    const ok = lines.length > 0 && lines.every((l) => l.estado === 'OK');
    const costoBase = ok ? lines.reduce((s, l) => s + l.costo, 0) : null;
    const cn = p.nieve === 'SI' ? cNieve : 0, cc = p.crema === 'SI' ? cCrema : 0, ce = p.tipo === 'Bebida' ? 0 : params.empaque;
    const total = isNum(costoBase) ? costoBase + cn + cc + ce : null;
    const neto = isNum(p.precio) ? p.precio / (1 + params.iva) : null;
    const utilidad = isNum(total) && isNum(neto) ? neto - total : null;
    const pct = isNum(total) && isNum(neto) && neto > 0 ? total / neto : null;
    const estado = lines.length === 0 ? 'Sin receta' : ok ? 'OK' : 'Falta precio o cantidad';
    return { ...p, lines, costoBase, costoNieve: cn, costoCrema: cc, empaque: ce, total, neto, utilidad, pct, estado };
  });
  const prodByKey = new Map(prods.map((p) => [key(p.nombre), p]));

  // Make Your Own
  const rellenos = ins.filter((i) => i.cat === 'Relleno');
  const toppings = ins.filter((i) => /^topping/i.test(i.cat) && isNum(i.myo));
  const myo = computeMyoScenarios({ params, base, rellenos, toppings });

  // Costo por variante del catálogo del POS (hoja Zettle)
  const lecheBase = insOf(params.leche);
  const lecheDelta = (producto, tipoLeche) => {
    if (!tipoLeche || tipoLeche === 'Entera') return 0;
    const alt = insOf(params.lechas[tipoLeche]);
    const lines = (recByProd.get(key(producto)) || []).filter((l) => key(l.ingrediente) === key(params.leche));
    const ml = lines.reduce((s, l) => s + (l.gramos || 0), 0);
    if (!alt || !lecheBase || !isNum(alt.costoG) || !isNum(lecheBase.costoG)) return null;
    return ml * (alt.costoG - lecheBase.costoG);
  };
  const zett = zettle.map((z) => {
    let costo = null;
    const p = prodByKey.get(key(z.ref));
    if (z.tipo === 'Receta completa') costo = p?.total ?? null;
    else if (z.tipo === 'Receta sin ingrediente') {
      const om = (recByProd.get(key(z.ref)) || []).filter((l) => key(l.ingrediente) === key(z.omitido)).reduce((s, l) => s + (l.costo || 0), 0);
      costo = isNum(p?.total) ? p.total - om : null;
    } else if (z.tipo === 'Receta + leche') { const dl = lecheDelta(z.ref, z.leche); costo = isNum(p?.total) && dl !== null ? p.total + dl : null; }
    else if (z.tipo === 'Relleno MYO (125 g)') { const r = insOf(z.ref); costo = r && isNum(r.costoG) ? params.relleno * r.costoG : null; }
    else if (z.tipo === 'Topping MYO (porción)') { costo = insOf(z.ref)?.myoCosto ?? null; }
    else if (z.tipo === 'Masa + nieve + crema') costo = cMasa + cNieve + cCrema + params.empaque;
    const neto = isNum(z.precio) && z.precio > 0 ? z.precio / (1 + params.iva) : null;
    return { ...z, costoCalc: costo, neto, utilidad: isNum(costo) && isNum(neto) ? neto - costo : null, pct: isNum(costo) && isNum(neto) ? costo / neto : null };
  });

  return { ins, insOf, rec, recByProd, prods, prodByKey, myo, zett, base, lecheDelta, rellenos, toppings };
}

export function computeMyoScenarios({ params, base, rellenos, toppings }) {
  const costR = rellenos.map((r) => r.costoG).filter(isNum);
  const sumD = toppings.reduce((s, t) => s + (t.myo || 0), 0);
  const sumDC = toppings.reduce((s, t) => s + (isNum(t.myoCosto) ? t.myoCosto : 0), 0);
  const factor = sumD > params.tope ? params.tope / sumD : 1;
  const todosToppings = factor * sumDC;
  const rMax = costR.length ? params.relleno * Math.max(...costR) : null;
  const rMin = costR.length ? params.relleno * Math.min(...costR) : null;
  const fijo = base.masa + base.nieve + base.crema + params.empaque;
  return {
    fijo, todosToppings, relleno: { max: rMax, min: rMin },
    peor: rMax != null ? fijo + rMax + todosToppings : null, mejor: rMin != null ? fijo + rMin : null,
  };
}

/** Selección manual para la calculadora MYO. */
export function myoSelection(model, costs, sel) {
  const { params } = model; const { rellenos, toppings, base } = costs;
  const R = rellenos.filter((r) => sel.rellenos.has(r.name)); const T = toppings.filter((t) => sel.toppings.has(t.name));
  const gr = R.length ? params.relleno / R.length : 0;
  const rawG = T.reduce((s, t) => s + t.myo, 0);
  const factor = rawG > params.tope ? params.tope / rawG : 1;
  const missing = [...R, ...T].filter((x) => !isNum(x.costoG)).length;
  const cR = R.reduce((s, r) => s + (isNum(r.costoG) ? gr * r.costoG : 0), 0);
  const cT = T.reduce((s, t) => s + (isNum(t.myoCosto) ? factor * t.myoCosto : 0), 0);
  const cNieve = sel.nieve ? base.nieve : 0, cCrema = sel.crema ? base.crema : 0;
  const total = base.masa + cR + cT + cNieve + cCrema + params.empaque;
  return { gramosRelleno: R.length ? params.relleno : 0, gramosToppings: rawG * factor, rawG, factor, cR, cT, cMasa: base.masa, cNieve, cCrema, empaque: params.empaque, total, missing, R, T };
}

/** Texto de alerta como en Insumos!T */
export function stockAlert(teoricoG, stockMin, hasStock) {
  if (!hasStock || !isNum(teoricoG)) return 'Sin stock capturado';
  if (teoricoG <= 0) return 'AGOTADO';
  if (isNum(stockMin) && teoricoG < stockMin) return 'BAJO';
  return 'OK';
}
