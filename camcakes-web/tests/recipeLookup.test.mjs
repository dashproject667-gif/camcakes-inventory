import assert from 'node:assert/strict';
import { buildRecipeLookup } from '../src/lib/recipeLookup.js';

const insumos = new Map([
  ['nutella', { unit: 'g', uso: 30 }],
  ['nieve', { unit: 'g', uso: 60 }],
  ['crema', { unit: 'g', uso: 25 }],
  ['charola', { unit: 'pza', uso: 1 }],
  ['leche', { unit: 'ml', uso: 250 }],
]);
const model = {
  params: {
    relleno: 125,
    nieve: 'Nieve',
    crema: 'Crema',
    crepeKit: [{ name: 'Charola', qty: 1 }],
  },
};
const costs = {
  prods: [
    {
      row: 6, nombre: 'Crepa Nutella', tipo: 'Crepa', nieve: 'SI', crema: 'SI',
      lines: [
        { row: 6, ingrediente: 'Nutella', tipo: 'Relleno', manual: null, gramos: 125 },
        { row: 7, ingrediente: 'Nutella', tipo: 'Topping', manual: 15, gramos: 15 },
      ],
    },
    {
      row: 7, nombre: 'Latte', tipo: 'Bebida', nieve: 'NO', crema: 'NO',
      lines: [{ row: 8, ingrediente: 'Leche', tipo: 'Ingrediente', manual: null, gramos: 250 }],
    },
    { row: 8, nombre: 'Make Your Own', tipo: 'MYO', nieve: 'SI', crema: 'SI', lines: [] },
  ],
  insOf: (name) => insumos.get(name.toLowerCase()) || null,
};

const rows = buildRecipeLookup(model, costs);
assert.equal(rows.length, 6);
assert.equal(rows[0].product, 'Crepa Nutella');
assert.equal(rows[0].quantity, 125);
assert.equal(rows[0].unit, 'g');
assert.equal(rows[0].source, 'Reparto de 125 g');
assert.equal(rows[1].source, 'Cantidad manual');
assert.deepEqual(rows.slice(2, 5).map((row) => row.type), ['Nieve', 'Crema batida', 'Empaque']);
assert.equal(rows[4].unit, 'pza');
assert.equal(rows[5].product, 'Latte');
assert.equal(rows.some((row) => row.product === 'Make Your Own'), false);
console.log('Recipe lookup associations and quantities: OK');
