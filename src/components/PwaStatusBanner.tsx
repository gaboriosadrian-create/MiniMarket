import React, { useState } from 'react';
import { WifiOff, RefreshCw, Download, X, Store, Smartphone } from 'lucide-react';
import { usePwa } from '../lib/usePwa';

export const PwaStatusBanner: React.FC = () => {
  const { isOnline, isInstallable, hasUpdate, promptInstall, applyUpdate } = usePwa();
  const [installDismissed, setInstallDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = () => {
    setIsUpdating(true);
    applyUpdate();
  };

  return (
    <aside aria-label="Notificaciones de estado de la aplicación" className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      
      {/* 1. Offline Indicator */}
      {!isOnline && (
        <div 
          role="status"
          aria-live="polite"
          className="pointer-events-auto bg-stone-900/95 text-white border border-stone-700 shadow-xl rounded-2xl p-3 flex items-center justify-between gap-3 text-xs font-semibold backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <WifiOff className="w-3.5 h-3.5" />
            </span>
            <div>
              <p className="font-bold text-white leading-tight">Sin conexión</p>
              <p className="text-[11px] text-stone-300">MiniMarket está funcionando en modo local</p>
            </div>
          </div>
        </div>
      )}

      {/* 2. New Version Update Banner */}
      {hasUpdate && (
        <div 
          role="alert"
          className="pointer-events-auto bg-stone-900/95 text-white border border-emerald-500/40 shadow-2xl rounded-2xl p-3.5 space-y-2.5 backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Store className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-xs sm:text-sm text-white leading-tight">
                Nueva versión disponible
              </p>
              <p className="text-[11px] text-stone-300 mt-0.5">
                Hay una actualización de MiniMarket lista para usar.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleUpdate}
            disabled={isUpdating}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'Actualizando...' : 'Actualizar'}</span>
          </button>
        </div>
      )}

      {/* 3. Install App Prompt (When installable and not dismissed) */}
      {isInstallable && !installDismissed && (
        <div 
          role="region"
          aria-label="Instalación de MiniMarket"
          className="pointer-events-auto bg-white text-stone-900 border border-emerald-200 shadow-2xl rounded-2xl p-3.5 space-y-2.5 animate-in slide-in-from-bottom-3 duration-200"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <p className="font-black text-xs sm:text-sm text-stone-900 leading-tight">
                  Instalar MiniMarket
                </p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Abrir como aplicación rápida e independiente
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInstallDismissed(true)}
              aria-label="Cerrar aviso de instalación"
              className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setInstallDismissed(true)}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Ahora no
            </button>
            <button
              type="button"
              onClick={promptInstall}
              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-98"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar</span>
            </button>
          </div>
        </div>
      )}

    </aside>
  );
};
