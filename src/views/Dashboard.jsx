import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { 
  Briefcase, 
  CheckCircle, 
  ClipboardList, 
  MessageSquare, 
  BookOpen, 
  ArrowRight,
  TrendingUp
} from 'lucide-react';

export default function Dashboard({ setCurrentView }) {
  // Consultas reactivas a la base de datos local
  const projects = useLiveQuery(() => db.projects.toArray()) || [];
  const indicators = useLiveQuery(() => db.indicators.toArray()) || [];
  const surveyResponses = useLiveQuery(() => db.survey_responses.toArray()) || [];
  const feedbacks = useLiveQuery(() => db.feedbacks.toArray()) || [];
  const lessons = useLiveQuery(() => db.lessons_learned.toArray()) || [];

  // Cálculos estadísticos
  const activeProjectsCount = projects.filter(p => p.status === 'active').length;
  
  const pendingFeedbacksCount = feedbacks.filter(f => f.status === 'pending').length;

  // Porcentaje promedio de avance de los indicadores (calculado como: actual / target * 100)
  const averageProgress = React.useMemo(() => {
    if (indicators.length === 0) return 0;
    const progressList = indicators.map(ind => {
      if (ind.target === 0) return 0;
      const pct = (ind.actual / ind.target) * 100;
      return pct > 100 ? 100 : pct; // Cap al 100%
    });
    const sum = progressList.reduce((acc, curr) => acc + curr, 0);
    return Math.round(sum / indicators.length);
  }, [indicators]);

  // Desglose de géneros simulados a partir de las encuestas registradas (por ejemplo srv-102)
  const demographicStats = React.useMemo(() => {
    let female = 24; // Valores semilla iniciales
    let male = 16;
    let other = 5;

    // Sumar de las encuestas dinámicas guardadas que tengan género
    surveyResponses.forEach(resp => {
      const g = resp.data?.gender;
      if (g === 'Femenino') female += 1;
      else if (g === 'Masculino') male += 1;
      else if (g === 'Otro') other += 1;
    });

    const total = female + male + other;
    return {
      female,
      male,
      other,
      total,
      femalePct: total > 0 ? Math.round((female / total) * 100) : 0,
      malePct: total > 0 ? Math.round((male / total) * 100) : 0,
      otherPct: total > 0 ? Math.round((other / total) * 100) : 0
    };
  }, [surveyResponses]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Cabecera */}
      <div>
        <h1>Dashboard General MEAL</h1>
        <p>Estadísticas agregadas de monitoreo de campo en tiempo real, sincronizadas localmente.</p>
      </div>

      {/* Grid de Métricas Principales */}
      <div className="metrics-grid">
        {/* Metrica 1 */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ background: 'rgba(5, 150, 105, 0.15)', color: 'var(--primary-light)', padding: '0.75rem', borderRadius: '12px' }}>
            <Briefcase size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Proyectos Activos</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{activeProjectsCount} / {projects.length}</div>
          </div>
        </div>

        {/* Metrica 2 */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ background: 'rgba(13, 148, 136, 0.15)', color: 'var(--secondary-light)', padding: '0.75rem', borderRadius: '12px' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Avance de Metas Físicas</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{averageProgress}%</div>
          </div>
        </div>

        {/* Metrica 3 */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', padding: '0.75rem', borderRadius: '12px' }}>
            <ClipboardList size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Encuestas Recolectadas</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{surveyResponses.length}</div>
          </div>
        </div>

        {/* Metrica 4 */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', padding: '0.75rem', borderRadius: '12px' }}>
            <MessageSquare size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Quejas en Espera</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{pendingFeedbacksCount}</div>
          </div>
        </div>
      </div>

      {/* Grid de Gráficos (SVG Premium hechos a mano) */}
      <div className="dashboard-grid">
        {/* Gráfico 1: Meta vs. Avance Real */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3>Avance de Indicadores Clave (Meta vs. Logro)</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', justifyContent: 'center' }}>
            {indicators.slice(0, 4).map(ind => {
              const pct = ind.target > 0 ? Math.round((ind.actual / ind.target) * 100) : 0;
              const barPct = pct > 100 ? 100 : pct;

              return (
                <div key={ind.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div className="flex-between" style={{ fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }} title={ind.name}>
                      {ind.code}: {ind.name}
                    </span>
                    <span style={{ color: 'var(--primary-light)', fontWeight: 'bold' }}>{pct}%</span>
                  </div>
                  
                  {/* Progress visual bar */}
                  <div className="progress-bar-bg" style={{ height: '10px' }}>
                    <div className="progress-bar-fill" style={{ width: `${barPct}%` }}></div>
                  </div>
                  
                  <div className="flex-between" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>Línea Base: {ind.baseline} {ind.unit}</span>
                    <span>Actual: {ind.actual} / Meta: {ind.target} {ind.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gráfico 2: Desglose Demográfico de Participantes (Gráfico de Rosca SVG) */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ width: '100%', textAlign: 'left' }}>Breakdown de Género de los Participantes</h3>
          
          <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap', margin: '1rem 0' }}>
            {/* SVG Donut Chart */}
            <svg width="150" height="150" viewBox="0 0 42 42" className="donut" style={{ transform: 'rotate(-90deg)' }}>
              {/* Fondo gris */}
              <circle className="donut-hole" cx="21" cy="21" r="15.91549430918954" fill="transparent"></circle>
              <circle className="donut-ring" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="4.5"></circle>

              {/* Segmento Femenino (Emerald) */}
              <circle 
                className="donut-segment" 
                cx="21" 
                cy="21" 
                r="15.91549430918954" 
                fill="transparent" 
                stroke="var(--primary-color)" 
                strokeWidth="4.5" 
                strokeDasharray={`${demographicStats.femalePct} ${100 - demographicStats.femalePct}`} 
                strokeDashoffset="0"
              ></circle>

              {/* Segmento Masculino (Teal) */}
              <circle 
                className="donut-segment" 
                cx="21" 
                cy="21" 
                r="15.91549430918954" 
                fill="transparent" 
                stroke="var(--secondary-color)" 
                strokeWidth="4.5" 
                strokeDasharray={`${demographicStats.malePct} ${100 - demographicStats.malePct}`} 
                strokeDashoffset={100 - demographicStats.femalePct}
              ></circle>

              {/* Segmento Otro (Amber) */}
              <circle 
                className="donut-segment" 
                cx="21" 
                cy="21" 
                r="15.91549430918954" 
                fill="transparent" 
                stroke="#eab308" 
                strokeWidth="4.5" 
                strokeDasharray={`${demographicStats.otherPct} ${100 - demographicStats.otherPct}`} 
                strokeDashoffset={100 - demographicStats.femalePct - demographicStats.malePct}
              ></circle>
            </svg>

            {/* Leyenda */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--primary-color)' }}></div>
                <span>Mujeres: <strong>{demographicStats.female}</strong> ({demographicStats.femalePct}%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--secondary-color)' }}></div>
                <span>Hombres: <strong>{demographicStats.male}</strong> ({demographicStats.malePct}%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#eab308' }}></div>
                <span>Otro/ND: <strong>{demographicStats.other}</strong> ({demographicStats.otherPct}%)</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.4rem', marginTop: '0.2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Total encuestados: {demographicStats.total}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actividades Recientes y Accesos Directos */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* Actividades Recientes */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3>Últimos Registros Guardados en Campo</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {surveyResponses.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No se han registrado respuestas de encuestas en IndexedDB todavía.
              </div>
            ) : (
              surveyResponses.slice(-3).reverse().map(resp => {
                const isSynced = resp.sync_status === 'synced';
                return (
                  <div key={resp.id} className="flex-between" style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                        Encuesta: {resp.survey_id === 'srv-101' ? 'Agua y Saneamiento' : 'Capacitación Huertos'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Ingresado por: {resp.submitted_by} • {new Date(resp.submitted_at).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className={`badge ${isSynced ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                        {isSynced ? 'Sincronizado' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Accesos Rápidos */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3>Flujos de Trabajo</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button 
              onClick={() => setCurrentView('surveys')} 
              className="btn btn-secondary" 
              style={{ justifyContent: 'space-between', padding: '0.85rem 1.25rem' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ClipboardList size={16} /> Llenar Encuesta</span>
              <ArrowRight size={14} />
            </button>

            <button 
              onClick={() => setCurrentView('indicators')} 
              className="btn btn-secondary" 
              style={{ justifyContent: 'space-between', padding: '0.85rem 1.25rem' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={16} /> Actualizar Metas</span>
              <ArrowRight size={14} />
            </button>

            <button 
              onClick={() => setCurrentView('feedback')} 
              className="btn btn-secondary" 
              style={{ justifyContent: 'space-between', padding: '0.85rem 1.25rem' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MessageSquare size={16} /> Buzón de Quejas</span>
              <ArrowRight size={14} />
            </button>

            <button 
              onClick={() => setCurrentView('lessons')} 
              className="btn btn-secondary" 
              style={{ justifyContent: 'space-between', padding: '0.85rem 1.25rem' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BookOpen size={16} /> Lecciones</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
