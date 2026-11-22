const isNum = (value) => typeof value === 'number' && Number.isFinite(value);

export function buildRecipeLookup(model, costs) {
  const rows = [];
  for (const product of costs.prods) {
    if (product.tipo === 'MYO') continue;

    for (const line of product.lines) {
      const ingredient = costs.insOf(line.ingrediente);
      rows.push({
        id: `${product.row}:recipe:${line.row}`,
        product: product.nombre,
        ingredient: line.ingrediente,
        type: line.tipo || 'Ingrediente',
        quantity: line.gramos,
        unit: ingredient?.unit || '',
        source: line.tipo === 'Relleno' && !isNum(line.manual)
          ? `Reparto de ${model.params.relleno} g`
          : isNum(line.manual) ? 'Cantidad manual' : 'Porción estándar',
      });
    }

    const additions = [
      product.nieve === 'SI' ? { name: model.params.nieve, type: 'Nieve' } : null,
      product.crema === 'SI' ? { name: model.params.crema, type: 'Crema batida' } : null,
    ].filter(Boolean);
    if (product.tipo !== 'Bebida') {
      for (const item of model.params.crepeKit || []) additions.push({ name: item.name, type: 'Empaque', quantity: item.qty });
    }
    for (const addition of additions) {
      const ingredient = costs.insOf(addition.name);
      rows.push({
        id: `${product.row}:extra:${addition.type}:${addition.name}`,
        product: product.nombre,
        ingredient: addition.name,
        type: addition.type,
        quantity: addition.quantity ?? ingredient?.uso ?? null,
        unit: ingredient?.unit || '',
        source: 'Adicional automático',
      });
    }
  }
  return rows;
}
