import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../lib/authContext';
import { updateBusinessCommercialData } from '../../lib/businessService';
import { BusinessLogo } from './BusinessLogo';
import { 
  Building2, 
  Upload, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  Image as ImageIcon, 
  Store, 
  X, 
  RotateCcw,
  Check,
  ShieldCheck,
  Eye,
  Receipt,
  Calculator,
  LayoutGrid
} from 'lucide-react';

interface BusinessLogoCustomizerProps {
  onSuccess?: () => void;
}

export const BusinessLogoCustomizer: React.FC<BusinessLogoCustomizerProps> = ({ onSuccess }) => {
  const { business, userProfile, updateBusinessState } = useAuth();
  const isAdmin = userProfile?.role === 'ADMIN' || userProfile?.role === 'SUPER_ADMIN';

  const [currentLogo, setCurrentLogo] = useState<string>(business?.logoUrl || '');
  const [draftLogo, setDraftLogo] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [previewTab, setPreviewTab] = useState<'sidebar' | 'pos' | 'ticket'>('sidebar');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize state when business changes
  useEffect(() => {
    if (business?.logoUrl !== undefined) {
      setCurrentLogo(business.logoUrl || '');
    }
  }, [business?.logoUrl]);

  const activeLogo = draftLogo !== null ? draftLogo : currentLogo;
  const hasUnsavedChanges = draftLogo !== null && draftLogo !== currentLogo;

  // Validate and optimize image file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validate MIME type
    const validMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validMimeTypes.includes(file.type.toLowerCase())) {
      setFeedback({
        type: 'error',
        message: 'Formato no soportado. Por favor seleccioná una imagen PNG, JPG o WEBP.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Validate maximum file size (2 MB)
    const MAX_SIZE_BYTES = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      setFeedback({
        type: 'error',
        message: 'La imagen supera el límite de 2 MB. Elegí una imagen más liviana.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 3. Read and compress / scale via Canvas
    const reader = new FileReader();
    reader.onerror = () => {
      setFeedback({
        type: 'error',
        message: 'Error al leer el archivo de imagen. Intentá con otro archivo.',
      });
    };

    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => {
        setFeedback({
          type: 'error',
          message: 'El archivo seleccionado no es una imagen válida.',
        });
      };

      img.onload = () => {
        try {
          const maxDimension = 360;
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            throw new Error('No se pudo procesar la imagen.');
          }

          // Use high quality image rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to WebP or JPEG dataUrl
          const compressedDataUrl = canvas.toDataURL('image/webp', 0.90) || canvas.toDataURL('image/jpeg', 0.88);
          setDraftLogo(compressedDataUrl);
          setFeedback(null);
        } catch (err: any) {
          console.error('[BusinessLogoCustomizer] Compression error:', err);
          setFeedback({
            type: 'error',
            message: 'Error al optimizar la imagen. Intentá nuevamente.',
          });
        }
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  };

  // Save modified logo
  const handleSaveLogo = async () => {
    if (!business?.id || !isAdmin) return;
    if (draftLogo === null) return;

    try {
      setIsSaving(true);
      setFeedback(null);

      await updateBusinessCommercialData(business.id, {
        name: business.name || 'Mi Negocio',
        logoUrl: draftLogo,
      });

      // Update in-memory business context
      if (updateBusinessState) {
        updateBusinessState({ logoUrl: draftLogo });
      } else if (business) {
        business.logoUrl = draftLogo;
      }

      setCurrentLogo(draftLogo);
      setDraftLogo(null);
      setFeedback({
        type: 'success',
        message: '¡El logo de tu negocio se guardó y aplicó correctamente!',
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('[BusinessLogoCustomizer] Error saving logo:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Error al guardar el logo. Por favor intentá nuevamente.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Discard draft changes
  const handleDiscardChanges = () => {
    setDraftLogo(null);
    setFeedback(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Confirm remove logo
  const handleConfirmDeleteLogo = async () => {
    if (!business?.id || !isAdmin) return;
    try {
      setIsDeleting(true);
      setFeedback(null);

      await updateBusinessCommercialData(business.id, {
        name: business.name || 'Mi Negocio',
        logoUrl: '',
      });

      if (updateBusinessState) {
        updateBusinessState({ logoUrl: '' });
      } else if (business) {
        business.logoUrl = '';
      }

      setCurrentLogo('');
      setDraftLogo(null);
      setShowDeleteConfirm(false);
      if (fileInputRef.current) fileInputRef.current.value = '';

      setFeedback({
        type: 'info',
        message: 'Se eliminó el logo del negocio. Se utilizará el ícono e iniciales por defecto.',
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('[BusinessLogoCustomizer] Error deleting logo:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Error al eliminar el logo.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden" id="business-logo-customizer">
      {/* Card Header */}
      <div className="p-5 sm:p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-stone-50/70 via-white to-white">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-stone-900 tracking-tight">
                Identidad de tu negocio
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                Personalizable
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Configurá el logo exclusivo de tu comercio para el Punto de Venta, barra de menú y comprobantes.
            </p>
          </div>
        </div>

        {/* Global UWI note */}
        <div className="self-start sm:self-center px-3 py-1.5 bg-stone-100 rounded-xl border border-stone-200 text-[11px] text-stone-600 font-medium flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-stone-500 shrink-0" />
          <span>Identidad Uwi preservada</span>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`mx-5 sm:mx-6 mt-4 p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : feedback.type === 'info'
              ? 'bg-blue-50 text-blue-800 border border-blue-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {feedback.type === 'info' && <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />}
            {feedback.type === 'error' && <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-stone-400 hover:text-stone-600 cursor-pointer p-0.5"
            aria-label="Cerrar mensaje"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Body */}
      <div className="p-5 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: Logo Preview & Upload Actions (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200/80 flex flex-col items-center text-center space-y-3.5">
              
              {/* Logo Frame Container */}
              <div className="relative group">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl border-2 border-stone-200 bg-white p-2 shadow-xs flex items-center justify-center overflow-hidden transition-transform group-hover:scale-102">
                  <BusinessLogo
                    src={activeLogo}
                    name={business?.name || 'Mi Negocio'}
                    size="custom"
                    shape="rounded"
                    border={false}
                    className="w-full h-full object-contain"
                  />
                </div>

                {hasUnsavedChanges && (
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-amber-500 text-white font-black text-[10px] rounded-full shadow-xs uppercase tracking-wider">
                    Sin guardar
                  </span>
                )}
              </div>

              {/* Status & Name info */}
              <div>
                <h3 className="text-sm font-black text-stone-900 tracking-tight">
                  {business?.name || 'Mi Negocio'}
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  {activeLogo ? 'Logo personalizado cargado' : 'Sin logo personalizado (usando iniciales)'}
                </p>
              </div>

              {/* Upload & Action Buttons */}
              {isAdmin && (
                <div className="w-full space-y-2 pt-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                    id="business-logo-file-input"
                  />

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <label
                      htmlFor="business-logo-file-input"
                      className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-all active:scale-95"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{activeLogo ? 'Cambiar logo' : 'Subir logo'}</span>
                    </label>

                    {activeLogo && (
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-3 py-2 bg-white hover:bg-red-50 text-red-700 border border-stone-200 hover:border-red-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                        title="Eliminar logo del negocio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-stone-400 font-medium">
                    Formatos: PNG, JPG o WEBP (máx. 2 MB)
                  </p>
                </div>
              )}
            </div>

            {/* Unsaved Changes Save / Discard Bar */}
            {hasUnsavedChanges && (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/90 space-y-2.5 animate-in fade-in">
                <div className="flex items-center gap-2 text-amber-900 text-xs font-bold">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Tenés cambios pendientes en el logo</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveLogo}
                    disabled={isSaving}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Guardar cambios</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDiscardChanges}
                    disabled={isSaving}
                    className="py-2 px-3 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Live Contextual Previews (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-stone-800">
                <Eye className="w-4 h-4 text-blue-600" />
                <span>Previsualización en tiempo real</span>
              </div>

              {/* Preview Tabs */}
              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPreviewTab('sidebar')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    previewTab === 'sidebar'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span>Barra Lateral</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('pos')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    previewTab === 'pos'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Calculator className="w-3 h-3" />
                  <span>POS / Caja</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('ticket')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    previewTab === 'ticket'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Receipt className="w-3 h-3" />
                  <span>Ticket Térmico</span>
                </button>
              </div>
            </div>

            {/* PREVIEW FRAME 1: SIDEBAR HEADER MOCKUP */}
            {previewTab === 'sidebar' && (
              <div className="p-4 bg-stone-900 text-white rounded-2xl border border-stone-800 shadow-xs space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Encabezado de Navegación
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-stone-800 text-emerald-400 font-mono">
                    UWI + NEGOCIO
                  </span>
                </div>

                <div className="flex items-center space-x-3 p-2 bg-stone-800/60 rounded-xl border border-stone-700/60">
                  <BusinessLogo
                    src={activeLogo}
                    name={business?.name || 'Mi Negocio'}
                    size="sm"
                    shape="rounded"
                    border={false}
                    className="border border-stone-600 shadow-xs shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-sm text-white leading-none lowercase">uwi</span>
                      <span className="text-stone-500 text-xs">/</span>
                      <span className="text-xs font-bold text-stone-200 truncate leading-none">
                        {business?.name || 'Mi Negocio'}
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-400 font-medium truncate mt-1">
                      Punto de Venta & Gestión
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* PREVIEW FRAME 2: POS CAJA HEADER MOCKUP */}
            {previewTab === 'pos' && (
              <div className="p-4 bg-stone-50 text-stone-900 rounded-2xl border border-stone-200 shadow-xs space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Barra de Caja y Turno
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                    CAJA ACTIVA
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-stone-200 shadow-2xs">
                  <div className="flex items-center space-x-2.5">
                    <BusinessLogo
                      src={activeLogo}
                      name={business?.name || 'Mi Negocio'}
                      size="sm"
                      shape="rounded"
                      border={true}
                      className="border-stone-200"
                    />
                    <div>
                      <h4 className="text-xs font-black text-stone-900 leading-tight">
                        {business?.name || 'Mi Negocio'}
                      </h4>
                      <p className="text-[10px] text-stone-500 font-medium">
                        Terminal N.º 1 · Turno Abierto
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    $0,00
                  </span>
                </div>
              </div>
            )}

            {/* PREVIEW FRAME 3: THERMAL TICKET MOCKUP */}
            {previewTab === 'ticket' && (
              <div className="p-4 bg-[#f8f6f0] text-stone-900 rounded-2xl border border-[#e8e4d8] shadow-xs space-y-2 font-mono text-[11px] animate-in fade-in duration-150">
                <div className="text-center space-y-1 border-b border-dashed border-stone-300 pb-2.5">
                  <div className="flex justify-center">
                    <BusinessLogo
                      src={activeLogo}
                      name={business?.name || 'Mi Negocio'}
                      size="sm"
                      shape="rounded"
                      border={true}
                      className="border-stone-300"
                    />
                  </div>
                  <p className="font-black text-xs uppercase tracking-wider text-stone-900">
                    {business?.name || 'MI NEGOCIO'}
                  </p>
                  <p className="text-[9px] text-stone-500 font-sans">
                    COMPROBANTE DE COMPRA DIGITAL
                  </p>
                </div>

                <div className="space-y-0.5 text-[10px] text-stone-600 pt-1">
                  <div className="flex justify-between">
                    <span>1x Producto Demo</span>
                    <span>$1.500,00</span>
                  </div>
                  <div className="flex justify-between font-bold text-stone-900 border-t border-dashed border-stone-300 pt-1">
                    <span>TOTAL:</span>
                    <span>$1.500,00</span>
                  </div>
                </div>

                <p className="text-[8px] text-center text-stone-400 font-sans pt-1">
                  Emitido con uwi
                </p>
              </div>
            )}

            <p className="text-[11px] text-stone-400 font-medium">
              El logo del negocio se actualiza al instante en todos los dispositivos y usuarios vendedores de tu comercio.
            </p>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL: DELETE LOGO */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 max-w-sm w-full space-y-4 shadow-xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-stone-900">¿Eliminar logo del negocio?</h3>
                <p className="text-xs text-stone-500">Esta acción restaurará el ícono e iniciales por defecto.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteLogo}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <span>Sí, eliminar logo</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
