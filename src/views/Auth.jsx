import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { Shield, Key, AlertCircle, HelpCircle, Check, Users } from 'lucide-react';

export default function Auth({ currentUser, setCurrentUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [isError, setIsError] = useState(false);

  // Intentar login real o simulado
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
        // En supabase real, el rol se suele guardar en metadata o tabla profiles.
        // Simulamos o tomamos el rol desde metadata de usuario.
        const role = data.user.user_metadata?.role || 'officer';
        const userSession = {
          id: data.user.id,
          email: data.user.email,
          role: role
        };
        
        setCurrentUser(userSession);
        localStorage.setItem('meal_user_session', JSON.stringify(userSession));
        showMessage('Sesión iniciada con éxito', false);
      }
    } catch (err) {
      console.error(err);
      showMessage(err.message || 'Error al iniciar sesión', true);
    } finally {
      setIsLoading(false);
    }
  };

  // Simulación rápida de un clic
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
    showMessage(`Simulando sesión como ${role.toUpperCase()}`, false);
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
      <div>
        <h1>Portal de Acceso y Simulación</h1>
        <p>Inicia sesión con credenciales reales de Supabase o utiliza el panel de simulación rápida de roles para comprobar el control de accesos (RBAC).</p>
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
        /* Vista de Sesión Activa */
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
              <Users size={16} /> Permisos Disponibles para tu Rol
            </h3>
            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li>
                <strong>Rol actual:</strong> {currentUser.role === 'admin' ? 'Administrador (Acceso total)' : currentUser.role === 'officer' ? 'Oficial de Campo (Escritura de datos/respuestas)' : 'Visualizador (Solo Lectura)'}
              </li>
              {currentUser.role === 'admin' && (
                <>
                  <li><Check size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> Crear y editar proyectos y marcos lógicos.</li>
                  <li><Check size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> Configurar y diseñar plantillas de encuestas.</li>
                  <li><Check size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> Responder a quejas y cambiar el estado del buzón.</li>
                </>
              )}
              {currentUser.role === 'officer' && (
                <>
                  <li><Check size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> Capturar encuestas de beneficiarios offline/online.</li>
                  <li><Check size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> Actualizar el avance real de indicadores en el campo.</li>
                  <li><Check size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> Enviar reportes de lecciones aprendidas y quejas.</li>
                </>
              )}
              {currentUser.role === 'viewer' && (
                <>
                  <li><Check size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> Consultar gráficos de metas en el Dashboard.</li>
                  <li><Check size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> Revisar el avance general de metas físicas de proyectos.</li>
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
        /* Vista de Login */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Panel de Simulación Rápida */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={22} className="text-primary" style={{ color: 'var(--primary-light)' }} /> Simulación Rápida de Roles
            </h2>
            <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Haz clic en cualquiera de los siguientes perfiles simulados para ingresar al sistema al instante con restricciones de acceso preconfiguradas.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                onClick={() => handleQuickLogin('admin')}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between', borderLeft: '4px solid #ef4444' }}
              >
                <span>Administrador (Control Total)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>admin@meal.org</span>
              </button>
              
              <button 
                onClick={() => handleQuickLogin('officer')}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between', borderLeft: '4px solid #10b981' }}
              >
                <span>Oficial de Campo (Captura offline)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>campo@meal.org</span>
              </button>

              <button 
                onClick={() => handleQuickLogin('viewer')}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between', borderLeft: '4px solid #0ea5e9' }}
              >
                <span>Visualizador (Lectura de Reportes)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>externo@meal.org</span>
              </button>
            </div>
          </div>

          {/* Formulario Supabase Auth */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Key size={22} style={{ color: 'var(--secondary-light)' }} /> Supabase Autenticación Real
            </h2>
            <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              {isSupabaseConfigured 
                ? 'Conectado a la base de datos remota. Ingresa tus credenciales registradas.' 
                : 'Modo simulación activo. Si configuras un archivo .env, este panel conectará con tu backend real de Supabase.'}
            </p>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Correo Electrónico</label>
                <input 
                  type="email" 
                  placeholder="ejemplo@meal.org" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Contraseña</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={isLoading}
                style={{ marginTop: '0.5rem' }}
              >
                {isLoading ? 'Iniciando...' : 'Iniciar Sesión'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
