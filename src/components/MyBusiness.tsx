import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/authContext';
import { updateBusinessCommercialData } from '../lib/businessService';
import { BusinessCommercialData, PaymentProviderStatus } from '../types';
import {
  Building2,
  Store,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit3,
  Save,
  X,
  Upload,
  Trash2,
  ShieldCheck,
  Info,
  Check,
  AlertTriangle,
  ExternalLink,
  Lock,
} from 'lucide-react';

interface MpStatusResponse {
  enabled: boolean;
  connected: boolean;
  connectionStatus: PaymentProviderStatus;
  provider: string;
  accountInfo?: {
    userId?: string;
    siteId?: string;
    externalStoreId?: string;
    storeId?: string;
    externalPosId?: string;
    posId?: string;
    connectedAt?: string;
    accountEmail?: string;
    accountNickname?: string;
  };
  lastError?: string;
}

const BUSINESS_TYPES = [
  'Minimarket',
  'Kiosco',
  'Almacén',
  'Despensa',
  'Librería',
  'Cafetería',
  'Fiambrería',
  'Carnicería',
  'Verdulería',
  'Otro',
];

export const MyBusiness: React.FC = () => {
  const { business, userProfile, authUser } = useAuth();
  const isAdmin = userProfile?.role === 'ADMIN' || userProfile?.role === 'SUPER_ADMIN';

  // Commercial Form State
  const [isEditing, setIsEditing] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [formData, setFormData] = useState<BusinessCommercialData>({
    name: business?.name || '',
    legalName: business?.legalName || '',
    taxId: business?.taxId || '',
    businessType: business?.businessType || 'Minimarket',
    address: business?.address || '',
    phone: business?.phone || '',
    email: business?.email || '',
    logoUrl: business?.logoUrl || '',
  });

  const [businessFeedback, setBusinessFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Mercado Pago Connection State
  const [mpLoading, setMpLoading] = useState(true);
  const [mpConnecting, setMpConnecting] = useState(false);
  const [mpDisconnecting, setMpDisconnecting] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [mpStatus, setMpStatus] = useState<MpStatusResponse | null>(null);
  const [mpFeedback, setMpFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initial business data
  useEffect(() => {
    if (business) {
      setFormData({
        name: business.name || '',
        legalName: business.legalName || '',
        taxId: business.taxId || '',
        businessType: business.businessType || 'Minimarket',
        address: business.address || '',
        phone: business.phone || '',
        email: business.email || '',
        logoUrl: business.logoUrl || '',
      });
    }
  }, [business]);

  // Check URL query for OAuth callback response
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('mp_connected') === 'true') {
      setMpFeedback({
        type: 'success',
        message: '¡Mercado Pago se ha conectado correctamente a tu negocio!',
      });
      // Clean query parameter from URL without reload
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    } else if (params.get('mp_error')) {
      setMpFeedback({
        type: 'error',
        message: decodeURIComponent(params.get('mp_error') || 'Error al conectar Mercado Pago.'),
      });
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
  }, []);

  // Fetch Mercado Pago connection status
  const fetchMpStatus = async () => {
    try {
      setMpLoading(true);
      const bId = business?.id || 'default';
      const res = await fetch(`/api/mercadopago/status?businessId=${encodeURIComponent(bId)}`);
      if (res.ok) {
        const data = await res.json();
        setMpStatus({
          enabled: data.enabled ?? Boolean(data.config?.enabled),
          connected: data.connected ?? Boolean(data.config?.enabled),
          connectionStatus: data.connectionStatus || (data.config?.enabled ? 'CONNECTED' : 'DISCONNECTED'),
          provider: data.provider || 'mercadopago',
          accountInfo: data.accountInfo,
          lastError: data.lastError,
        });
      }
    } catch (err: any) {
      console.warn('[MyBusiness] Error fetching MP status:', err);
    } finally {
      setMpLoading(false);
    }
  };

  useEffect(() => {
    fetchMpStatus();

    // Check for OAuth redirect query parameters (mp_status, mp_connected, mp_error)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const mpStatusParam = urlParams.get('mp_status');
      const mpConnectedParam = urlParams.get('mp_connected');
      const mpErrorParam = urlParams.get('mp_error');

      if (mpStatusParam === 'connected' || mpConnectedParam === 'true') {
        setMpFeedback({
          type: 'success',
          message: '¡Tu cuenta de Mercado Pago se ha vinculado exitosamente a este comercio!',
        });
        fetchMpStatus();
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      } else if (mpErrorParam) {
        setMpFeedback({
          type: 'error',
          message: `No se pudo vincular la cuenta de Mercado Pago: ${decodeURIComponent(mpErrorParam)}`,
        });
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, [business?.id]);

  // Handle Logo Upload (Client-side downscaling & compression)
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setBusinessFeedback({
        type: 'error',
        message: 'Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP).',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDimension = 320;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setFormData((prev) => ({ ...prev, logoUrl: compressedDataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setFormData((prev) => ({ ...prev, logoUrl: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Save Commercial Data
  const handleSaveBusinessData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id) return;
    if (!formData.name.trim()) {
      setBusinessFeedback({ type: 'error', message: 'El nombre comercial es obligatorio.' });
      return;
    }

    try {
      setSavingBusiness(true);
      setBusinessFeedback(null);

      await updateBusinessCommercialData(business.id, formData);

      // Local update feedback
      if (business) {
        business.name = formData.name.trim();
        business.legalName = formData.legalName?.trim();
        business.taxId = formData.taxId?.trim();
        business.businessType = formData.businessType?.trim();
        business.address = formData.address?.trim();
        business.phone = formData.phone?.trim();
        business.email = formData.email?.trim();
        business.logoUrl = formData.logoUrl;
      }

      setBusinessFeedback({
        type: 'success',
        message: 'Datos guardados correctamente.',
      });
      setIsEditing(false);
    } catch (err: any) {
      console.error('[MyBusiness] Error saving business data:', err);
      setBusinessFeedback({
        type: 'error',
        message: err?.message || 'Error al guardar los datos del negocio. Intenta nuevamente.',
      });
    } finally {
      setSavingBusiness(false);
    }
  };

  const handleCancelEditing = () => {
    if (business) {
      setFormData({
        name: business.name || '',
        legalName: business.legalName || '',
        taxId: business.taxId || '',
        businessType: business.businessType || 'Minimarket',
        address: business.address || '',
        phone: business.phone || '',
        email: business.email || '',
        logoUrl: business.logoUrl || '',
      });
    }
    setBusinessFeedback(null);
    setIsEditing(false);
  };

  // Connect Mercado Pago (Initiates Real OAuth)
  const handleConnectMercadoPago = async () => {
    if (!business?.id) return;
    try {
      setMpConnecting(true);
      setMpFeedback(null);

      const uidParam = authUser?.uid ? `&uid=${encodeURIComponent(authUser.uid)}` : '';
      const res = await fetch(`/api/mercadopago/connect?businessId=${encodeURIComponent(business.id)}${uidParam}`, {
        headers: { Accept: 'application/json' },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.error === 'MERCADOPAGO_NOT_CONFIGURED') {
          throw new Error('La plataforma Uwi aún no tiene configurada la aplicación de Mercado Pago (Client ID / Secret). El Super Admin debe configurarla primero.');
        }
        throw new Error(data.message || 'No se pudo iniciar la conexión con Mercado Pago.');
      }

      if (data.authUrl) {
        // Redirect to official Mercado Pago authorization window
        window.location.href = data.authUrl;
      } else if (data.success && data.connected) {
        setMpFeedback({
          type: 'success',
          message: '¡Mercado Pago se ha vinculado correctamente a tu negocio!',
        });
        await fetchMpStatus();
      } else {
        throw new Error(data.message || 'No se pudo iniciar la conexión con Mercado Pago.');
      }
    } catch (err: any) {
      console.error('[MyBusiness] Connect error:', err);
      setMpFeedback({
        type: 'error',
        message: err?.message || 'Error al conectar con Mercado Pago. Intenta nuevamente.',
      });
    } finally {
      setMpConnecting(false);
    }
  };

  // Disconnect Mercado Pago
  const handleConfirmDisconnect = async () => {
    if (!business?.id) return;
    try {
      setMpDisconnecting(true);
      setShowDisconnectModal(false);
      setMpFeedback(null);

      const res = await fetch('/api/mercadopago/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id }),
      });

      const data = await res.json();
      if (data.success) {
        setMpFeedback({
          type: 'info',
          message: 'Mercado Pago ha sido desconectado. Las ventas online quedarán pausadas hasta que vuelvas a vincular una cuenta.',
        });
        await fetchMpStatus();
      } else {
        throw new Error(data.message || 'No se pudo desconectar Mercado Pago.');
      }
    } catch (err: any) {
      console.error('[MyBusiness] Disconnect error:', err);
      setMpFeedback({
        type: 'error',
        message: err?.message || 'Error al desconectar Mercado Pago.',
      });
    } finally {
      setMpDisconnecting(false);
    }
  };

  const isMpConnected = Boolean(mpStatus?.connected && mpStatus?.enabled);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {formData.logoUrl ? (
            <img
              src={formData.logoUrl}
              alt="Logo del negocio"
              className="w-16 h-16 rounded-xl object-cover border border-stone-200 shadow-xs shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-700 font-black text-xl shrink-0">
              <Store className="w-8 h-8 text-stone-600" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-stone-900 tracking-tight">
                {formData.name || 'Mi Negocio'}
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Activo
              </span>
            </div>
            <p className="text-stone-500 text-xs mt-0.5">
              Gestión centralizada de la información comercial y medios de cobro de tu comercio.
            </p>
          </div>
        </div>

        {isAdmin && !isEditing && (
          <button
            type="button"
            id="btn-edit-business"
            onClick={() => {
              setIsEditing(true);
              setBusinessFeedback(null);
            }}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 self-start md:self-auto cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editar Datos del Negocio</span>
          </button>
        )}
      </div>

      {/* SECTION 1: DATOS DEL NEGOCIO */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-stone-700" />
            <h2 className="font-bold text-stone-900 text-sm">Información Comercial del Comercio</h2>
          </div>
          <span className="text-[11px] text-stone-400 font-mono">
            ID: {business?.id || '—'}
          </span>
        </div>

        {businessFeedback && (
          <div
            className={`mx-6 mt-4 p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
              businessFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {businessFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{businessFeedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSaveBusinessData} className="p-6 space-y-5">
          {/* Logo Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-stone-50 rounded-xl border border-stone-200/70">
            <div className="shrink-0">
              {formData.logoUrl ? (
                <div className="relative group">
                  <img
                    src={formData.logoUrl}
                    alt="Logo preview"
                    className="w-20 h-20 rounded-xl object-cover border border-stone-200 bg-white"
                    referrerPolicy="no-referrer"
                  />
                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center shadow-xs hover:bg-red-700 transition-all cursor-pointer"
                      title="Eliminar logo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-stone-300 bg-white flex flex-col items-center justify-center text-stone-400">
                  <Store className="w-7 h-7" />
                  <span className="text-[10px] mt-1 font-semibold">Sin logo</span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-bold text-stone-900">Logo del Negocio</h3>
              <p className="text-[11px] text-stone-500">
                Se muestra en el Punto de Venta, barra lateral y tickets o comprobantes futuros.
              </p>
              {isEditing && (
                <div className="pt-1 flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleLogoFileChange}
                    className="hidden"
                    id="business-logo-input"
                  />
                  <label
                    htmlFor="business-logo-input"
                    className="px-3 py-1.5 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg text-xs font-bold text-stone-700 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-95"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir imagen</span>
                  </label>
                  {formData.logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="px-3 py-1.5 text-red-700 hover:bg-red-50 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Quitar</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nombre comercial */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-stone-700">
                Nombre Comercial <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Kiosco Don Juan"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-[#006AFF] focus:border-transparent outline-hidden font-medium"
                />
              ) : (
                <div className="px-3 py-2 bg-stone-50 border border-stone-200/60 rounded-lg text-xs text-stone-900 font-semibold">
                  {formData.name || '—'}
                </div>
              )}
            </div>

            {/* Razón Social */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-stone-700">
                Razón Social
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.legalName || ''}
                  onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                  placeholder="Ej: Juan Pérez S.R.L."
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-[#006AFF] focus:border-transparent outline-hidden font-medium"
                />
              ) : (
                <div className="px-3 py-2 bg-stone-50 border border-stone-200/60 rounded-lg text-xs text-stone-900">
                  {formData.legalName || <span className="text-stone-400">Sin especificar</span>}
                </div>
              )}
            </div>

            {/* CUIT */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-stone-700">
                CUIT / Identificación Fiscal
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.taxId || ''}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  placeholder="Ej: 20-30456789-4"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-[#006AFF] focus:border-transparent outline-hidden font-medium"
                />
              ) : (
                <div className="px-3 py-2 bg-stone-50 border border-stone-200/60 rounded-lg text-xs font-mono text-stone-900">
                  {formData.taxId || <span className="text-stone-400 font-sans">Sin especificar</span>}
                </div>
              )}
            </div>

            {/* Rubro */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-stone-700">
                Rubro Principal
              </label>
              {isEditing ? (
                <select
                  value={formData.businessType || 'Minimarket'}
                  onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-[#006AFF] focus:border-transparent outline-hidden font-medium"
                >
                  {BUSINESS_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="px-3 py-2 bg-stone-50 border border-stone-200/60 rounded-lg text-xs text-stone-900 font-semibold">
                  {formData.businessType || 'Minimarket'}
                </div>
              )}
            </div>

            {/* Dirección */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-stone-700">
                Dirección Comercial
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Ej: Av. Corrientes 1234, CABA"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-[#006AFF] focus:border-transparent outline-hidden font-medium"
                />
              ) : (
                <div className="px-3 py-2 bg-stone-50 border border-stone-200/60 rounded-lg text-xs text-stone-900">
                  {formData.address || <span className="text-stone-400">Sin especificar</span>}
                </div>
              )}
            </div>

            {/* Teléfono */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-stone-700">
                Teléfono de Contacto
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Ej: +54 9 11 2345-6789"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-[#006AFF] focus:border-transparent outline-hidden font-medium"
                />
              ) : (
                <div className="px-3 py-2 bg-stone-50 border border-stone-200/60 rounded-lg text-xs text-stone-900">
                  {formData.phone || <span className="text-stone-400">Sin especificar</span>}
                </div>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1 md:col-span-2">
              <label className="block text-xs font-bold text-stone-700">
                Email Comercial
              </label>
              {isEditing ? (
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Ej: contacto@kioscojuan.com"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-[#006AFF] focus:border-transparent outline-hidden font-medium"
                />
              ) : (
                <div className="px-3 py-2 bg-stone-50 border border-stone-200/60 rounded-lg text-xs text-stone-900">
                  {formData.email || <span className="text-stone-400">Sin especificar</span>}
                </div>
              )}
            </div>
          </div>

          {/* Form Actions (Only during Edit Mode) */}
          {isEditing && (
            <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCancelEditing}
                disabled={savingBusiness}
                className="px-4 py-2 border border-stone-300 hover:bg-stone-100 text-stone-700 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingBusiness}
                className="px-5 py-2 bg-[#006AFF] hover:bg-[#0055CC] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {savingBusiness ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando cambios...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar Cambios</span>
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* SECTION 2: MEDIOS DE COBRO */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-stone-700" />
            <h2 className="font-bold text-stone-900 text-sm">Medios de Cobro Disponibles</h2>
          </div>
          <span className="text-[11px] text-stone-500 font-medium">
            Configuración por negocio
          </span>
        </div>

        {mpFeedback && (
          <div
            className={`mx-6 mt-4 p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
              mpFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : mpFeedback.type === 'error'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            {mpFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : mpFeedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span>{mpFeedback.message}</span>
          </div>
        )}

        <div className="p-6 space-y-4">
          {/* Card 1: Efectivo */}
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-stone-900">Efectivo</h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Activo
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Cobro manual en caja registradora con cálculo de vuelto. Siempre disponible, incluso en modo offline sin conexión a internet.
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Predeterminado
              </span>
            </div>
          </div>

          {/* Card 2: Mercado Pago */}
          <div className="p-5 rounded-xl border border-stone-200 bg-white shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#006AFF]/10 text-[#006AFF] flex items-center justify-center shrink-0 border border-[#006AFF]/20">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black text-stone-900">Mercado Pago</h3>
                    {mpLoading ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-stone-100 text-stone-600 flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Verificando...
                      </span>
                    ) : isMpConnected ? (
                      <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        Conectado
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                        No conectado
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Permite recibir cobros mediante código QR físico de mostrador, QR dinámico en pantalla y terminales Point.
                  </p>
                </div>
              </div>
            </div>

            {/* Connection States & Actions */}
            {mpLoading ? (
              <div className="p-4 bg-stone-50 rounded-xl flex items-center justify-center gap-2 text-stone-500 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin text-[#006AFF]" />
                <span>Consultando estado de Mercado Pago...</span>
              </div>
            ) : isMpConnected ? (
              /* Connected State Details */
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Cuenta vinculada correctamente</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-[11px]">
                  <div className="p-2.5 bg-white/90 rounded-lg border border-emerald-200/60">
                    <span className="text-stone-500 block text-[10px] font-bold uppercase">Sucursal</span>
                    <span className="font-semibold text-stone-900">
                      {mpStatus?.accountInfo?.externalStoreId || 'Configurada'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white/90 rounded-lg border border-emerald-200/60">
                    <span className="text-stone-500 block text-[10px] font-bold uppercase">Caja Principal</span>
                    <span className="font-semibold text-stone-900">
                      {mpStatus?.accountInfo?.externalPosId || 'Configurada'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white/90 rounded-lg border border-emerald-200/60">
                    <span className="text-stone-500 block text-[10px] font-bold uppercase">Usuario Comercial</span>
                    <span className="font-mono text-stone-900">
                      {mpStatus?.accountInfo?.userId || 'MLA'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white/90 rounded-lg border border-emerald-200/60">
                    <span className="text-stone-500 block text-[10px] font-bold uppercase">Fecha de Conexión</span>
                    <span className="text-stone-900">
                      {mpStatus?.accountInfo?.connectedAt
                        ? new Date(mpStatus.accountInfo.connectedAt).toLocaleDateString()
                        : 'Reciente'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <p className="text-[11px] text-stone-500">
                    Las acreditaciones se validan automáticamente con Mercado Pago antes de cerrar cada venta.
                  </p>
                  {isAdmin && (
                    <button
                      type="button"
                      id="btn-disconnect-mp"
                      onClick={() => setShowDisconnectModal(true)}
                      className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 shadow-2xs"
                    >
                      Desconectar Mercado Pago
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Disconnected / Not Connected State */
              <div className="p-5 bg-stone-50 border border-stone-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-stone-900">
                    Conectar Mercado Pago
                  </h4>
                  <p className="text-[11px] text-stone-600 max-w-xl">
                    Conecta la cuenta de Mercado Pago de tu negocio para recibir pagos y utilizar los cobros online. No necesitas copiar ni ingresar credenciales técnicas ni tokens.
                  </p>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    id="btn-connect-mp"
                    onClick={handleConnectMercadoPago}
                    disabled={mpConnecting}
                    className="px-5 py-2.5 bg-[#006AFF] hover:bg-[#0055CC] active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {mpConnecting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Conectando...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        <span>Conectar Mercado Pago</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-stone-200">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-stone-900">
                ¿Desconectar Mercado Pago?
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Las nuevas ventas online dejarán de utilizar Mercado Pago hasta que vuelvas a conectar una cuenta. Las ventas históricas, movimientos de caja y productos <strong>no serán modificados</strong>.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDisconnectModal(false)}
                disabled={mpDisconnecting}
                className="flex-1 py-2.5 border border-stone-300 hover:bg-stone-100 text-stone-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDisconnect}
                disabled={mpDisconnecting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                {mpDisconnecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Desconectando...</span>
                  </>
                ) : (
                  <span>Confirmar Desconexión</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
