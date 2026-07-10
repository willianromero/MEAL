import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useTenant } from '../context/TenantContext';
import { CAP, can } from '../lib/roles';
import { computeIndicatorValue, semaforo, progresoPct } from '../lib/indicatorEngine';
import { exportToCsv } from '../lib/exportCsv';
import { SYNC_TABLES } from '../syncEngine';
import { maskFeedback } from '../lib/pqrsPrivacy';
import { FileBarChart, Printer, Package, DatabaseBackup, Download, Info } from 'lucide-react';

// Módulo de reportes (DRT S1/RF-REP-1, S2/HU-08, RNF-12):
//  1. Informe técnico mensual → HTML imprimible (PDF vía diálogo del navegador).
//  2. Paquete de auditoría por unidad/período → JSON verificable con trazabilidad.
//  3. Exportación total del tenant → JSON/CSV en formatos abiertos (portabilidad).
const SEM_LABEL = { verde: 'VERDE', amarillo: 'AMARILLO', rojo: 'ROJO' };

export default function Reports({ currentUser }) {
  const { activeTenantId, activeTenant, capabilities } = useTenant();
  const canExport = can(capabilities, CAP.EXPORT);
  const canSeeIdentity = can(capabilities, CAP.VIEW_PQRS_IDENTITY);

  const byTenant = (store) => () =>
    activeTenantId ? store.where('tenant_id').equals(activeTenantId).toArray() : Promise.resolve([]);
  const indicators = useLiveQuery(byTenant(db.indicators), [activeTenantId]) || [];
  const records = useLiveQuery(byTenant(db.field_records), [activeTenantId]) || [];
  const evidences = useLiveQuery(byTenant(db.evidences), [activeTenantId]) || [];
  const feedbacks = useLiveQuery(byTenant(db.feedbacks), [activeTenantId]) || [];
  const units = useLiveQuery(byTenant(db.units), [activeTenantId]) || [];
  const lines = useLiveQuery(byTenant(db.program_lines), [activeTenantId]) || [];

  const [periodo, setPeriodo] = useState(() => new Date().toISOString().slice(0, 7));
  const [unidadId, setUnidadId] = useState('');
  const [msg, setMsg] = useState('');

  if (!canExport) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Info size={26} style={{ marginBottom: '0.5rem' }} /><p>Tu rol no genera reportes ni exportaciones.</p>
      </div>
    );
  }

  const lineName = (id) => lines.find(l => l.id === id)?.nombre || 'Estratégico / Transversal';
  const unitName = (id) => units.find(u => u.id === id)?.nombre || '—';

  const downloadJson = (filename, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 1. INFORME TÉCNICO MENSUAL (RF-REP-1): HTML limpio → imprimir/guardar como PDF
  const printTechnicalReport = () => {
    const calc = indicators.map(i => {
      const valor = i.formula ? computeIndicatorValue(i, records) : (i.actual || 0);
      return { ...i, valor, sem: semaforo(valor, i.target), pct: progresoPct(valor, i.target) };
    });
    const validados = records.filter(r => r.estado_validacion === 'validado').length;
    const rechazados = records.filter(r => r.estado_validacion === 'rechazado').length;
    const pqrsAbiertas = feedbacks.filter(f => f.estado && !['cerrada', 'retroalimentada'].includes(f.estado)).length;
    const rojo = calc.filter(i => i.sem === 'rojo').length;

    const rows = calc.map(i => `
      <tr>
        <td>${i.code}</td><td>${i.name}</td><td>${lineName(i.linea_id)}</td>
        <td style="text-align:right">${i.linea_base_valor ?? '—'}${i.linea_base_congelada ? ' 🔒' : ''}</td>
        <td style="text-align:right">${i.valor}</td><td style="text-align:right">${i.target ?? 'Ajustable'}</td>
        <td style="text-align:right">${i.pct}%</td>
        <td class="sem-${i.sem}">${SEM_LABEL[i.sem]}</td>
      </tr>`).join('');

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
      <title>Informe Técnico ${periodo} — ${activeTenant?.nombre || ''}</title>
      <style>
        body{font-family:Segoe UI,Arial,sans-serif;color:#111;margin:2rem;font-size:12px}
        h1{font-size:18px;margin:0 0 2px} h2{font-size:14px;margin:18px 0 6px}
        .meta{color:#555;font-size:11px;margin-bottom:14px}
        table{border-collapse:collapse;width:100%} th,td{border:1px solid #bbb;padding:4px 6px;text-align:left}
        th{background:#eef2f1} .kpis{display:flex;gap:18px;margin:10px 0}
        .kpi{border:1px solid #ccc;border-radius:6px;padding:8px 14px}
        .kpi b{display:block;font-size:16px}
        .sem-verde{color:#047857;font-weight:bold}.sem-amarillo{color:#b45309;font-weight:bold}.sem-rojo{color:#b91c1c;font-weight:bold}
        footer{margin-top:22px;font-size:10px;color:#666;border-top:1px solid #ccc;padding-top:6px}
        @media print{ .noprint{display:none} }
      </style></head><body>
      <h1>Informe Técnico Mensual — ${periodo}</h1>
      <div class="meta">
        Proyecto: <b>${activeTenant?.nombre || ''}</b> · Financiador: ${activeTenant?.financiador || '—'} ·
        Entidad ejecutora: ${activeTenant?.entidad_ejecutora || '—'} · Generado: ${new Date().toLocaleString()} por ${currentUser?.email || '—'}
      </div>
      <div class="kpis">
        <div class="kpi">Registros validados<b>${validados}</b></div>
        <div class="kpi">Registros rechazados<b>${rechazados}</b></div>
        <div class="kpi">Indicadores en rojo<b>${rojo} / ${calc.length}</b></div>
        <div class="kpi">PQRS abiertas<b>${pqrsAbiertas}</b></div>
      </div>
      <h2>Indicadores vs meta y línea base</h2>
      <table><thead><tr><th>Código</th><th>Indicador</th><th>Línea</th><th>L. base</th><th>Valor</th><th>Meta</th><th>Avance</th><th>Semáforo</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <footer>Plataforma MEAL — Fundación Guajira Competitiva. Informe generado desde registros validados; todo indicador es reconstruible desde los datos crudos (RNF-8). Los registros y evidencias portan firmas SHA-256 verificables.</footer>
      <button class="noprint" onclick="window.print()" style="margin-top:14px;padding:8px 16px">Imprimir / Guardar como PDF</button>
      </body></html>`;

    const w = window.open('', '_blank');
    if (!w) { setMsg('El navegador bloqueó la ventana del informe. Habilita ventanas emergentes.'); return; }
    w.document.write(html);
    w.document.close();
    setMsg(`Informe técnico de ${periodo} generado en una nueva pestaña (imprimir → guardar como PDF).`);
  };

  // 2. PAQUETE DE AUDITORÍA por unidad/período (S2, HU-08)
  const exportAuditPackage = async () => {
    const inPeriodo = (ts) => !periodo || (ts || '').startsWith(periodo);
    const recs = records.filter(r =>
      r.estado_validacion === 'validado' &&
      (!unidadId || r.unidad_id === unidadId) &&
      inPeriodo(r.capturado_at)
    );
    const recIds = new Set(recs.map(r => r.id));
    const evs = evidences.filter(e => recIds.has(e.registro_id)).map(({ blob, ...meta }) => meta);
    const audit = (await db.audit_log.where('tenant_id').equals(activeTenantId).toArray())
      .filter(a => a.entidad === 'field_records' && recIds.has(a.entidad_id));

    downloadJson(`paquete_auditoria_${activeTenantId}_${unidadId || 'todas'}_${periodo}.json`, {
      generado: new Date().toISOString(),
      generado_por: currentUser?.email || null,
      tenant: { id: activeTenantId, nombre: activeTenant?.nombre, financiador: activeTenant?.financiador },
      alcance: { unidad: unidadId ? unitName(unidadId) : 'Todas', periodo },
      resumen: { registros_validados: recs.length, evidencias: evs.length, eventos_bitacora: audit.length },
      registros_validados: recs,
      evidencias: evs, // metadatos + hash SHA-256; los binarios viven en el almacén segregado por tenant
      trazabilidad_bitacora: audit,
      indicadores: indicators.map(i => ({ id: i.id, code: i.code, name: i.name, formula: i.formula, target: i.target, linea_base_valor: i.linea_base_valor }))
    });
    setMsg(`Paquete de auditoría exportado: ${recs.length} registros validados + ${evs.length} evidencias + trazabilidad.`);
  };

  // 3. EXPORTACIÓN TOTAL en formatos abiertos (RNF-12, 14.3)
  const exportAllJson = async () => {
    const dump = { exportado: new Date().toISOString(), tenant: activeTenantId, tablas: {} };
    for (const { name, store } of SYNC_TABLES) {
      const rows = await store().toArray();
      let scoped = rows
        .filter(r => !('tenant_id' in r) || r.tenant_id === activeTenantId)
        .map(({ blob, ...rest }) => rest);
      if (name === 'feedbacks') scoped = scoped.map(f => maskFeedback(f, canSeeIdentity));
      dump.tablas[name] = scoped;
    }
    downloadJson(`export_total_${activeTenantId}.json`, dump);
    setMsg('Exportación total del proyecto descargada (JSON abierto).');
  };

  const exportTableCsv = async (name) => {
    const entry = SYNC_TABLES.find(t => t.name === name);
    let rows = (await entry.store().toArray())
      .filter(r => !('tenant_id' in r) || r.tenant_id === activeTenantId)
      .map(({ blob, ...rest }) => rest);
    if (name === 'feedbacks') rows = rows.map(f => maskFeedback(f, canSeeIdentity));
    exportToCsv(`${name}_${activeTenantId}`, rows);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileBarChart size={26} /> Reportes y Exportaciones</h1>
        <p>Informe técnico mensual, paquetes de auditoría verificables y exportación total en formatos abiertos.</p>
      </div>

      {msg && <div className="badge badge-info" style={{ display: 'block', padding: '0.6rem 1rem', fontSize: '0.78rem', whiteSpace: 'normal', width: 'fit-content' }}>{msg}</div>}

      <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', gap: '1rem', alignItems: 'end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Período (mes de corte)</label>
          <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ width: 'auto' }} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Unidad (para el paquete de auditoría)</label>
          <select value={unidadId} onChange={e => setUnidadId(e.target.value)} style={{ width: 'auto', minWidth: '220px' }}>
            <option value="">Todas las unidades</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Printer size={18} /> Informe técnico mensual</h3>
          <p style={{ fontSize: '0.8rem', margin: 0 }}>Indicadores vs meta y línea base con semáforo, calidad del dato y PQRS del período. Se abre listo para imprimir o guardar como PDF (RF-REP-1).</p>
          <button onClick={printTechnicalReport} className="btn btn-primary" style={{ marginTop: 'auto' }}><Printer size={14} /> Generar informe</button>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Package size={18} /> Paquete de auditoría</h3>
          <p style={{ fontSize: '0.8rem', margin: 0 }}>Registros validados + evidencias (hash SHA-256) + trazabilidad de bitácora por unidad/período, en JSON verificable (HU-08).</p>
          <button onClick={exportAuditPackage} className="btn btn-primary" style={{ marginTop: 'auto' }}><Download size={14} /> Exportar paquete</button>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><DatabaseBackup size={18} /> Exportación total (portabilidad)</h3>
          <p style={{ fontSize: '0.8rem', margin: 0 }}>Todo el proyecto en formatos abiertos JSON/CSV, sin lock-in (RNF-12, entrega al cierre 14.3).</p>
          <button onClick={exportAllJson} className="btn btn-primary"><Download size={14} /> Export total JSON</button>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {['field_records', 'indicators', 'feedbacks', 'units', 'evidences'].map(t => (
              <button key={t} onClick={() => exportTableCsv(t)} className="btn btn-secondary" style={{ padding: '0.28rem 0.55rem', fontSize: '0.68rem' }}>CSV {t}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
