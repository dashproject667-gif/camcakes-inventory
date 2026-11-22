import assert from 'node:assert/strict';
import { computeSales } from '../src/lib/sales.js';
import { inferMilkFromSalesVariant } from '../src/lib/export.js';

const product = {
  nombre: 'Chocolate Caliente Especial',
  tipo: 'Bebida',
  nieve: 'NO',
  crema: 'NO',
  lines: [{ ingrediente: 'Leche entera Kirkland', gramos: 250, costo: 10 }],
  total: 40,
};
const model = {
  params: {
    masa: 'Masa de crepa',
    nieve: 'Nieve',
    crema: 'Crema batida',
    leche: 'Leche entera Kirkland',
    lechas: { Deslactosada: 'Leche deslactosada Kirkland' },
    crepeKit: [],
  },
  productos: [],
  zettle: [],
};
const costs = {
  prodByKey: new Map([[product.nombre.toLowerCase(), product]]),
  insOf: () => ({ uso: 0 }),
  base: { masa: 0, nieve: 0, crema: 0 },
  lecheDelta: (_name, milk) => (milk === 'Deslactosada' ? 1.5 : 0),
};
const reportLine = {
  id: 1,
  nombre: 'Bebida Temporada',
  variante: 'Deslactosada',
  categoria: 'Chocolate de temporada',
  qty: 30,
  sinIva: 0,
  conIva: 0,
};

const sales = computeSales(model, costs, [reportLine], {
  ignored: new Set(),
  overrides: {},
  myoBase: true,
});
const row = sales.rows[0];
assert.equal(row.res.producto, product.nombre);
assert.equal(row.res.leche, 'Deslactosada');
assert.equal(row.costoUnit, 41.5);
assert.equal(sales.usage.get('leche entera kirkland').total, 0);
assert.equal(sales.usage.get('leche deslactosada kirkland').total, 7500);

const myoModel = {
  params: {
    ...model.params,
    relleno: 125,
    masa: 'Masa de crepa',
    crepeKit: [{ name: 'Charola', qty: 1 }],
  },
  productos: [{ tipo: 'MYO', nieve: 'SI', crema: 'SI' }],
  zettle: [{
    row: 6,
    producto: 'Crepa Make Your Own',
    opcion: 'Relleno: Nutella',
    tipo: 'Relleno MYO (125 g)',
    ref: 'Nutella',
  }],
};
const myoCosts = {
  prodByKey: new Map(),
  insOf: (name) => {
    if (name === 'Masa de crepa') return { uso: 235, costoG: 0.1 };
    if (name === 'Nieve') return { uso: 60, costoG: 0.02 };
    if (name === 'Crema batida') return { uso: 25, costoG: 0.04 };
    if (name === 'Nutella') return { costoG: 0.08, myo: 125, myoCosto: 10 };
    return null;
  },
  base: { masa: 23.5, nieve: 1.2, crema: 1 },
  lecheDelta: () => 0,
};
const myoLine = {
  ...reportLine,
  nombre: 'Crepa Make Your Own',
  variante: 'Nutella',
  categoria: '',
  qty: 2,
};
const myoSales = computeSales(myoModel, myoCosts, [myoLine], {
  ignored: new Set(),
  overrides: {},
  myoBase: true,
});
assert.equal(myoSales.usage.get('masa de crepa').total, 470);
assert.equal(myoSales.usage.get('charola').total, 2);
assert.equal(myoSales.usage.get('nutella').total, 250);
const myoSalesWithoutBase = computeSales(myoModel, myoCosts, [myoLine], {
  ignored: new Set(),
  overrides: {},
  myoBase: false,
});
assert.equal(myoSalesWithoutBase.usage.get('masa de crepa'), undefined);

const formula = 'IF(OR(AF7="",AF7="Entera"),0,AG7*(MATCH(AF7,Parametros!$A$18:$A$22,0)))';
const inferred = inferMilkFromSalesVariant('Ventas', 'Z7', formula);
assert.ok(inferred.includes('SEARCH("Deslactosada",C7)'));
assert.ok(inferred.includes('SEARCH("Avena",C7)'));
assert.ok(inferred.includes('AF7<>""'));
assert.equal(inferMilkFromSalesVariant('Ventas', 'Z7', inferred), inferred, 'formula transformation is idempotent');
assert.equal(inferMilkFromSalesVariant('Productos', 'Z7', formula), formula);

console.log('milk recognition and MYO inventory tests passed');
