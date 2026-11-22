import assert from 'node:assert/strict';
import { parseExpenses, computeExpenses, parsePeriodDays } from '../src/lib/expenses.js';
import { summarizeChanges } from '../src/lib/export.js';

const cells = new Map([
  ['B5', 30], ['B7', 'Manual'], ['B8', 10000], ['B9', 0.6],
  ['J5', 'Semanal'], ['K5', 52], ['J7', 'Mensual'], ['K7', 12],
  ['J15', 'Servicios'], ['A39', 'Luz'], ['B39', 'Servicios'], ['C39', 'Mensual'],
  ['D39', 1000], ['E39', 'SI'], ['A40', 'Gas'], ['B40', 'Servicios'],
  ['C40', 'Semanal'], ['D40', 260], ['E40', 'SI'],
  ['A73', 'Comisión'], ['B73', 0.03], ['C73', 'SI'], ['B30', 0.5],
]);
const sheet = { get: (ref) => cells.get(ref) ?? null };
const expenses = parseExpenses(sheet);
assert.equal(expenses.periodDays, 30);
assert.equal(expenses.fixed.length, 30);
assert.equal(expenses.variable.length, 10);
assert.equal(expenses.fixed[0].name, 'Luz');

const summary = computeExpenses(expenses, {
  prods: [{ tipo: 'Bebida', pct: 0.4 }, { tipo: 'MYO', pct: 0.9 }],
}, null, parsePeriodDays('20/11/2026 - 21/11/2026'));
const expectedFixed = (1000 + 260 * 52 / 12) * 12 / 365 * 30;
assert.ok(Math.abs(summary.fixedTotal - expectedFixed) < 1e-8);
assert.ok(Math.abs(summary.fixedPosTotal - expectedFixed / 30 * 2) < 1e-8);
assert.equal(summary.fixed[0].periodPos, 1000 * 12 / 365 * 2);
assert.equal(summary.variableTotal, 300);
assert.equal(summary.grossProfit, 6000);
assert.ok(Math.abs(summary.breakEven - expectedFixed / 0.57) < 1e-8);
assert.equal(summary.profitAfterExpenses, 6000 - expectedFixed - 300);
assert.equal(summary.scenarios[0].revenue, summary.breakEven * 0.5);
assert.equal(parsePeriodDays('2026-11-20 - 2026-11-21'), 2);
assert.equal(parsePeriodDays('20/11/2026'), 1);
assert.equal(parsePeriodDays('21/11/2026 - 20/11/2026'), null);
assert.equal(parsePeriodDays('Periodo no identificado'), null);

expenses.fixed[0].amount = 1200;
const changes = summarizeChanges(
  { insumos: [], recetas: [], productos: [], params: {}, expenses: parseExpenses(sheet) },
  { insumos: [], recetas: [], productos: [], params: {}, expenses },
);
assert.ok(changes.ops.Gastos.some((item) => item.ref === 'D39' && item.value === 1200));
assert.ok(changes.total > 0);

assert.equal(parseExpenses(null), null);
console.log('Expenses parsing, calculations, and export diff: OK');
