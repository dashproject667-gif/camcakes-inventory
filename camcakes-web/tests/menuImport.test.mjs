import assert from 'node:assert/strict';
import { parseOfficialMenu, shouldApplyImportedPrice, suggestMenuMatches } from '../src/lib/menuImport.js';

function sheet(values) {
  return { get: (ref) => values[ref] ?? null };
}

const official = sheet({
  A1: 'Nombre',
  D1: 'Opción1 Nombre',
  E1: 'Opción1 Valor',
  K1: 'Precio',
  O1: 'Categoría',
  Q1: 'ID de producto',
  A2: 'Matcha',
  D2: 'Leche',
  E2: 'Deslactosada',
  K2: 85,
  O2: 'No Coffee',
  Q2: 'matcha-id',
  D3: 'Leche',
  E3: 'Entera',
  K3: 88,
  Q3: 'matcha-id',
  D4: 'Leche',
  E4: 'Avena',
  K4: 100,
  Q4: 'matcha-id',
});

const [matcha] = parseOfficialMenu({ Export: official });
assert.equal(matcha.nombre, 'Matcha');
assert.equal(matcha.categoriaModelo, 'No coffee');
assert.equal(matcha.variantes.length, 3);
assert.equal(matcha.precio, 88, 'uses the whole-milk price as the base');
assert.deepEqual(matcha.preciosVariantes, [85, 88, 100]);

const suggestions = suggestMenuMatches({
  nombre: 'Chocolate Caliente de Temporada',
  categoriaModelo: 'No coffee',
  precio: 140,
}, [
  { row: 31, nombre: 'Chocolate Caliente Especial', cat: 'No coffee', precio: 140 },
  { row: 32, nombre: 'Matcha', cat: 'No coffee', precio: 85 },
]);
assert.equal(suggestions[0].product.row, 31);
assert.deepEqual(suggestions[0].reasons, ['Nombre parecido', 'Mismo precio', 'Misma categoría']);

const seasonal = suggestMenuMatches({
  nombre: 'Bebida Temporada',
  categoriaModelo: 'Chocolate de temporada',
  precio: 140,
}, [{ row: 31, nombre: 'Chocolate Caliente Especial', cat: 'No coffee', precio: 140 }]);
assert.equal(seasonal[0].product.row, 31);
assert.deepEqual(seasonal[0].reasons, ['Mismo precio']);

const categoryOnly = suggestMenuMatches({
  nombre: 'Producto nuevo',
  categoriaModelo: 'Café',
  precio: 999,
}, [{ row: 17, nombre: 'Café Corto', cat: 'Café', precio: 75 }]);
assert.equal(categoryOnly.length, 1, 'a shared category can surface a manual suggestion by itself');
assert.equal(shouldApplyImportedPrice({ precio: 0 }, { tipo: 'MYO', precio: 200 }), false);
assert.equal(shouldApplyImportedPrice({ precio: 0 }, { tipo: 'Bebida', precio: 85 }), true);

console.log('menuImport tests passed');
