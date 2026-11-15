import React, { useContext, useState } from 'react';
import { AppCtx } from './App.jsx';
import { buildMonitor } from './lib/export.js';
import { key } from './lib/engine.js';
import { today } from './lib/format.js';
import { AppIcon } from './ui.jsx';

export default function ExportDialog({ onClose, changes }) {
  const { bufferRef, original, model, inventory, counts, notify } = useContext(AppCtx);
  const nCounted = Object.values(counts).filter((c) => c && (c.cerrados != null || c.abierto != null)).length;
  const [close, setClose] = useState(false);
  const [clearVentas, setClearVentas] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const c = changes.counts || {};
  const go = async () => {
    setBusy(true); setErr('');
    try {
      const { bytes, closed } = await buildMonitor(bufferRef.current, original, model, { close, clearVentas, inventory, counts, keyOf: key });
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Monitor_Operacion_CamCakes_${today()}.xlsx`; a.click(); URL.revokeObjectURL(a.href);
      notify(close ? `Monitor generado. Nuevo stock inicial en ${closed} insumos.` : 'Monitor generado con tus ajustes.'); onClose();
    } catch (e) { setErr(e.message || String(e)); } finally { setBusy(false); }
  };
  return (
    <div className="drawer-wrap center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-label="Exportar Monitor">
        <header><h2>Exportar Monitor actualizado</h2><button className="icon-btn" onClick={onClose} aria-label="Cerrar"><AppIcon name="close" /></button></header>
        <p>Se regenera tu Monitor original conservando fórmulas, formatos y hojas; solo cambian las celdas de captura.</p>
        <ul className="changes">
          <li><strong>{c.insumos || 0}</strong> insumos modificados o agregados</li>
          <li><strong>{c.recetas || 0}</strong> líneas de receta modificadas</li>
          <li><strong>{c.productos || 0}</strong> productos con cambios (precio, nieve, crema)</li>
          <li><strong>{c.parametros || 0}</strong> parámetros</li>
        </ul>
        <label className="check block"><input type="checkbox" checked={close} onChange={(e) => setClose(e.target.checked)} />
          <span><strong>Cerrar periodo:</strong> usar el conteo físico (o el teórico si no contaste) como nuevo stock inicial y vaciar “Compras”. {nCounted ? `Tienes ${nCounted} insumos contados.` : 'Aún no capturas conteo físico.'}</span></label>
        <label className="check block"><input type="checkbox" checked={clearVentas} onChange={(e) => setClearVentas(e.target.checked)} />
          <span>Vaciar la hoja <strong>Ventas</strong> del Monitor (incluye las filas de ejemplo). Recomendado al cerrar periodo.</span></label>
        <p className="muted small">Excel recalcula todo al abrir el archivo. Las ventas del DOC no se escriben en el Monitor: se usan aquí para el teórico.</p>
        {err && <div className="fp-error" role="alert">{err}</div>}
        <div className="modal-actions"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={go} disabled={busy}>{busy ? 'Generando…' : <><AppIcon name="download" /> Descargar Monitor</>}</button></div>
      </div>
    </div>
  );
}
