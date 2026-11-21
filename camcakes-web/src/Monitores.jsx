import React, { useMemo, useState } from 'react';
import JSZip from 'jszip';
import { AppIcon } from './ui.jsx';
import { buildPeriodList } from './lib/periods.js';

const monthValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export default function Monitores() {
  const now = new Date();
  const current = monthValue(now);
  const [start, setStart] = useState(current);
  const [end, setEnd] = useState(current);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState('');

  const periods = useMemo(() => {
    try {
      setError('');
      return buildPeriodList(start, end);
    } catch (e) {
      setError(e.message || 'No se pudo generar la lista de periodos.');
      return [];
    }
  }, [start, end]);

  const downloadZip = async () => {
    if (!periods.length) return;
    setGenerating(true);
    setError('');
    try {
      const zip = new JSZip();
      periods.forEach((period) => zip.folder(period));
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `estructura_monitores_${start}_a_${end}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloaded(`${periods.length} carpeta(s) descargada(s): ${periods[0]} a ${periods[periods.length - 1]}.`);
    } catch (e) {
      setError(e.message || 'No se pudo generar el archivo ZIP.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section>
      <div className="section-head">
        <div>
          <h1>Monitores y trazabilidad</h1>
          <p className="muted">Organiza los archivos de cada periodo sin mezclar versiones.</p>
        </div>
      </div>

      <div className="note warn">
        <strong>Descarga esta estructura una sola vez.</strong> Guarda dentro de cada carpeta el Monitor, el reporte del POS y demás Excel correspondientes al mismo periodo. Recomendada encarecidamente: carga siempre el Monitor ubicado en el periodo actual antes de trabajar.
      </div>

      <div className="panel period-generator">
        <h3>Crear carpetas por periodo</h3>
        <p className="muted small">
          Cada carpeta representa un mes y usa el formato <strong>AAAA-MM</strong>, por ejemplo <strong>2026-02</strong>. Las carpetas se generan vacías.
        </p>
        <div className="print-opts">
          <label>
            <span>Desde</span>
            <input type="month" value={start} min="2000-01" max="2100-12" onChange={(e) => { setStart(e.target.value); setDownloaded(''); }} />
          </label>
          <label>
            <span>Hasta</span>
            <input type="month" value={end} min="2000-01" max="2100-12" onChange={(e) => { setEnd(e.target.value); setDownloaded(''); }} />
          </label>
        </div>
        {error && <div className="fp-error" role="alert">{error}</div>}
        {downloaded && <div className="success-note" role="status">{downloaded}</div>}
        <button className="btn primary" onClick={downloadZip} disabled={generating || !periods.length}>
          <AppIcon name="download" />
          {generating ? 'Generando ZIP…' : `Descargar ZIP con ${periods.length} carpeta(s)`}
        </button>
      </div>

      {periods.length > 0 && (
        <div className="panel">
          <h3>Vista previa de carpetas</h3>
          <p className="muted small">Se descargarán vacías dentro del archivo ZIP.</p>
          <div className="period-grid">
            {periods.map((period) => <div className="period-folder" key={period}><AppIcon name="folder" size={20} /><strong>{period}</strong></div>)}
          </div>
        </div>
      )}

      <div className="panel">
        <h3>Uso recomendado</h3>
        <ol className="usage-list">
          <li>Descarga y descomprime el ZIP una sola vez en la carpeta principal donde conservas los monitores.</li>
          <li>Dentro de cada periodo, guarda el Monitor exportado, el reporte del POS y el conteo físico correspondiente.</li>
          <li>Cada vez que continúes un periodo, abre el Monitor de esa carpeta y reemplázalo solo al descargar el actualizado.</li>
          <li>No guardes varios periodos en el mismo nombre o carpeta: mantén trazabilidad por fecha.</li>
        </ol>
      </div>
    </section>
  );
}
