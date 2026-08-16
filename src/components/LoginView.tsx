import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { DEMO_CREDENTIALS } from '../lib/seedService';
import { Store, Lock, Mail, ArrowRight, ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { 
    login, 
    loginWithGoogle, 
    authError, 
    clearAuthError, 
    seedDemoData, 
    loading 
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const displayError = authError || localError;

  // Inicio de sesión con Email y Contraseña
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (clearAuthError) clearAuthError();
    setSubmitting(true);

    try {
      if (login) {
        await login(email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (
        err.code === 'auth/invalid-credential' || 
        err.code === 'auth/wrong-password' || 
        err.code === 'auth/user-not-found'
      ) {
        setLocalError('Credenciales inválidas. Comprueba el email y la contraseña.');
      } else {
        setLocalError(`Error al iniciar sesión: ${err.message || 'Error desconocido'}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Inicio de sesión con Google
  const handleGoogleSubmit = async () => {
    setLocalError(null);
    if (clearAuthError) clearAuthError();
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Error al iniciar con Google:', err);
      setLocalError('No se pudo iniciar el proceso de autenticación con Google.');
    }
  };

  // Cargar datos demo (opcional)
  const handleSeedData = async () => {
    if (!seedDemoData) return;
    setSeeding(true);
    setLocalError(null);
    try {
      await seedDemoData();
    } catch (err: any) {
      console.error(err);
      setLocalError('Error al sembrar datos de prueba.');
    } finally {
      setSeeding(false);
    }
  };

  // Autocompletar credenciales demo
  const fillDemoCredentials = () => {
    if (DEMO_CREDENTIALS) {
      setEmail(DEMO_CREDENTIALS.email || '');
      setPassword(DEMO_CREDENTIALS.password || '');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <Store className="w-7 h-7" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900">Iniciar Sesión</h2>
        <p className="mt-2 text-sm text-slate-600">Accede a tu panel de administración</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border border-slate-100">
          
          {/* Alerta de Error */}
          {displayError && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-md flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">{displayError}</div>
            </div>
          )}

          {/* Botón Google */}
          <div>
            <button
              type="button"
              onClick={handleGoogleSubmit}
              disabled={submitting || loading || seeding}
              className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-slate-700 hover:bg-slate-50 transition-colors font-medium text-sm shadow-sm disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continuar con Google</span>
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500">O ingresa con tu correo</span>
            </div>
          </div>

          {/* Formulario Email/Contraseña */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Correo Electrónico
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@dominio.com"
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Contraseña
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg shadow transition-colors text-sm disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <>
                  <span>Ingresar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Opciones Demo */}
          {DEMO_CREDENTIALS && (
            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col gap-3">
              <button
                type="button"
                onClick={fillDemoCredentials}
                className="flex items-center justify-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Usar credenciales de prueba</span>
              </button>

              {seedDemoData && (
                <button
                  type="button"
                  onClick={handleSeedData}
                  disabled={seeding}
                  className="flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
                  <span>Cargar datos iniciales de base de datos</span>
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
