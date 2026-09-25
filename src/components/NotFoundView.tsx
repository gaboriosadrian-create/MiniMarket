import React from 'react';
import { UwiLogo } from './UwiLogo';
import { ArrowLeft, Home, FileQuestion, AlertCircle } from 'lucide-react';

interface NotFoundViewProps {
  type?: 'page' | 'order';
  title?: string;
  message?: string;
  requestCode?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  type = 'page',
  title,
  message,
  requestCode,
  onAction,
  actionLabel
}) => {
  const isOrder = type === 'order';

  const defaultTitle = isOrder 
    ? 'Solicitud no encontrada' 
    : '404 - Página no encontrada';

  const defaultMessage = isOrder
    ? (requestCode 
        ? `No pudimos encontrar la solicitud N.º ${requestCode}. Es posible que haya sido eliminada o que el enlace sea incorrecto.` 
        : 'La solicitud de productos que estás buscando no existe o el enlace ha caducado. Por favor, verifica el enlace con el emisor.')
    : 'La página a la que intentas acceder no existe, ha sido movida o la dirección es incorrecta.';

  const handleGoHome = () => {
    if (onAction) {
      onAction();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4 selection:bg-blue-200">
      <div className="w-full max-w-md bg-white rounded-3xl border border-stone-200 shadow-sm p-6 sm:p-8 text-center space-y-6 animate-in fade-in zoom-in-95">
        
        {/* Brand / Logo Header */}
        <div className="flex items-center justify-center space-x-2">
          <UwiLogo variant="static" theme="gradient" size="xs" showText={false} className="w-7 h-7 bg-stone-100 rounded-lg p-1" />
          <span className="text-base font-black tracking-tight text-stone-900 lowercase">uwi</span>
        </div>

        {/* Icon Illustration */}
        <div className="relative mx-auto w-20 h-20">
          <div className="w-20 h-20 rounded-3xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0057FF] shadow-2xs">
            {isOrder ? (
              <FileQuestion className="w-10 h-10 text-[#0057FF]" />
            ) : (
              <AlertCircle className="w-10 h-10 text-[#0057FF]" />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-xs shadow-2xs border-2 border-white">
            404
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
            {title || defaultTitle}
          </h1>
          {requestCode && (
            <p className="inline-block px-3 py-1 bg-blue-50 border border-blue-200/80 rounded-xl text-xs font-mono font-bold text-blue-900">
              Código: {requestCode}
            </p>
          )}
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-sm mx-auto">
            {message || defaultMessage}
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2 space-y-2.5">
          <button
            type="button"
            onClick={handleGoHome}
            id="btn-not-found-home"
            className="w-full py-3 px-4 bg-[#0057FF] hover:bg-[#0047DB] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
          >
            {isOrder ? <ArrowLeft className="w-4 h-4" /> : <Home className="w-4 h-4" />}
            <span>{actionLabel || (isOrder ? 'Volver al Inicio' : 'Ir al Panel Principal')}</span>
          </button>
        </div>

        {/* Footer Note */}
        <div className="pt-2 border-t border-stone-100">
          <p className="text-[11px] text-stone-400 font-medium">
            uwi · La gestión simple para tu negocio
          </p>
        </div>

      </div>
    </div>
  );
};
