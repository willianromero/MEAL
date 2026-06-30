import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { Shield, Key, AlertCircle, Check, Users, Database, HelpCircle } from 'lucide-react';

export default function Auth({ currentUser, setCurrentUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [isError, setIsError] = useState(false);

  // Controlar si mostramos el panel de simulación de roles locales
  // Si Supabase está configurado, por defecto se oculta para no confundir al usuario
  const [showSimulator, setShowSimulator] = useState(!isSupabaseConfigured);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      showMessage('Por favor completa todos los campos', true);
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (data && data.user) {
        // Buscar si existe perfil en la base de datos real
        // Hacemos una consulta rápida a la tabla de perfiles en Supabase
        const { data: profile, error: profError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        let role = 'officer'; // Por defecto
        if (!profError && profile) {
          role = profile.role;
        } else {
          // Si no existe perfil en la tabla de base de datos remota, intentamos leer metadata
          role = data.user.user_metadata?.role || 'officer';
        }

        const userSession = {
          id: data.user.id,
          email: data.user.email,
          role: role
        };
        
        setCurrentUser(userSession);
        localStorage.setItem('meal_user_session', JSON.stringify(userSession));
        showMessage('Sesión iniciada correctamente en el servidor', false);
      }
    } catch (err) {
      console.error(err);
      showMessage(err.message || 'Error al iniciar sesión', true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (role) => {
    let mockEmail = '';
    switch (role) {
      case 'admin':
        mockEmail = 'admin@meal.org';
        break;
      case 'officer':
        mockEmail = 'campo@meal.org';
        break;
      case 'viewer':
        mockEmail = 'externo@meal.org';
        break;
      default:
        mockEmail = 'usuario@meal.org';
    }

    const mockSession = {
      id: `mock-id-${role}-${Math.random().toString(36).substr(2, 5)}`,
      email: mockEmail,
      role: role
    };

    setCurrentUser(mockSession);
    localStorage.setItem('meal_user_session', JSON.stringify(mockSession));
    showMessage(`Simulando sesión local como ${role.toUpperCase()}`, false);
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
    }
    setCurrentUser(null);
    localStorage.removeItem('meal_user_session');
    showMessage('Sesión cerrada correctamente', false);
    setIsLoading(false);
  };

  const showMessage = (text, err = false) => {
    setMessage(text);
    setIsError(err);
    setTimeout(() => setMessage(null), 4000);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Portal de Acceso</h1>
          <p>
            {isSupabaseConfigured 
              ? 'Conéctate de forma segura al servidor central de Supabase en producción.' 
              : 'Sección de inicio de sesión del sistema MEAL.'}
          </p>
        </div>

        {/* Badge de estado de conexión real en la nube */}
        <span 
          className={`badge ${isSupabaseConfigured ? 'badge-success' : 'badge-warning'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem' }}
        >
          <Database size={12} />
          {isSupabaseConfigured ? 'Conectado a la Nube' : 'Modo Demo Local'}
        </span>
      </div>

      {message && (
        <div 
          className="glass-panel" 
          style={{ 
            padding: '1rem', 
            borderRadius: '8px', 
            borderColor: isError ? '#ef4444' : '#10b981',
            background: isError ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
            color: isError ? '#fca5a5' : '#a7f3d0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.9rem'
          }}
        >
          <AlertCircle size={18} />
          {message}
        </div>
      )}

      {currentUser ? (
        /* VISTA SESIÓN ACTIVA */
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'rgba(5, 150, 105, 0.1)', color: 'var(--primary-light)', padding: '0.75rem', borderRadius: '50%' }}>
              <Shield size={32} />
            </div>
            <div>
              <h2>Sesión Activa</h2>
              <p style={{ fontSize: '0.9rem' }}>Conectado como <strong style={{ color: 'var(--text-primary)' }}>{currentUser.email}</strong></p>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={16} /> Permisos de tu Rol:
            </h3>
            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li><strong>Rol actual:</strong> {currentUser.role === 'admin' ? 'Administrador (Acceso total)' : currentUser.role === 'officer' ? 'Oficial de Campo (Escritura de datos/respuestas)' : 'Visualizador (Solo Lectura)'}</li>
              {currentUser.role === 'admin' && (
                <>
                  <li><Check size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> Configurar proyectos, marcos lógicos e indicadores.</li>
                  <li><Check size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> Crear y estructurar plantillas de encuestas dinámicas.</li>
                  <li><Check size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> Resolver incidentes y quejas en el Buzón de la comunidad.</li>
                </>
              )}
              {currentUser.role === 'officer' && (
                <>
                  <li><Check size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> Diligenciar encuestas offline en comunidades.</li>
                  <li><Check size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> Registrar el avance físico logrado de indicadores en campo.</li>
                  <li><Check size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> Reportar lecciones aprendidas y quejas.</li>
                </>
              )}
              {currentUser.role === 'viewer' && (
                <>
                  <li><Check size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> Ver el Dashboard general y métricas físicas en tiempo real.</li>
                  <li> Restricción: No se permiten modificaciones ni escrituras de datos.</li>
                </>
              )}
            </ul>
          </div>

          <button onClick={handleLogout} className="btn btn-danger" disabled={isLoading} style={{ width: '100%' }}>
            Cerrar Sesión
          </button>
        </div>
      ) : (
        /* VISTA LOGIN */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 1. Formulario Autenticación Real de Supabase */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Key size={22} style={{ color: 'var(--primary-light)' }} /> Acceso con Cuenta de Supabase
            </h2>
            <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              {isSupabaseConfigured 
                ? 'Ingresa el correo electrónico y la contraseña que registraste en la base de datos.' 
                : 'La base de datos remota no está configurada. La sesión real requiere configurar variables de entorno.'}
            </p>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Correo Electrónico</label>
                <input 
                  type="email" 
                  placeholder="useradmin@wayuu.org" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isSupabaseConfigured || isLoading}
                />
              </div>

              <div className="form-group">
                <label>Contraseña</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!isSupabaseConfigured || isLoading}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={!isSupabaseConfigured || isLoading}
                style={{ marginTop: '0.5rem' }}
              >
                {isLoading ? 'Conectando...' : 'Iniciar Sesión en el Servidor'}
              </button>
            </form>
          </div>

          {/* 2. Acordeón / Panel de Simulación (Oculto por defecto si Supabase está activo) */}
          <div className="glass-panel" style={{ padding: '1.5rem 2rem' }}>
            <div className="flex-between">
              <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Users size={18} style={{ color: 'var(--secondary-light)' }} />
                Simulación Rápida de Roles (Desarrollo)
              </h2>
              <button
                onClick={() => setShowSimulator(!showSimulator)}
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
              >
                {showSimulator ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>

            {showSimulator && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Permite simular sesiones locales instantáneas en IndexedDB para evaluar la UI y los bloqueos de menús sin conectarse a internet.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button 
                    onClick={() => handleQuickLogin('admin')}
                    className="btn btn-secondary"
                    style={{ justifyContent: 'space-between', borderLeft: '4px solid #ef4444', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
                  >
                    <span>Administrador local</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>admin@meal.org</span>
                  </button>
                  
                  <button 
                    onClick={() => handleQuickLogin('officer')}
                    className="btn btn-secondary"
                    style={{ justifyContent: 'space-between', borderLeft: '4px solid #10b981', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
                  >
                    <span>Oficial de campo local</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>campo@meal.org</span>
                  </button>

                  <button 
                    onClick={() => handleQuickLogin('viewer')}
                    className="btn btn-secondary"
                    style={{ justifyContent: 'space-between', borderLeft: '4px solid #0ea5e9', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
                  >
                    <span>Visualizador local</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>externo@meal.org</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
