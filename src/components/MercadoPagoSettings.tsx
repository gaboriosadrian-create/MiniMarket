import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { getAllBusinesses } from '../lib/businessService';
import { Business } from '../types';
import QRCode from 'qrcode';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  QrCode,
  ShieldCheck,
  Printer,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  Store,
  Layers,
  ArrowRightLeft,
  AlertTriangle,
  History,
  Info,
  Check,
  X,
  Building2,
  Key,
  Users,
  Copy,
  Save,
} from 'lucide-react';

interface SanitizedPosCredentials {
  userId?: string;
  siteId?: string;
  externalStoreId?: string;
  externalPosId?: string;
  storeId?: string;
  posId?: string;
  pointTerminalId?: string;
  pointModel?: string;
  pointOperatingMode?: string;
  hasAccessToken: boolean;
}

interface SanitizedTenantConfig {
  businessId: string;
  enabled: boolean;
  mode: 'TEST' | 'PRODUCTION';
  autoConfirm: boolean;
  connectionStatus: 'NOT_VERIFIED' | 'CONNECTED' | 'ERROR';
  lastVerification?: string;
  lastVerificationMessage?: string;
  updatedAt?: string;
  updatedBy?: string;
  testConfig: SanitizedPosCredentials;
  productionConfig: SanitizedPosCredentials;
  activeConfigSummary: {
    mode: 'TEST' | 'PRODUCTION';
    userId: string;
    siteId: string;
    externalStoreId: string;
    externalPosId: string;
    storeId: string;
    posId: string;
    pointTerminalId?: string;
    pointModel?: string;
    pointStatus?: string;
    hasAccessToken: boolean;
    qrStatus: string;
    connectionStatus: 'NOT_VERIFIED' | 'CONNECTED' | 'ERROR';
  };
}

interface AuditItem {
  id: string;
  timestamp: string;
  action?: string;
  result?: string;
  userId?: string;
  pos?: string;
  store?: string;
  errorDetails?: string;
  minimarketNewState?: string;
}

interface MercadoPagoSettingsProps {
  initialBusinessId?: string;
  onNavigateToBusiness?: () => void;
}

export const MercadoPagoSettings: React.FC<MercadoPagoSettingsProps> = ({
  initialBusinessId,
  onNavigateToBusiness,
}) => {
  const { userProfile, business } = useAuth();
  const isSuperAdmin = userProfile?.role === 'SUPER_ADMIN';

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>(
    initialBusinessId || business?.id || 'default'
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [serverConfig, setServerConfig] = useState<SanitizedTenantConfig | null>(null);

  // Form State
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<'TEST' | 'PRODUCTION'>('TEST');
  const [autoConfirm, setAutoConfirm] = useState(false);

  // Production Form Inputs
  const [prodToken, setProdToken] = useState('');
  const [showProdToken, setShowProdToken] = useState(false);
  const [prodUserId, setProdUserId] = useState('');
  const [prodSiteId, setProdSiteId] = useState('MLA');
  const [prodExtStoreId, setProdExtStoreId] = useState('');
  const [prodExtPosId, setProdExtPosId] = useState('');
  const [prodStoreId, setProdStoreId] = useState('');
  const [prodPosId, setProdPosId] = useState('');
  const [prodPointTerminalId, setProdPointTerminalId] = useState('');
  const [prodPointModel, setProdPointModel] = useState<'POINT_SMART_1' | 'POINT_SMART_2'>('POINT_SMART_1');

  // Super Admin Platform OAuth & Merchants State
  const [activeAdminTab, setActiveAdminTab] = useState<'platform' | 'merchants' | 'tenant_params'>('platform');
  const [platformConfig, setPlatformConfig] = useState<{
    clientIdMasked: string;
    redirectUri: string;
    isConfigured: boolean;
    hasSecret: boolean;
  } | null>(null);
  const [platformClientId, setPlatformClientId] = useState('');
  const [platformClientSecret, setPlatformClientSecret] = useState('');
  const [platformRedirectUri, setPlatformRedirectUri] = useState('');
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [showPlatformSecret, setShowPlatformSecret] = useState(false);
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const [connectedMerchants, setConnectedMerchants] = useState<any[]>([]);
  const [loadingMerchants, setLoadingMerchants] = useState(false);

  // Notifications & Modals
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [pendingModeSwitch, setPendingModeSwitch] = useState<'TEST' | 'PRODUCTION' | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);

  // RBAC Permission Check
  const isAdmin = userProfile?.role === 'ADMIN' || userProfile?.role === 'SUPER_ADMIN';

  const fetchPlatformConfig = async () => {
    try {
      const res = await fetch('/api/mercadopago/platform-config');
      const data = await res.json();
      if (data.success && data.config) {
        setPlatformConfig(data.config);
        if (data.config.redirectUri) {
          setPlatformRedirectUri(data.config.redirectUri);
        }
      }
    } catch (err) {
      console.error('Error cargando configuración de plataforma:', err);
    }
  };

  const fetchMerchants = async () => {
    try {
      setLoadingMerchants(true);
      const res = await fetch('/api/mercadopago/merchants');
      const data = await res.json();
      if (data.success && Array.isArray(data.merchants)) {
        setConnectedMerchants(data.merchants);
      }
    } catch (err) {
      console.error('Error cargando comercios conectados:', err);
    } finally {
      setLoadingMerchants(false);
    }
  };

  const handleSavePlatformConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingPlatform(true);
      setFeedback(null);
      const res = await fetch('/api/mercadopago/platform-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: platformClientId.trim(),
          clientSecret: platformClientSecret.trim(),
          redirectUri: platformRedirectUri.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPlatformConfig(data.config);
        setPlatformClientSecret(''); // Clear secret from memory
        setFeedback({
          type: 'success',
          message: '✓ Credenciales de la Aplicación Mercado Pago de Uwi guardadas exitosamente.',
        });
      } else {
        throw new Error(data.message || 'No se pudo guardar la configuración de la plataforma.');
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Error al guardar credenciales de la aplicación de Mercado Pago.',
      });
    } finally {
      setSavingPlatform(false);
    }
  };

  // Load all businesses for Super Admin tenant switcher
  useEffect(() => {
    if (isSuperAdmin) {
      fetchPlatformConfig();
      fetchMerchants();
      getAllBusinesses()
        .then((list) => {
          setBusinesses(list);
          if (!initialBusinessId && list.length > 0 && selectedBusinessId === 'default') {
            // Default to first active business if available
            const firstActive = list.find((b) => b.status === 'active') || list[0];
            setSelectedBusinessId(firstActive.id);
            loadConfig(firstActive.id);
          }
        })
        .catch((err) => {
          console.error('Error cargando lista de comercios:', err);
        });
    }
  }, [isSuperAdmin, initialBusinessId]);

  // Load config on mount or tenant switch
  const loadConfig = async (targetBId?: string) => {
    try {
      setLoading(true);
      const bId = targetBId || selectedBusinessId;
      const res = await fetch(`/api/mercadopago/config?businessId=${encodeURIComponent(bId)}`);
      const data = await res.json();

      if (data.success && data.config) {
        const cfg: SanitizedTenantConfig = data.config;
        setServerConfig(cfg);
        setEnabled(cfg.enabled);
        setMode(cfg.mode);
        setAutoConfirm(cfg.autoConfirm);

        // Populate production inputs from existing config
        setProdUserId(cfg.productionConfig.userId || '');
        setProdSiteId(cfg.productionConfig.siteId || 'MLA');
        setProdExtStoreId(cfg.productionConfig.externalStoreId || '');
        setProdExtPosId(cfg.productionConfig.externalPosId || '');
        setProdStoreId(cfg.productionConfig.storeId || '');
        setProdPosId(cfg.productionConfig.posId || '');
        setProdPointTerminalId(cfg.productionConfig.pointTerminalId || '');
        setProdPointModel(
          cfg.productionConfig.pointModel === 'POINT_SMART_2' ? 'POINT_SMART_2' : 'POINT_SMART_1'
        );
      }

      // Also fetch recent audits
      const auditRes = await fetch('/api/mercadopago/audits?limit=8');
      const auditData = await auditRes.json();
      if (auditData.success && Array.isArray(auditData.logs)) {
        setAuditLogs(auditData.logs);
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'No se pudo cargar la configuración de Mercado Pago desde el servidor.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig(selectedBusinessId);
  }, [selectedBusinessId]);

  // Generate QR Code data URL for test sandbox POS
  useEffect(() => {
    const posId = serverConfig?.testConfig.posId || '137101354';
    const extPos = serverConfig?.testConfig.externalPosId || 'MINIMARKETPOCCAJA01';
    const qrPayload = `https://www.mercadopago.com.ar/instore/merchant/qr/${posId}/${extPos}`;

    QRCode.toDataURL(qrPayload, {
      width: 320,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating QR:', err));
  }, [serverConfig]);

  // Handle Save
  const handleSaveConfig = async () => {
    if (!isAdmin) {
      setFeedback({ type: 'error', message: 'Acceso denegado: Solo administradores pueden modificar la configuración.' });
      return;
    }

    // If enabling production, validate required fields
    if (enabled && mode === 'PRODUCTION') {
      const hasToken = Boolean(prodToken.trim() || serverConfig?.productionConfig.hasAccessToken);
      if (!hasToken || !prodUserId.trim() || !prodExtPosId.trim() || !prodPosId.trim()) {
        setFeedback({
          type: 'error',
          message: 'No se puede activar Mercado Pago en producción hasta completar y verificar la configuración (Token, User ID, POS y External POS son obligatorios).',
        });
        return;
      }
    }

    try {
      setSaving(true);
      setFeedback(null);
      const bId = selectedBusinessId;

      const payload: any = {
        businessId: bId,
        enabled,
        mode,
        autoConfirm,
        updatedBy: userProfile?.displayName || userProfile?.email || (isSuperAdmin ? 'Super Admin' : 'Administrador'),
        productionConfig: {
          userId: prodUserId.trim(),
          siteId: prodSiteId.trim() || 'MLA',
          externalStoreId: prodExtStoreId.trim(),
          externalPosId: prodExtPosId.trim(),
          storeId: prodStoreId.trim(),
          posId: prodPosId.trim(),
          pointTerminalId: prodPointTerminalId.trim(),
          pointModel: prodPointModel,
          pointOperatingMode: 'PDV',
        },
      };

      if (prodToken.trim()) {
        payload.productionConfig.accessToken = prodToken.trim();
      }

      const res = await fetch('/api/mercadopago/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.config) {
        setServerConfig(data.config);
        setProdToken(''); // Clear token from memory after save
        setFeedback({
          type: 'success',
          message: '✓ Configuración de Mercado Pago guardada exitosamente.',
        });
        // Reload audit logs
        const auditRes = await fetch('/api/mercadopago/audits?limit=8');
        const auditData = await auditRes.json();
        if (auditData.success && Array.isArray(auditData.logs)) {
          setAuditLogs(auditData.logs);
        }
      } else {
        setFeedback({
          type: 'error',
          message: data.message || 'No se pudo guardar la configuración.',
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Error de comunicación al guardar la configuración.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle Verify Connection
  const handleVerifyConnection = async () => {
    if (!isAdmin) {
      setFeedback({ type: 'error', message: 'Solo administradores pueden verificar la conexión.' });
      return;
    }

    try {
      setVerifying(true);
      setFeedback(null);
      const bId = selectedBusinessId;

      const res = await fetch('/api/mercadopago/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: bId,
          mode,
          testedBy: userProfile?.displayName || userProfile?.email || (isSuperAdmin ? 'Super Admin' : 'Administrador'),
        }),
      });

      const result = await res.json();
      if (result.success && result.status === 'CONNECTED') {
        setFeedback({
          type: 'success',
          message: result.message || '✓ Mercado Pago conectado correctamente.',
        });
        loadConfig();
      } else {
        setFeedback({
          type: 'error',
          message: result.message || '✕ No se pudo verificar la integración con Mercado Pago.',
        });
        loadConfig();
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'No se pudo conectar con el endpoint de verificación.',
      });
    } finally {
      setVerifying(false);
    }
  };

  // Mode switch trigger with confirmation
  const handleRequestModeChange = (targetMode: 'TEST' | 'PRODUCTION') => {
    if (targetMode === mode) return;
    setPendingModeSwitch(targetMode);
  };

  const confirmModeSwitch = () => {
    if (!pendingModeSwitch) return;
    setMode(pendingModeSwitch);
    setPendingModeSwitch(null);
    setFeedback({
      type: 'info',
      message: `Modo cambiado a ${pendingModeSwitch === 'TEST' ? 'Prueba / Sandbox' : 'Producción'}. Recuerde presionar "Guardar configuración".`,
    });
  };

  const cancelModeSwitch = () => {
    setPendingModeSwitch(null);
  };

  // Print QR handler
  const handlePrintQr = () => {
    window.print();
  };

  if (userProfile && userProfile.role !== 'SUPER_ADMIN') {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-4 max-w-xl mx-auto shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-stone-900">Configuración Técnica de Plataforma</h3>
        <p className="text-xs text-stone-600 leading-relaxed">
          Los parámetros técnicos de bajo nivel (credenciales de pasarela, tokens, modo sandbox y webhook URLs) están restringidos y son administrados centralmente por el Super Administrador de la plataforma.
        </p>
        <p className="text-xs text-stone-600">
          Para vincular o gestionar los cobros con Mercado Pago de tu negocio, dirígete a <strong>Mi Negocio</strong>.
        </p>
        {onNavigateToBusiness && (
          <button
            type="button"
            onClick={onNavigateToBusiness}
            className="px-4 py-2 bg-[#006AFF] hover:bg-[#0055CC] text-white text-xs font-bold rounded-xl shadow-xs transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <Building2 className="w-4 h-4" />
            <span>Ir a Mi Negocio</span>
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-8 text-center space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin text-[#006AFF] mx-auto" />
        <p className="text-sm font-bold text-stone-700">Cargando configuración de Mercado Pago...</p>
      </div>
    );
  }

  const activeCreds = mode === 'TEST' ? serverConfig?.testConfig : serverConfig?.productionConfig;
  const isConnected = serverConfig?.connectionStatus === 'CONNECTED';
  const hasError = serverConfig?.connectionStatus === 'ERROR';

  return (
    <div className="space-y-5">
      {/* Super Admin Multi-tenant Business Selector */}
      {isSuperAdmin && (
        <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900">
                Gestión Técnica de Pasarela por Comercio (Multi-Tenant)
              </h4>
              <p className="text-[11px] text-purple-700">
                Selecciona el comercio para inspeccionar, configurar o verificar credenciales de Mercado Pago.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="select-tenant-business" className="text-xs font-bold text-purple-900 shrink-0">
              Comercio:
            </label>
            <select
              id="select-tenant-business"
              value={selectedBusinessId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedBusinessId(newId);
                loadConfig(newId);
              }}
              className="px-3 py-1.5 bg-white border border-purple-300 rounded-xl text-xs font-semibold text-purple-950 focus:ring-2 focus:ring-purple-500 focus:outline-none shadow-2xs cursor-pointer"
            >
              <option value="default">Por Defecto / Plataforma (default)</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.id})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Breadcrumb Header */}
      <div className="bg-stone-50 border border-stone-200/80 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2 text-xs text-stone-600 font-medium">
          <span className="text-stone-400">Administrador</span>
          <span className="text-stone-300">/</span>
          <span className="text-stone-400">Configuración</span>
          <span className="text-stone-300">/</span>
          <span className="text-stone-400">Integraciones</span>
          <span className="text-stone-300">/</span>
          <span className="font-black text-[#006AFF] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            Mercado Pago
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
            enabled
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-stone-100 text-stone-600 border border-stone-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-stone-400'}`} />
            {enabled ? 'Integración Activada' : 'Integración Desactivada'}
          </span>

          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
            mode === 'TEST'
              ? 'bg-amber-50 text-amber-900 border border-amber-200'
              : 'bg-blue-50 text-blue-900 border border-blue-200'
          }`}>
            <Layers className="w-3 h-3" />
            {mode === 'TEST' ? 'Modo Prueba / Demo' : 'Modo Producción'}
          </span>
        </div>
      </div>

      {/* Main Feedback Banner */}
      {feedback && (
        <div
          id="mp-settings-feedback"
          className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : feedback.type === 'error'
              ? 'bg-red-50 border-red-300 text-red-950'
              : 'bg-blue-50 border-blue-300 text-blue-950'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {feedback.type === 'error' && <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
            {feedback.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-stone-400 hover:text-stone-700 cursor-pointer p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Super Admin Top Sub-navigation Tabs */}
      {isSuperAdmin && (
        <div className="flex border-b border-stone-200 gap-1 sm:gap-2 overflow-x-auto pb-px">
          <button
            type="button"
            id="tab-superadmin-platform"
            onClick={() => setActiveAdminTab('platform')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeAdminTab === 'platform'
                ? 'border-[#006AFF] text-[#006AFF]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>1. Aplicación Mercado Pago (OAuth Integrador)</span>
            {platformConfig?.isConfigured ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1" title="Configurada" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-500 ml-1" title="Pendiente de configurar" />
            )}
          </button>

          <button
            type="button"
            id="tab-superadmin-merchants"
            onClick={() => {
              setActiveAdminTab('merchants');
              fetchMerchants();
            }}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeAdminTab === 'merchants'
                ? 'border-[#006AFF] text-[#006AFF]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>2. Comercios Vinculados ({connectedMerchants.length})</span>
          </button>

          <button
            type="button"
            id="tab-superadmin-tenant-params"
            onClick={() => setActiveAdminTab('tenant_params')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeAdminTab === 'tenant_params'
                ? 'border-[#006AFF] text-[#006AFF]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>3. Parámetros Técnicos por Comercio</span>
          </button>
        </div>
      )}

      {/* TAB 1: Super Admin - Platform OAuth Application Config */}
      {isSuperAdmin && activeAdminTab === 'platform' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden space-y-0">
          <div className="p-4 sm:p-5 border-b border-stone-100 bg-gradient-to-r from-blue-50/60 via-white to-stone-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-[#006AFF] text-white flex items-center justify-center font-black shadow-xs">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
                    Credenciales de Plataforma Uwi (OAuth Integrador)
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    platformConfig?.isConfigured
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {platformConfig?.isConfigured ? '✓ Configurada' : '⚠️ Pendiente'}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Permite a todos los comercios conectar sus propias cuentas de Mercado Pago mediante OAuth 2.0 seguro.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                platformConfig?.isConfigured
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                {platformConfig?.isConfigured ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>OAuth Activo para Comercios</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Requiere Configuración Técnica</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Platform Config Form */}
          <form onSubmit={handleSavePlatformConfig} className="p-4 sm:p-6 space-y-5">
            {/* Explanatory banner */}
            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#006AFF] shrink-0" />
                <span>¿Cómo funciona la arquitectura OAuth Multi-Tenant?</span>
              </p>
              <p className="text-blue-800 leading-relaxed">
                Uwi registra una única aplicación en <strong>Mercado Pago Developers</strong>. Los comercios no necesitan generar credenciales de desarrollador ni cargar Access Tokens: simplemente hacen clic en <em>"Conectar Mercado Pago"</em> en <strong>Mi Negocio</strong> y autorizan a Uwi a cobrar en su cuenta mediante el flujo OAuth oficial.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Client ID / App ID */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-800">
                  Client ID / App ID de Mercado Pago
                </label>
                <input
                  type="text"
                  value={platformClientId}
                  onChange={(e) => setPlatformClientId(e.target.value)}
                  placeholder={platformConfig?.clientIdMasked || 'ej: 8472910394827103'}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:bg-white focus:ring-2 focus:ring-[#006AFF] focus:outline-none"
                />
                <p className="text-[11px] text-stone-500">
                  {platformConfig?.clientIdMasked ? `Actual en servidor: ${platformConfig.clientIdMasked}` : 'Se encuentra en Mercado Pago Developers > Tus aplicaciones > Detalles.'}
                </p>
              </div>

              {/* Client Secret */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-800">
                  Client Secret de Mercado Pago
                </label>
                <div className="relative">
                  <input
                    type={showPlatformSecret ? 'text' : 'password'}
                    value={platformClientSecret}
                    onChange={(e) => setPlatformClientSecret(e.target.value)}
                    placeholder={platformConfig?.hasSecret ? '••••••••••••••••••••••••••••••••' : 'Ingresa el Client Secret'}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:bg-white focus:ring-2 focus:ring-[#006AFF] focus:outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPlatformSecret(!showPlatformSecret)}
                    className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    {showPlatformSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-stone-500">
                  {platformConfig?.hasSecret ? '✓ Secret ya configurado de forma segura en el servidor.' : 'Nunca se expone al frontend ni a los comercios.'}
                </p>
              </div>

              {/* Redirect URI */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-xs font-bold text-stone-800">
                  Redirect URI de Retorno OAuth
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={platformRedirectUri}
                    onChange={(e) => setPlatformRedirectUri(e.target.value)}
                    placeholder="https://tu-dominio.com/api/mercadopago/callback"
                    className="flex-1 px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:bg-white focus:ring-2 focus:ring-[#006AFF] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const uri = platformRedirectUri || platformConfig?.redirectUri || `${window.location.origin}/api/mercadopago/callback`;
                      navigator.clipboard.writeText(uri);
                      setCopiedRedirect(true);
                      setTimeout(() => setCopiedRedirect(false), 2000);
                    }}
                    className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl border border-stone-300 flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                  >
                    {copiedRedirect ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-stone-600" />
                        <span>Copiar URL</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-stone-500">
                  Copia esta URL y agrégala en la sección <strong>"Rutas de redirección"</strong> dentro del portal de desarrolladores de Mercado Pago.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
              <div className="text-xs text-stone-500">
                {platformConfig?.isConfigured
                  ? 'La aplicación de plataforma está lista para procesar autorizaciones de comercios.'
                  : 'Completa estos campos para habilitar la conexión OAuth de comercios.'}
              </div>
              <button
                type="submit"
                disabled={savingPlatform}
                className="px-5 py-2.5 bg-[#006AFF] hover:bg-[#0055CC] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {savingPlatform ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Guardar Credenciales de Plataforma</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: Super Admin - Connected Merchants Audit Table */}
      {isSuperAdmin && activeAdminTab === 'merchants' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden space-y-0">
          <div className="p-4 sm:p-5 border-b border-stone-100 bg-gradient-to-r from-purple-50/50 via-white to-stone-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black shadow-xs">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
                  Comercios Vinculados (Multi-Tenant)
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Auditoría centralizada de cuentas de Mercado Pago conectadas por comercio con aislamiento estricto.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchMerchants}
              disabled={loadingMerchants}
              className="px-3 py-1.5 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingMerchants ? 'animate-spin text-purple-600' : ''}`} />
              <span>Actualizar Listado</span>
            </button>
          </div>

          <div className="p-4 sm:p-6">
            {connectedMerchants.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-stone-200 rounded-xl space-y-2">
                <Store className="w-8 h-8 text-stone-300 mx-auto" />
                <p className="text-xs font-bold text-stone-700">No hay comercios con Mercado Pago vinculado aún.</p>
                <p className="text-[11px] text-stone-400 max-w-sm mx-auto">
                  Los administradores de cada comercio pueden conectar su cuenta de Mercado Pago desde la sección "Mi Negocio".
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-stone-600 font-bold uppercase text-[10px] tracking-wider border-b border-stone-200">
                    <tr>
                      <th className="py-2.5 px-3">Comercio (ID)</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3">Cuenta MP (User ID)</th>
                      <th className="py-2.5 px-3">Sucursal / Tienda</th>
                      <th className="py-2.5 px-3">Caja Asignada</th>
                      <th className="py-2.5 px-3">Fecha Conexión</th>
                      <th className="py-2.5 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {connectedMerchants.map((m) => {
                      const businessName = businesses.find((b) => b.id === m.businessId)?.name || m.businessId;
                      return (
                        <tr key={m.businessId} className="hover:bg-stone-50/60 transition-colors">
                          <td className="py-3 px-3 font-semibold text-stone-900">
                            <div>{businessName}</div>
                            <div className="font-mono text-[10px] text-stone-400">{m.businessId}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              m.status === 'CONNECTED'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-stone-100 text-stone-600 border border-stone-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'CONNECTED' ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                              {m.status === 'CONNECTED' ? 'Conectado' : 'Desconectado'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-stone-700">
                            <div>{m.userId || 'Sin ID'}</div>
                            {m.accountNickname && (
                              <div className="text-[10px] text-stone-500 font-sans">{m.accountNickname}</div>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-stone-600">
                            {m.externalStoreId || m.storeId || '-'}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-stone-600">
                            {m.externalPosId || m.posId || '-'}
                          </td>
                          <td className="py-3 px-3 text-stone-500 text-[11px]">
                            {m.connectedAt ? new Date(m.connectedAt).toLocaleDateString('es-AR') : '-'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBusinessId(m.businessId);
                                setActiveAdminTab('tenant_params');
                                loadConfig(m.businessId);
                              }}
                              className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                            >
                              Ver Parámetros
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3 (or default for regular Admin): Tenant Parameters & Sandbox POS */}
      {(!isSuperAdmin || activeAdminTab === 'tenant_params') && (
        <>
        <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        {/* Card Top Title Banner */}
        <div className="p-4 sm:p-5 border-b border-stone-100 bg-gradient-to-r from-blue-50/50 via-white to-stone-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-[#006AFF] text-white flex items-center justify-center font-black shadow-xs">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
                  MERCADO PAGO
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                  QR Orders API
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Administración de cobros presenciales con QR dinámico e interoperable en punto de venta.
              </p>
            </div>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${
              isConnected
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : hasError
                ? 'bg-red-50 text-red-800 border-red-200'
                : 'bg-stone-50 text-stone-700 border-stone-200'
            }`}>
              {isConnected ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>✓ Mercado Pago conectado correctamente</span>
                </>
              ) : hasError ? (
                <>
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>No se pudo verificar la conexión</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-stone-400" />
                  <span>Conexión No verificada</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Section 1: Estado & Modo Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-5 border-b border-stone-100">
            {/* Estado de Integración */}
            <div className="bg-stone-50/80 rounded-xl p-4 border border-stone-200/80 space-y-3">
              <label className="block text-xs font-black uppercase tracking-wider text-stone-700">
                1. Estado de la Integración
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-mp-state-disabled"
                  onClick={() => setEnabled(false)}
                  className={`p-3 rounded-lg border text-left font-bold text-xs transition-all cursor-pointer flex items-center space-x-2.5 ${
                    !enabled
                      ? 'bg-white border-stone-400 shadow-xs text-stone-900 ring-2 ring-stone-400/20'
                      : 'bg-stone-100/70 border-stone-200 text-stone-500 hover:bg-stone-200/50'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    !enabled ? 'border-stone-800 bg-stone-800' : 'border-stone-300'
                  }`}>
                    {!enabled && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <div>
                    <span className="block text-xs font-bold">Desactivada</span>
                    <span className="text-[10px] text-stone-400 font-normal">Sin cobros con QR</span>
                  </div>
                </button>

                <button
                  type="button"
                  id="btn-mp-state-enabled"
                  onClick={() => setEnabled(true)}
                  className={`p-3 rounded-lg border text-left font-bold text-xs transition-all cursor-pointer flex items-center space-x-2.5 ${
                    enabled
                      ? 'bg-blue-50 border-[#006AFF] shadow-xs text-[#006AFF] ring-2 ring-[#006AFF]/20'
                      : 'bg-stone-100/70 border-stone-200 text-stone-500 hover:bg-stone-200/50'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    enabled ? 'border-[#006AFF] bg-[#006AFF]' : 'border-stone-300'
                  }`}>
                    {enabled && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <div>
                    <span className="block text-xs font-bold text-blue-900">Activada</span>
                    <span className="text-[10px] text-blue-600/80 font-normal">Habilitar QR en POS</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Modo de Operación */}
            <div className="bg-stone-50/80 rounded-xl p-4 border border-stone-200/80 space-y-3">
              <label className="block text-xs font-black uppercase tracking-wider text-stone-700">
                2. Modo de Operación
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-mp-mode-test"
                  onClick={() => handleRequestModeChange('TEST')}
                  className={`p-3 rounded-lg border text-left font-bold text-xs transition-all cursor-pointer flex items-center space-x-2.5 ${
                    mode === 'TEST'
                      ? 'bg-amber-50/90 border-amber-400 shadow-xs text-amber-950 ring-2 ring-amber-400/20'
                      : 'bg-stone-100/70 border-stone-200 text-stone-500 hover:bg-stone-200/50'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    mode === 'TEST' ? 'border-amber-600 bg-amber-600' : 'border-stone-300'
                  }`}>
                    {mode === 'TEST' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <div>
                    <span className="block text-xs font-bold text-amber-900">Prueba / Demo</span>
                    <span className="text-[10px] text-amber-700 font-normal">Sandbox Developer</span>
                  </div>
                </button>

                <button
                  type="button"
                  id="btn-mp-mode-prod"
                  onClick={() => handleRequestModeChange('PRODUCTION')}
                  className={`p-3 rounded-lg border text-left font-bold text-xs transition-all cursor-pointer flex items-center space-x-2.5 ${
                    mode === 'PRODUCTION'
                      ? 'bg-emerald-50/90 border-emerald-500 shadow-xs text-emerald-950 ring-2 ring-emerald-500/20'
                      : 'bg-stone-100/70 border-stone-200 text-stone-500 hover:bg-stone-200/50'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    mode === 'PRODUCTION' ? 'border-emerald-600 bg-emerald-600' : 'border-stone-300'
                  }`}>
                    {mode === 'PRODUCTION' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <div>
                    <span className="block text-xs font-bold text-emerald-950">Producción</span>
                    <span className="text-[10px] text-emerald-700 font-normal">Cobros reales en caja</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: MODE-SPECIFIC CONFIGURATION & CREDENTIALS */}
          {mode === 'TEST' ? (
            /* MODO PRUEBA / DEMO */
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-950">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-amber-900">
                    Modo Prueba (Sandbox Developer) Activo
                  </p>
                  <p className="text-amber-800">
                    En este modo se utiliza automáticamente la configuración de prueba oficial validada para uwi. Las ventas no realizan cobros reales a tarjetas de crédito bancarias ni debitan dinero real.
                  </p>
                </div>
              </div>

              {/* Non-sensitive Info Overview */}
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200/80 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-[#006AFF]" />
                  <span>Datos de la Caja y POS de Prueba</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-stone-200">
                    <span className="text-[10px] text-stone-400 font-bold block uppercase">Usuario Mercado Pago</span>
                    <span className="font-mono font-bold text-stone-900 text-sm">
                      {serverConfig?.testConfig.userId || '3634603825'}
                    </span>
                    <span className="text-[10px] text-emerald-700 block mt-0.5">✓ Cuenta Sandbox Developer</span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-stone-200">
                    <span className="text-[10px] text-stone-400 font-bold block uppercase">Sucursal (Store)</span>
                    <span className="font-mono font-bold text-stone-900 text-sm">
                      {serverConfig?.testConfig.externalStoreId || 'MINIMARKET-POC-SUC-01'}
                    </span>
                    <span className="text-[10px] text-stone-500 block mt-0.5">
                      Store ID: <strong className="font-mono">{serverConfig?.testConfig.storeId || '86501276'}</strong>
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-stone-200">
                    <span className="text-[10px] text-stone-400 font-bold block uppercase">Caja (POS)</span>
                    <span className="font-mono font-bold text-stone-900 text-sm">
                      {serverConfig?.testConfig.externalPosId || 'MINIMARKETPOCCAJA01'}
                    </span>
                    <span className="text-[10px] text-stone-500 block mt-0.5">
                      POS ID: <strong className="font-mono">{serverConfig?.testConfig.posId || '137101354'}</strong>
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-stone-200">
                    <span className="text-[10px] text-stone-400 font-bold block uppercase">País / Moneda</span>
                    <span className="font-bold text-stone-900">
                      Argentina (MLA · ARS)
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-stone-200">
                    <span className="text-[10px] text-stone-400 font-bold block uppercase">Access Token Servidor</span>
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      <span>{serverConfig?.testConfig.hasAccessToken ? '✓ Configurado en servidor' : 'Fallback .env'}</span>
                    </span>
                    <span className="text-[10px] text-stone-400 block mt-0.5">Protegido (Nunca expuesto al cliente)</span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-stone-200">
                    <span className="text-[10px] text-stone-400 font-bold block uppercase">Última Verificación</span>
                    <span className="font-bold text-stone-800">
                      {serverConfig?.lastVerification ? new Date(serverConfig.lastVerification).toLocaleString('es-AR') : 'Pendiente'}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-stone-200">
                    <span className="text-[10px] text-stone-400 font-bold block uppercase">Terminal Point Smart (Prueba)</span>
                    <span className="font-mono font-bold text-stone-900 text-sm">
                      {serverConfig?.testConfig.pointTerminalId || 'SMARTPOS-POC-01'}
                    </span>
                    <span className="text-[10px] text-indigo-700 block mt-0.5">
                      Modelo: <strong>{serverConfig?.testConfig.pointModel === 'POINT_SMART_2' ? 'Point Smart 2' : 'Point Smart 1'}</strong> (Orders API)
                    </span>
                  </div>
                </div>
              </div>

              {/* QR DE DEMOSTRACIÓN SECTION */}
              <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/40 rounded-xl p-4 sm:p-5 border border-blue-200 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <QrCode className="w-5 h-5 text-[#006AFF]" />
                      <h4 className="text-sm font-black text-blue-950 uppercase tracking-tight">
                        QR de Demostración (POS Sandbox)
                      </h4>
                    </div>
                    <p className="text-xs text-blue-900/80">
                      Código QR oficial asignado a la caja de prueba <strong className="font-mono text-blue-950">MINIMARKETPOCCAJA01</strong> (POS ID: 137101354).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-show-demo-qr"
                      onClick={() => setShowQrModal(true)}
                      className="px-3 py-1.5 bg-[#006AFF] hover:bg-[#0052CC] text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Mostrar QR</span>
                    </button>

                    <button
                      type="button"
                      id="btn-print-demo-qr"
                      onClick={() => {
                        setShowQrModal(true);
                        setTimeout(() => handlePrintQr(), 300);
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 rounded-lg text-xs font-bold border border-stone-200 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-stone-600" />
                      <span>Imprimir QR</span>
                    </button>
                  </div>
                </div>

                {/* Inline Mini Preview */}
                <div className="bg-white rounded-lg p-3 border border-blue-200/60 flex items-center gap-4">
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="QR Demo Mercado Pago"
                      className="w-16 h-16 rounded border border-stone-200 shrink-0"
                    />
                  )}
                  <div className="text-xs space-y-0.5 text-stone-700">
                    <p className="font-bold text-stone-900">
                      Punto de cobro QR listo para escanear con Buyer Test User
                    </p>
                    <p className="text-[11px] text-stone-500">
                      Al cobrar desde la caja POS seleccionando Mercado Pago, la orden se envía a este QR dinámico y se auto-valida en tiempo real vía Webhook.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* MODO PRODUCCIÓN */
            <div className="space-y-4">
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-950">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-emerald-900">
                    Configuración de Mercado Pago en Producción
                  </p>
                  <p className="text-emerald-800">
                    Complete las credenciales oficiales de su comercio. El Access Token permanece estrictamente seguro en el servidor y nunca se expone al navegador ni en logs.
                  </p>
                </div>
              </div>

              {/* Form Fields for Production */}
              <div className="bg-stone-50 rounded-xl p-4 sm:p-5 border border-stone-200 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <span>Credenciales y Parámetros de Producción</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Access Token */}
                  <div className="md:col-span-2 space-y-1">
                    <label className="block font-bold text-stone-800 flex justify-between">
                      <span>Access Token de Producción (APP_USR-...)</span>
                      <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        {serverConfig?.productionConfig.hasAccessToken
                          ? '✓ Token actualmente guardado en servidor'
                          : 'Requerido para cobrar en producción'}
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type={showProdToken ? 'text' : 'password'}
                        value={prodToken}
                        onChange={(e) => setProdToken(e.target.value)}
                        placeholder={
                          serverConfig?.productionConfig.hasAccessToken
                            ? '•••••••••••••••••••••••••••••••••••••••• (Ingrese nuevo token para cambiar)'
                            : 'APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
                        }
                        id="input-prod-access-token"
                        className="w-full pl-3 pr-10 py-2 bg-white border border-stone-300 rounded-lg font-mono font-bold text-xs text-stone-900 focus:ring-2 focus:ring-[#006AFF] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowProdToken(!showProdToken)}
                        className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-700 cursor-pointer"
                      >
                        {showProdToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-stone-500">
                      Obténgalo en Panel de Desarrolladores de Mercado Pago → Tus Integraciones → Credenciales de Producción.
                    </p>
                  </div>

                  {/* User ID */}
                  <div className="space-y-1">
                    <label className="block font-bold text-stone-800">
                      User ID (Identificador de Cuenta Mercado Pago)
                    </label>
                    <input
                      type="text"
                      value={prodUserId}
                      onChange={(e) => setProdUserId(e.target.value)}
                      placeholder="Ej: 1234567890"
                      id="input-prod-user-id"
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg font-mono font-bold text-xs text-stone-900 focus:ring-2 focus:ring-[#006AFF] focus:outline-none"
                    />
                  </div>

                  {/* Site ID */}
                  <div className="space-y-1">
                    <label className="block font-bold text-stone-800">
                      Site ID
                    </label>
                    <input
                      type="text"
                      value={prodSiteId}
                      onChange={(e) => setProdSiteId(e.target.value)}
                      placeholder="MLA"
                      id="input-prod-site-id"
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg font-mono font-bold text-xs text-stone-900 focus:ring-2 focus:ring-[#006AFF] focus:outline-none"
                    />
                  </div>

                  {/* External Store ID */}
                  <div className="space-y-1">
                    <label className="block font-bold text-stone-800">
                      External Store ID (Identificador de Sucursal)
                    </label>
                    <input
                      type="text"
                      value={prodExtStoreId}
                      onChange={(e) => setProdExtStoreId(e.target.value)}
                      placeholder="Ej: SUCURSAL-CENTRO"
                      id="input-prod-ext-store-id"
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg font-mono font-bold text-xs text-stone-900 focus:ring-2 focus:ring-[#006AFF] focus:outline-none"
                    />
                  </div>

                  {/* Store ID */}
                  <div className="space-y-1">
                    <label className="block font-bold text-stone-800">
                      Store ID (ID Numérico de Sucursal)
                    </label>
                    <input
                      type="text"
                      value={prodStoreId}
                      onChange={(e) => setProdStoreId(e.target.value)}
                      placeholder="Ej: 87654321"
                      id="input-prod-store-id"
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg font-mono font-bold text-xs text-stone-900 focus:ring-2 focus:ring-[#006AFF] focus:outline-none"
                    />
                  </div>

                  {/* External POS ID */}
                  <div className="space-y-1">
                    <label className="block font-bold text-stone-800">
                      External POS ID (Identificador de Caja)
                    </label>
                    <input
                      type="text"
                      value={prodExtPosId}
                      onChange={(e) => setProdExtPosId(e.target.value)}
                      placeholder="Ej: CAJA-01"
                      id="input-prod-ext-pos-id"
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg font-mono font-bold text-xs text-stone-900 focus:ring-2 focus:ring-[#006AFF] focus:outline-none"
                    />
                  </div>

                  {/* POS ID */}
                  <div className="space-y-1">
                    <label className="block font-bold text-stone-800">
                      POS ID (ID Numérico de Punto de Venta)
                    </label>
                    <input
                      type="text"
                      value={prodPosId}
                      onChange={(e) => setProdPosId(e.target.value)}
                      placeholder="Ej: 14235678"
                      id="input-prod-pos-id"
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg font-mono font-bold text-xs text-stone-900 focus:ring-2 focus:ring-[#006AFF] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Subsección: Terminal Física Point Smart (Point Smart 1 / 2) */}
                <div className="pt-4 border-t border-stone-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      <span>Terminal Física Mercado Pago Point Smart (Opcional)</span>
                    </h5>
                    <span className="text-[10px] text-stone-400 font-mono">Orders API (type: point)</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Point Terminal ID */}
                    <div className="space-y-1">
                      <label className="block font-bold text-stone-800">
                        ID de Terminal Point (Device ID)
                      </label>
                      <input
                        type="text"
                        value={prodPointTerminalId}
                        onChange={(e) => setProdPointTerminalId(e.target.value)}
                        placeholder="Ej: SMARTPOS-987654321"
                        id="input-prod-point-terminal-id"
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg font-mono font-bold text-xs text-stone-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                      <p className="text-[10px] text-stone-500">
                        Identificador de la terminal física Point asignada a esta caja.
                      </p>
                    </div>

                    {/* Point Model */}
                    <div className="space-y-1">
                      <label className="block font-bold text-stone-800">
                        Modelo de Terminal Point
                      </label>
                      <select
                        value={prodPointModel}
                        onChange={(e) => setProdPointModel(e.target.value as 'POINT_SMART_1' | 'POINT_SMART_2')}
                        id="select-prod-point-model"
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg font-bold text-xs text-stone-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="POINT_SMART_1">Mercado Pago Point Smart 1 (PAX A910)</option>
                        <option value="POINT_SMART_2">Mercado Pago Point Smart 2 (Sunmi P2 Pro / V2s)</option>
                      </select>
                      <p className="text-[10px] text-stone-500">
                        Emite órdenes oficiales configuradas con <code>no_ticket</code> para gestión fiscal centralizada en uwi.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: ADVANCED PREFERENCES (Auto Confirm) */}
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-stone-700 flex items-center justify-between">
              <span>Opciones de Confirmación de Venta</span>
              <span className="text-[10px] text-stone-400 font-mono">MERCADOPAGO_AUTO_CONFIRM</span>
            </h4>

            <div className="flex items-start space-x-3 text-xs">
              <input
                type="checkbox"
                id="checkbox-auto-confirm"
                checked={autoConfirm}
                onChange={(e) => setAutoConfirm(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-[#006AFF] focus:ring-[#006AFF]"
              />
              <label htmlFor="checkbox-auto-confirm" className="space-y-0.5 cursor-pointer">
                <span className="font-bold text-stone-900 block">
                  Confirmación Automática de Venta (Auto-Confirm)
                </span>
                <span className="text-stone-500 block text-[11px]">
                  Si está activado, cuando el Webhook valide el pago aprobado, la venta en POS se asienta automáticamente sin requerir click manual del cajero.
                </span>
              </label>
            </div>
          </div>

          {/* Section 4: ACTION BUTTONS */}
          <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-stone-500 font-medium">
              {serverConfig?.updatedAt && (
                <span>
                  Última actualización: <strong className="text-stone-700">{new Date(serverConfig.updatedAt).toLocaleString('es-AR')}</strong> por <strong className="text-stone-700">{serverConfig.updatedBy || 'Administrador'}</strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                id="btn-verify-mp-connection"
                onClick={handleVerifyConnection}
                disabled={verifying || saving}
                className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-stone-50 text-stone-800 rounded-lg text-xs font-bold border border-stone-300 transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {verifying ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#006AFF]" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>{verifying ? 'Verificando...' : 'Verificar conexión'}</span>
              </button>

              <button
                type="button"
                id="btn-save-mp-config"
                onClick={handleSaveConfig}
                disabled={saving || verifying}
                className="w-full sm:w-auto px-5 py-2 bg-[#006AFF] hover:bg-[#0052CC] text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-white" />
                )}
                <span>{saving ? 'Guardando...' : 'Guardar configuración'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 5: RECENT AUDIT LOGS */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs p-4 sm:p-5 space-y-3">
        <h4 className="text-xs font-black uppercase tracking-wider text-stone-700 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <History className="w-4 h-4 text-stone-500" />
            <span>Auditoría de Cambios Administrativos</span>
          </div>
          <span className="text-[10px] text-stone-400">Seguridad & Trazabilidad</span>
        </h4>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-stone-400 italic">No hay registros de auditoría recientes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase text-[10px]">
                  <th className="py-2">Fecha y Hora</th>
                  <th className="py-2">Evento / Acción</th>
                  <th className="py-2">Usuario</th>
                  <th className="py-2">Resultado</th>
                  <th className="py-2">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-mono text-[11px]">
                {auditLogs.slice(0, 5).map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50/50">
                    <td className="py-2 text-stone-600 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('es-AR')}
                    </td>
                    <td className="py-2 font-bold text-stone-800">{log.action || 'EVENT'}</td>
                    <td className="py-2 text-stone-700">{log.userId || 'Sistema'}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.result === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.result === 'DISABLED'
                          ? 'bg-stone-100 text-stone-700'
                          : 'bg-amber-100 text-amber-900'
                      }`}>
                        {log.result}
                      </span>
                    </td>
                    <td className="py-2 text-stone-500 truncate max-w-xs font-sans text-xs">
                      {log.errorDetails || log.minimarketNewState || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* CONFIRMATION MODAL: MODE SWITCH */}
      {pendingModeSwitch && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-stone-900">
                {pendingModeSwitch === 'PRODUCTION'
                  ? '¿Cambiar a Modo Producción?'
                  : '¿Cambiar a Modo Prueba / Demo?'}
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                {pendingModeSwitch === 'PRODUCTION'
                  ? 'Estás cambiando Mercado Pago a PRODUCCIÓN. Las próximas operaciones utilizarán credenciales y configuración de producción para procesar cobros reales.'
                  : 'Las próximas operaciones utilizarán Mercado Pago en modo prueba (Sandbox). No se procesarán cobros reales a tarjetas ni cuentas bancarias.'}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={cancelModeSwitch}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-mode-switch"
                onClick={confirmModeSwitch}
                className={`flex-1 py-2.5 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs ${
                  pendingModeSwitch === 'PRODUCTION'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {pendingModeSwitch === 'PRODUCTION' ? 'Cambiar a Producción' : 'Cambiar a Modo Prueba'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR MODAL: DISPLAY & PRINT TEST POS QR */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 space-y-5 text-center">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="text-left">
                <span className="text-[10px] font-black uppercase text-[#006AFF] tracking-wider block">
                  Mercado Pago · Sandbox POS
                </span>
                <h3 className="text-sm font-black text-stone-900">
                  QR Oficial de Demostración
                </h3>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable QR Card */}
            <div id="printable-qr-card" className="bg-white p-4 rounded-xl border border-stone-200 space-y-3">
              <div className="bg-stone-900 text-white py-1.5 px-3 rounded-lg text-xs font-black tracking-tight flex items-center justify-center gap-1.5">
                <Store className="w-4 h-4 text-[#006AFF]" />
                <span>{business?.name || 'MINIMARKET'}</span>
              </div>

              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Oficial Mercado Pago"
                  className="w-56 h-56 mx-auto rounded-lg border border-stone-200"
                />
              ) : (
                <div className="w-56 h-56 mx-auto bg-stone-100 rounded-lg flex items-center justify-center text-xs text-stone-400">
                  Generando QR...
                </div>
              )}

              <div className="space-y-1 text-xs text-stone-700">
                <p className="font-bold">Escanear con App Mercado Pago (Buyer Test User)</p>
                <div className="bg-stone-50 p-2 rounded border border-stone-100 font-mono text-[10px] text-stone-600 space-y-0.5">
                  <p>Caja: <strong>{serverConfig?.testConfig.externalPosId || 'MINIMARKETPOCCAJA01'}</strong></p>
                  <p>POS ID: <strong>{serverConfig?.testConfig.posId || '137101354'}</strong></p>
                  <p>Sucursal: <strong>{serverConfig?.testConfig.externalStoreId || 'MINIMARKET-POC-SUC-01'}</strong></p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl font-bold text-xs cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handlePrintQr}
                className="flex-1 py-2 bg-[#006AFF] hover:bg-[#0052CC] text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Cartel</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
