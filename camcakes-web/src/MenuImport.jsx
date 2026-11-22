import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AppCtx } from './App.jsx';
import { readXlsx } from './lib/xlsx.js';
import { defaultProductType, parseOfficialMenu, shouldApplyImportedPrice, suggestMenuMatches } from './lib/menuImport.js';
import { norm } from './lib/engine.js';
import { AppIcon } from './ui.jsx';

const TYPES = ['Clásica', 'Especial', 'MYO', 'Bebida'];

export default function MenuImport({ onClose }) {
  const {
    model, actions, notify, officialMenu, setOfficialMenu, officialMenuName, setOfficialMenuName,
    officialMenuDecisions, setOfficialMenuDecisions, officialMenuCategories, setOfficialMenuCategories,
  } = useContext(AppCtx);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [selectedRows, setSelectedRows] = useState({});
  const [drafts, setDrafts] = useState({});
  const [newCategory, setNewCategory] = useState('');

  const recommendations = useMemo(() => new Map(officialMenu.map((item) => [
    item.id,
    suggestMenuMatches(item, model.productos),
  ])), [officialMenu, model.productos]);

  useEffect(() => {
    setSelectedRows((current) => Object.fromEntries(officialMenu.map((item) => {
      const suggestions = suggestMenuMatches(item, model.productos);
      return [item.id, String(officialMenuDecisions[item.id]?.productRow ?? current[item.id] ?? suggestions[0]?.product.row ?? '')];
    })));
    setDrafts((current) => Object.fromEntries(officialMenu.map((item) => [
      item.id,
      current[item.id] || {
        cat: item.categoria || item.categoriaModelo || 'Especial',
        tipo: defaultProductType(item.categoriaModelo, item.nombre),
        actualizarCategoria: false,
      },
    ])));
  }, [officialMenu, model.productos, officialMenuDecisions]);

  const readFile = async (file) => {
    setReading(true);
    setError('');
    try {
      const items = parseOfficialMenu(await readXlsx(await file.arrayBuffer()));
      setOfficialMenu(items);
      setOfficialMenuName(file.name);
      setOfficialMenuDecisions({});
    } catch (e) {
      setError(e.message || 'No pude leer el menú oficial.');
    } finally {
      setReading(false);
    }
  };

  const setDecision = (id, decision) => {
    setOfficialMenuDecisions((current) => ({ ...current, [id]: decision }));
  };

  const linkProduct = (item) => {
    const row = Number(selectedRows[item.id]);
    const target = model.productos.find((product) => product.row === row);
    const draft = drafts[item.id] || {};
    if (!target) {
      notify('Selecciona el producto del Monitor al que corresponde.');
      return;
    }
    const alreadyLinked = Object.entries(officialMenuDecisions).some(([id, decision]) => (
      id !== item.id && decision.status === 'linked' && decision.productRow === row
    ));
    if (alreadyLinked) {
      notify('Ese producto del Monitor ya está vinculado a otra fila del menú oficial.');
      return;
    }
    const applyPrice = shouldApplyImportedPrice(item, target);
    actions.setProducto(row, {
      ...(applyPrice ? { precio: item.precio } : {}),
      ...(draft.actualizarCategoria ? { cat: draft.cat } : {}),
    });
    setDecision(item.id, {
      status: 'linked',
      productRow: row,
      previousPrice: target.precio,
      priceApplied: applyPrice,
      previousCategory: target.cat,
      updatedCategory: draft.actualizarCategoria ? draft.cat : null,
    });
  };

  const addProduct = (item) => {
    const draft = drafts[item.id] || {};
    const isBeverage = draft.tipo === 'Bebida';
    const ok = actions.addProducto({
      cat: draft.cat || item.categoriaModelo || 'Especial',
      nombre: item.nombre,
      tipo: draft.tipo || 'Especial',
      kw1: '',
      kw2: '',
      precio: item.precio,
      nieve: isBeverage ? 'NO' : 'SI',
      crema: isBeverage ? 'NO' : 'SI',
    });
    if (!ok) {
      notify('No se pudo agregar: el producto ya existe o el Monitor no tiene filas libres.');
      return;
    }
    setDecision(item.id, { status: 'added', productName: item.nombre });
  };

  const reopenDecision = (item) => {
    const decision = officialMenuDecisions[item.id];
    if (decision?.status === 'linked') {
      const current = model.productos.find((product) => product.row === decision.productRow);
      if (current) {
        const revert = {};
        if (decision.priceApplied !== false && current.precio === item.precio) revert.precio = decision.previousPrice ?? null;
        if (decision.updatedCategory && current.cat === decision.updatedCategory) revert.cat = decision.previousCategory;
        if (Object.keys(revert).length) actions.setProducto(decision.productRow, revert);
      }
    } else if (decision?.status === 'added') {
      const added = model.productos.find((product) => product.nombre === decision.productName);
      if (added && !actions.removeProducto(added.row)) {
        notify('No se puede deshacer el alta porque el producto ya tiene receta o referencias del POS.');
        return;
      }
    }
    setDecision(item.id, {});
  };

  const completed = officialMenu.filter((item) => officialMenuDecisions[item.id]?.status).length;
  const detectedCategories = [...new Set(officialMenu.map((item) => item.categoria).filter(Boolean))];
  const categories = [...new Set([
    ...model.productos.map((product) => product.cat),
    ...officialMenu.map((item) => item.categoria),
    ...officialMenu.map((item) => item.categoriaModelo),
    ...officialMenuCategories,
  ])].filter(Boolean);
  const createCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    if (categories.some((category) => norm(category) === norm(name))) {
      notify(`La categoría "${name}" ya está disponible.`);
      return;
    }
    setOfficialMenuCategories((current) => [...current, name]);
    setNewCategory('');
    notify(`Categoría "${name}" creada. Asígnala a un producto para guardarla en el Monitor.`);
  };

  return (
    <div className="menu-import-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="menu-import-dialog" role="dialog" aria-modal="true" aria-labelledby="menu-import-title">
        <header className="menu-import-header">
          <div>
            <h2 id="menu-import-title">Actualizar menú desde Excel</h2>
            <p className="muted">Compara el menú oficial con el Monitor y aprueba cada cambio.</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><AppIcon name="close" /></button>
        </header>

        <div className="menu-import-body">
          <div className="menu-import-explainer">
            <p><strong>Vincular</strong> conserva el nombre y la receta del Monitor; actualiza el precio base. El cambio de categoría es opcional.</p>
            <p><strong>Agregar</strong> crea un producto nuevo sin receta. Después tendrás que capturar su receta y revisar su precio.</p>
            <p>Los precios de variantes se muestran como referencia; se importa el precio base (preferentemente la opción de leche entera).</p>
          </div>

          <label className="btn menu-import-file">
            <AppIcon name="file" /> {reading ? 'Leyendo archivo…' : officialMenu.length ? 'Cargar otro Excel oficial' : 'Seleccionar Excel oficial'}
            <input type="file" accept=".xlsx" hidden disabled={reading} onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) readFile(file);
              event.target.value = '';
            }} />
          </label>
          {officialMenuName && <span className="muted small">{officialMenuName}</span>}
          {error && <div className="fp-error" role="alert">{error}</div>}

          {officialMenu.length > 0 && (
            <>
              <div className="menu-import-category-tools">
                <div>
                  <strong>Categorías detectadas en el Excel ({detectedCategories.length})</strong>
                  <div className="menu-import-category-chips">
                    {detectedCategories.map((category) => <span className="chip" key={category}>{category}</span>)}
                  </div>
                </div>
                <div className="menu-import-create-category">
                  <label htmlFor="menu-new-category">Crear categoría de producto</label>
                  <input id="menu-new-category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') createCategory(); }} placeholder="Nombre de la nueva categoría" />
                  <button className="btn" onClick={createCategory}>Crear categoría</button>
                </div>
                <p className="muted small">Puedes elegir una categoría detectada o crear una propia. Se guarda en el Monitor al asignarla a un producto y exportar.</p>
              </div>
              <div className="menu-import-summary">
                <strong>{completed} de {officialMenu.length} revisados</strong>
                <span className="muted">Los productos pendientes no cambian el Monitor.</span>
              </div>
              <div className="menu-import-list">
                {officialMenu.map((item) => {
                  const decision = officialMenuDecisions[item.id];
                  const suggestions = recommendations.get(item.id) || [];
                  const selected = model.productos.find((product) => product.row === Number(selectedRows[item.id]));
                  const draft = drafts[item.id] || { cat: item.categoria || item.categoriaModelo, tipo: 'Especial', actualizarCategoria: false };
                  const variantInfo = item.preciosVariantes.length > 1
                    ? `Variantes: ${item.preciosVariantes.map((price) => `$${price}`).join(' · ')}`
                    : `${item.variantes.length} precio${item.variantes.length === 1 ? '' : 's'} en el archivo`;
                  return (
                    <article className="menu-import-item" key={item.id}>
                      <div className="menu-import-product">
                        <div>
                          <strong>{item.nombre}</strong>
                          <div className="muted small">{item.categoria || 'Sin categoría'} · ${item.precio} · {variantInfo}</div>
                        </div>
                        {decision?.status && <span className="badge good">{decision.status === 'linked' ? `Vinculado a ${model.productos.find((product) => product.row === decision.productRow)?.nombre || 'producto'}` : decision.status === 'added' ? 'Agregado' : 'Descartado'}</span>}
                      </div>

                      {!decision?.status && (
                        <>
                          {suggestions.length === 0 && <p className="muted small">No encontré una coincidencia probable; también puedes elegir manualmente cualquier producto del Monitor.</p>}
                          {item.precio === 0 && norm(item.nombre).includes('make your own') && (
                            <p className="warn-text">El precio $0 del catálogo es para agregar opciones; al vincular se conserva el precio de menú del Monitor.</p>
                          )}
                          <div className="menu-import-match">
                            <label>
                              Vincular con producto del Monitor
                              <select value={selectedRows[item.id] || ''} onChange={(event) => setSelectedRows((current) => ({ ...current, [item.id]: event.target.value }))}>
                                <option value="">Elige producto del Monitor</option>
                                {suggestions.length > 0 && <optgroup label="Coincidencias sugeridas">
                                  {suggestions.map(({ product, reasons }) => (
                                    <option key={product.row} value={product.row}>{product.nombre} · {reasons.join(', ')}</option>
                                  ))}
                                </optgroup>}
                                <optgroup label="Todos los productos">
                                  {model.productos.filter((product) => !suggestions.some((suggestion) => suggestion.product.row === product.row))
                                    .map((product) => <option key={product.row} value={product.row}>{product.nombre}</option>)}
                                </optgroup>
                              </select>
                            </label>
                            {selected && <div className="menu-import-match-details">
                              <p className="muted small">
                                {selected.tipo === 'MYO' && item.precio === 0
                                  ? `Precio oficial $0 (opción cobrada manualmente); se conserva el precio del Monitor: $${selected.precio ?? 'sin precio'}.`
                                  : `Precio actual: $${selected.precio ?? 'sin precio'} → precio oficial: $${item.precio}`}
                              </p>
                              <label className="check"><input type="checkbox" checked={!!draft.actualizarCategoria} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, actualizarCategoria: event.target.checked } }))} /> Actualizar también su categoría</label>
                              {draft.actualizarCategoria && (
                                <label>
                                  Nueva categoría
                                  <select value={draft.cat || ''} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, cat: event.target.value } }))}>
                                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                                  </select>
                                </label>
                              )}
                            </div>}
                          </div>

                          <div className="menu-import-actions">
                            <button className="btn primary" disabled={!selected} onClick={() => linkProduct(item)}>
                              {selected?.tipo === 'MYO' && item.precio === 0 ? 'Vincular y conservar precio MYO' : 'Vincular y actualizar precio'}
                            </button>
                            <div className="menu-import-add-fields">
                              <label>Categoría
                                <select value={draft.cat || ''} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, cat: event.target.value } }))}>
                                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                                  {!categories.includes(draft.cat) && draft.cat && <option value={draft.cat}>{draft.cat}</option>}
                                </select>
                              </label>
                              <label>Tipo
                                <select value={draft.tipo} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, tipo: event.target.value } }))}>
                                  {TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                                </select>
                              </label>
                              <button className="btn" onClick={() => addProduct(item)}>Agregar como nuevo</button>
                            </div>
                            <button className="btn subtle" onClick={() => setDecision(item.id, { status: 'discarded' })}>Descartar</button>
                          </div>
                        </>
                      )}
                      {decision?.status && <button className="btn subtle menu-import-undo" onClick={() => reopenDecision(item)}>Deshacer y revisar de nuevo</button>}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <footer className="menu-import-footer">
          <span className="muted small">Las decisiones aprobadas se incluyen al exportar el Monitor.</span>
          <button className="btn" onClick={onClose}>Cerrar</button>
        </footer>
      </section>
    </div>
  );
}
