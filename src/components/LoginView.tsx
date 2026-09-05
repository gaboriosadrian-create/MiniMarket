import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { UwiLogo } from './UwiLogo';
import { Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, loginWithGoogle, authError, clearAuthError, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        setLocalError('El correo electrónico o la contraseña no son correctos.');
      } else {
        setLocalError('No pudimos iniciar sesión. Verificá tus credenciales e intentá nuevamente.');
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
      setLocalError('No pudimos iniciar sesión con Google. Intentá nuevamente.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: 'var(--mm-color-bg)' }}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-white border border-stone-200 shadow-xs flex items-center justify-center p-2 mb-2 uwi-glow">
            <UwiLogo variant="animated" theme="gradient" size="md" showText={false} />
          </div>
          <UwiLogo variant="animated" theme="gradient" size="lg" showText={true} />
        </div>
        <p className="mt-2 text-center text-xs sm:text-sm text-stone-600 font-semibold">
          La gestión simple para tu negocio.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-6 px-5 sm:px-8 border border-stone-200 rounded-2xl shadow-xs">
          
          <div className="space-y-4">
            {displayError && (
              <div className="rounded-xl bg-red-50 p-3 border border-red-200 flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="text-xs font-bold text-red-900">{displayError}</span>
              </div>
            )}

            <form className="space-y-3.5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Correo Electrónico
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-stone-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@ejemplo.com"
                    className="block w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#006AFF] focus:ring-2 focus:ring-[#006AFF]/20 text-xs font-medium"
                    style={{ height: 'var(--mm-input-height)' }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Contraseña
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-stone-400" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#006AFF] focus:ring-2 focus:ring-[#006AFF]/20 text-xs font-medium"
                    style={{ height: 'var(--mm-input-height)' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || loading}
                id="login-submit-btn"
                className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wide text-white bg-[#006AFF] hover:bg-[#0052CC] active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                style={{ height: 'var(--mm-btn-height)' }}
              >
                {submitting ? 'Ingresando...' : 'Iniciar Sesión'}
                {!submitting && <ArrowRight className="ml-1.5 w-4 h-4" />}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-white px-2 text-stone-400 font-bold">o</span>
              </div>
            </div>

            {/* Google Authentication Button */}
            <button
              type="button"
              onClick={handleGoogleSubmit}
              disabled={submitting || loading}
              id="btn-login-google"
              className="w-full flex justify-center items-center py-2 px-4 border border-stone-300 rounded-xl text-xs font-bold text-stone-800 bg-white hover:bg-stone-50 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
              style={{ height: 'var(--mm-btn-height)' }}
            >
              <svg className="w-4 h-4 mr-2.5 shrink-0" viewBox="0 0 24 24">
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

        </div>

        {/* Footer info */}
        <p className="mt-3 text-center text-[11px] text-stone-500 font-mono select-none">
          uwi 1.0 - grstudio ©2026
        </p>
      </div>
    </div>
  );
};
