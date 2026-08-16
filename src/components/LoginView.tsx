import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { DEMO_CREDENTIALS } from '../lib/seedService';
import { Store, Lock, Mail, ArrowRight, ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, loginWithGoogle, authError, clearAuthError, seedDemoData, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const displayError = authError || localError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setLocalError('Credenciales inválidas. Comprueba el email y la contraseña.');
      } else {
        setLocalError(`Error al iniciar sesión: ${err.message || 'Error desconocido'}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSubmit = async () => {
    setLocalError(null);
    clearAuthError();
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleQuickLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setLocalError(null);
    clearAuthError();
    setSubmitting(true);
    try {
      await login(demoEmail, demoPass);
    } catch (err: any) {
      // If demo account not found, auto seed then retry login
      try {
        await seedDemoData();
        await login(demoEmail, demoPass);
      } catch (retryErr: any) {
        setLocalError('Error al iniciar con cuenta Demo. Intenta reinicializar datos demo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    setLocalError(null);
    clearAuthError();
    try {
      await seedDemoData();
      alert('¡Base de datos demo inicializada correctamente! Ahora puedes probar cualquier usuario.');
    } catch (err: any) {
      setLocalError('Error al inicializar datos demo: ' + err.message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-lg">
            <Store className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold text-stone-900 tracking-tight">
          MiniMarket
        </h2>
        <p className="mt-1 text-center text-sm text-stone-600">
          Gestión inteligente para kioscos y minimarkets escolares
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl sm:px-10 border border-stone-200">
          
          <div className="space-y-5">
            {displayError && (
              <div className="rounded-xl bg-red-50 p-4 border border-red-200 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-red-800">{displayError}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-stone-700">
                  Correo Electrónico
                </label>
                <div className="mt-1 relative rounded-xl shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-stone-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@ejemplo.com"
                    className="block w-full pl-10 pr-3 py-2.5 border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-stone-700">
                  Contraseña
                </label>
                <div className="mt-1 relative rounded-xl shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-stone-400" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-3 py-2.5 border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || loading}
                id="login-submit-btn"
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Ingresando...' : 'Iniciar Sesión'}
                {!submitting && <ArrowRight className="ml-2 w-4 h-4" />}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-stone-400 font-semibold">o</span>
              </div>
            </div>

            {/* Google Authentication Button */}
            <button
              type="button"
              onClick={handleGoogleSubmit}
              disabled={submitting || loading}
              id="btn-login-google"
              className="w-full flex justify-center items-center py-3 px-4 border border-stone-300 rounded-xl shadow-2xs text-sm font-bold text-stone-700 bg-white hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5 mr-3 shrink-0" viewBox="0 0 24 24">
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

          {/* Quick Demo Selector Section */}
          <div className="mt-8 border-t border-stone-200 pt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Acceso Rápido Demo (1-Click)
              </span>
              <button
                type="button"
                onClick={handleSeedData}
                disabled={seeding}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 hover:bg-emerald-100 transition-colors"
                title="Generar cuentas de prueba en la base de datos"
                id="seed-demo-btn"
              >
                <RefreshCw className={`w-3 h-3 ${seeding ? 'animate-spin' : ''}`} />
                {seeding ? 'Cargando...' : 'Reiniciar Demo'}
              </button>
            </div>

            <p className="text-xs text-stone-500 mb-3">
              Selecciona un perfil para probar el aislamiento multi-tenant y los roles de Sprint 0:
            </p>

            <div className="space-y-2">
              {DEMO_CREDENTIALS.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  onClick={() => handleQuickLogin(demo.email, demo.password)}
                  disabled={submitting || loading}
                  className="w-full text-left p-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-emerald-50 hover:border-emerald-300 transition-colors flex items-center justify-between group"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-stone-900 group-hover:text-emerald-900">
                        {demo.displayName}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        demo.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' :
                        demo.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {demo.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5">{demo.businessName}</p>
                  </div>
                  <span className="text-xs text-emerald-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    Entrar →
                  </span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
