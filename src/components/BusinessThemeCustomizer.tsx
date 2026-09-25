import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { useTheme } from '../lib/themeContext';
import { ThemeModel, INITIAL_PRESET_THEMES } from '../types/theme';
import { getTokensCssProperties } from '../lib/themeService';
import { 
  Palette, 
  Check, 
  Sparkles, 
  Eye, 
  Store, 
  TrendingUp, 
  Package, 
  ShoppingCart, 
  CheckCircle2, 
  Loader2, 
  ArrowRight,
  ShieldCheck,
  Layers,
  X,
  CreditCard,
  Building2,
  Calendar,
  DollarSign
} from 'lucide-react';

export const BusinessThemeCustomizer: React.FC = () => {
  const { business, userProfile } = useAuth();
  const { activeTheme, applyBusinessThemeById } = useTheme();
  
  const [selectedPreviewTheme, setSelectedPreviewTheme] = useState<ThemeModel | null>(null);
  const [applyingThemeId, setApplyingThemeId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [filterCategory, setFilterCategory] = useState<'all' | 'core' | 'experimental'>('all');

  const currentThemeId = business?.visualTheme?.themeId || business?.themeId || activeTheme.id || 'uwi-soft';

  const handleApplyTheme = async (theme: ThemeModel) => {
    if (!business?.id || !userProfile) return;
    try {
      setApplyingThemeId(theme.id);
      setFeedback(null);

      await applyBusinessThemeById(business.id, theme.id, {
        uid: userProfile.uid,
        email: userProfile.email,
        role: userProfile.role
      });

      // Update in-memory business reference
      if (business) {
        business.visualTheme = {
          themeId: theme.id,
          updatedAt: new Date().toISOString(),
          updatedBy: userProfile.email
        };
        business.themeId = theme.id;
      }

      setFeedback({
        type: 'success',
        message: `¡El tema "${theme.name}" se aplicó correctamente a tu negocio!`
      });
      setSelectedPreviewTheme(null);
    } catch (err: any) {
      console.error('Error applying business theme:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Error al aplicar el tema. Por favor intenta nuevamente.'
      });
    } finally {
      setApplyingThemeId(null);
    }
  };

  const filteredThemes = INITIAL_PRESET_THEMES.filter((t) => {
    if (filterCategory === 'core') return t.category === 'core';
    if (filterCategory === 'experimental') return t.category === 'experimental';
    return true;
  });

  return (
    <div className="space-y-6" id="business-theme-customizer">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold shadow-xs shrink-0">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-stone-900 tracking-tight">
                Personalización
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                {business?.name || 'Mi Negocio'}
              </span>
            </div>
            <p className="text-stone-500 text-xs mt-0.5">
              Personalizá la apariencia de tu negocio. Elegí el estilo visual que mejor se adapte a tu marca.
            </p>
          </div>
        </div>

        {/* Current Active Theme Pill */}
        <div className="flex items-center gap-2 px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl self-start md:self-auto">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Tema actual:
          </span>
          <span className="text-xs font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-lg border border-emerald-200">
            {INITIAL_PRESET_THEMES.find((t) => t.id === currentThemeId)?.name || 'UWI Clean'}
          </span>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div 
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium animate-in fade-in duration-200 ${
            feedback.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <X className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setFeedback(null)} 
            className="text-stone-400 hover:text-stone-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl">
          <button
            type="button"
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterCategory === 'all'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Todos ({INITIAL_PRESET_THEMES.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('core')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterCategory === 'core'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Estilos Clásicos (5)
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('experimental')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              filterCategory === 'experimental'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            Nuevos Estilos (6)
          </button>
        </div>

        <p className="text-xs text-stone-400 font-medium">
          Los cambios se guardan y aplican inmediatamente a este comercio.
        </p>
      </div>

      {/* Themes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredThemes.map((theme) => {
          const isCurrentActive = theme.id === currentThemeId;
          const isApplying = applyingThemeId === theme.id;
          const scopedStyles = getTokensCssProperties(theme.tokens);

          return (
            <div
              key={theme.id}
              className={`rounded-2xl border transition-all duration-200 flex flex-col overflow-hidden bg-white shadow-xs ${
                isCurrentActive
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'border-stone-200 hover:border-stone-300 hover:shadow-md'
              }`}
            >
              {/* Card Header */}
              <div className="p-4 border-b border-stone-100 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black text-stone-900 tracking-tight">
                      {theme.name}
                    </h2>
                    {theme.category === 'experimental' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                        Nuevo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">
                    {theme.subtitle || theme.description}
                  </p>
                </div>

                {isCurrentActive && (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
                    <Check className="w-3 h-3" />
                    Tema actual
                  </span>
                )}
              </div>

              {/* Real Mini Storefront UI Preview */}
              <div 
                className="p-3.5 border-b select-none transition-all flex-1"
                style={{
                  ...scopedStyles,
                  backgroundColor: 'var(--mm-color-bg)',
                  borderColor: 'var(--mm-color-border)'
                }}
              >
                <div 
                  className="rounded-xl border p-3 space-y-2.5 shadow-xs transition-all"
                  style={{
                    backgroundColor: 'var(--mm-color-surface)',
                    borderColor: 'var(--mm-color-border)',
                    color: 'var(--mm-color-text)'
                  }}
                >
                  {/* Mini Header */}
                  <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--mm-color-border-subtle)' }}>
                    <div className="flex items-center gap-1.5">
                      <div 
                        className="w-5 h-5 rounded flex items-center justify-center font-bold text-[10px]"
                        style={{
                          backgroundColor: 'var(--mm-color-primary)',
                          color: 'var(--mm-color-primary-text)'
                        }}
                      >
                        <Store className="w-3 h-3" />
                      </div>
                      <span className="text-xs font-black truncate max-w-[140px]" style={{ color: 'var(--mm-color-text)' }}>
                        {business?.name || 'Mi Negocio'}
                      </span>
                    </div>

                    <span 
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                      style={{
                        backgroundColor: 'var(--mm-color-success-bg)',
                        color: 'var(--mm-color-success-text)',
                        border: '1px solid var(--mm-color-success-border)'
                      }}
                    >
                      En Caja
                    </span>
                  </div>

                  {/* Mini Metric Blocks tailored to theme personality */}
                  {theme.layoutStyle === 'editorial' ? (
                    <div className="py-1">
                      <div className="text-[9px] uppercase tracking-wider font-bold" style={{ color: 'var(--mm-color-text-muted)' }}>
                        Ventas del Día
                      </div>
                      <div className="text-2xl font-black font-serif tracking-tight" style={{ color: 'var(--mm-color-primary)' }}>
                        $142.500
                      </div>
                      <div className="text-[10px] text-stone-500 font-medium border-t pt-1 mt-1" style={{ borderColor: 'var(--mm-color-border-subtle)' }}>
                        28 transacciones registradas hoy
                      </div>
                    </div>
                  ) : theme.layoutStyle === 'swiss' ? (
                    <div className="space-y-1 py-1">
                      <div className="text-[9px] uppercase font-black tracking-wider" style={{ color: 'var(--mm-color-text)' }}>
                        BALANCE // HOY
                      </div>
                      <div className="text-xl font-black border-y py-0.5" style={{ borderColor: 'var(--mm-color-text)' }}>
                        $142.500
                      </div>
                      <div className="text-[9px] font-mono" style={{ color: 'var(--mm-color-text-muted)' }}>
                        STOCK: 124 ARTÍCULOS
                      </div>
                    </div>
                  ) : theme.layoutStyle === 'terminal' ? (
                    <div className="p-2 rounded bg-black/40 border font-mono space-y-1" style={{ borderColor: 'var(--mm-color-border-strong)' }}>
                      <div className="flex justify-between text-[10px]">
                        <span style={{ color: 'var(--mm-color-text-muted)' }}>REV_TODAY:</span>
                        <span style={{ color: 'var(--mm-color-success)' }}>$142,500.00</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span style={{ color: 'var(--mm-color-text-muted)' }}>STATUS:</span>
                        <span style={{ color: 'var(--mm-color-info)' }}>[ONLINE]</span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div 
                        className="p-2 rounded-lg border"
                        style={{
                          backgroundColor: 'var(--mm-color-surface-subtle)',
                          borderColor: 'var(--mm-color-border-subtle)'
                        }}
                      >
                        <div className="text-[10px] font-semibold" style={{ color: 'var(--mm-color-text-muted)' }}>
                          Ventas Hoy
                        </div>
                        <div className="text-sm font-black mt-0.5" style={{ color: 'var(--mm-color-primary)' }}>
                          $142.500
                        </div>
                      </div>

                      <div 
                        className="p-2 rounded-lg border"
                        style={{
                          backgroundColor: 'var(--mm-color-surface-subtle)',
                          borderColor: 'var(--mm-color-border-subtle)'
                        }}
                      >
                        <div className="text-[10px] font-semibold" style={{ color: 'var(--mm-color-text-muted)' }}>
                          Productos
                        </div>
                        <div className="text-sm font-black mt-0.5" style={{ color: 'var(--mm-color-text)' }}>
                          124 activos
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sample Product Row */}
                  <div 
                    className="p-2 rounded border flex items-center justify-between text-[11px]"
                    style={{
                      backgroundColor: 'var(--mm-color-surface-subtle)',
                      borderColor: 'var(--mm-color-border-subtle)'
                    }}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <Package className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--mm-color-primary)' }} />
                      <span className="font-bold truncate" style={{ color: 'var(--mm-color-text)' }}>
                        Coca Cola 500ml
                      </span>
                    </div>
                    <span className="font-black shrink-0" style={{ color: 'var(--mm-color-text)' }}>
                      $1.500
                    </span>
                  </div>

                  {/* Sample Button */}
                  <div 
                    className="w-full py-1.5 px-3 rounded text-center text-xs font-bold shadow-xs transition-all"
                    style={{
                      backgroundColor: 'var(--mm-color-primary)',
                      color: 'var(--mm-color-primary-text)'
                    }}
                  >
                    Cobrar $1.500
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPreviewTheme(theme)}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-stone-100 text-stone-700 font-bold text-xs border border-stone-200 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-stone-500" />
                  <span>Ver muestra</span>
                </button>

                <button
                  type="button"
                  disabled={isCurrentActive || isApplying}
                  onClick={() => handleApplyTheme(theme)}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    isCurrentActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 opacity-80 cursor-default'
                      : isApplying
                      ? 'bg-stone-800 text-white cursor-wait'
                      : 'bg-stone-900 hover:bg-stone-800 active:scale-95 text-white'
                  }`}
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Aplicando...</span>
                    </>
                  ) : isCurrentActive ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Activo</span>
                    </>
                  ) : (
                    <>
                      <span>Aplicar tema</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Preview Modal for Business */}
      {selectedPreviewTheme && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div 
            className="w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden my-auto transition-all"
            style={{
              ...getTokensCssProperties(selectedPreviewTheme.tokens),
              backgroundColor: 'var(--mm-color-bg)',
              borderColor: 'var(--mm-color-border-strong)',
              color: 'var(--mm-color-text)'
            }}
          >
            {/* Modal Header */}
            <div 
              className="px-6 py-4 border-b flex items-center justify-between gap-4"
              style={{
                backgroundColor: 'var(--mm-color-surface)',
                borderColor: 'var(--mm-color-border)'
              }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold"
                  style={{
                    backgroundColor: 'var(--mm-color-primary-subtle)',
                    color: 'var(--mm-color-primary)'
                  }}
                >
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span 
                      className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
                      style={{
                        backgroundColor: 'var(--mm-color-primary)',
                        color: 'var(--mm-color-primary-text)'
                      }}
                    >
                      Vista Previa
                    </span>
                    <h2 className="text-base font-black" style={{ color: 'var(--mm-color-text)' }}>
                      {selectedPreviewTheme.name}
                    </h2>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--mm-color-text-muted)' }}>
                    Comprobá cómo se verán tus ventas, productos y operaciones con este estilo.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPreviewTheme(null)}
                className="p-2 rounded-lg hover:bg-black/10 transition-colors cursor-pointer"
                style={{ color: 'var(--mm-color-text)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Realistic POS & Commerce Simulation */}
            <div className="p-6 space-y-6">
              {/* Top Commerce Bar */}
              <div 
                className="p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 shadow-xs"
                style={{
                  backgroundColor: 'var(--mm-color-surface)',
                  borderColor: 'var(--mm-color-border)'
                }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
                    style={{
                      backgroundColor: 'var(--mm-color-primary)',
                      color: 'var(--mm-color-primary-text)'
                    }}
                  >
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm" style={{ color: 'var(--mm-color-text)' }}>
                      {business?.name || 'Mi Negocio'}
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--mm-color-text-muted)' }}>
                      Terminal POS #1 • Turno Mañana
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span 
                    className="px-2.5 py-1 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: 'var(--mm-color-success-bg)',
                      color: 'var(--mm-color-success-text)',
                      border: '1px solid var(--mm-color-success-border)'
                    }}
                  >
                    Caja Abierta
                  </span>
                </div>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div 
                  className="p-4 rounded-xl border shadow-xs"
                  style={{
                    backgroundColor: 'var(--mm-color-surface)',
                    borderColor: 'var(--mm-color-border)'
                  }}
                >
                  <div className="text-xs font-bold" style={{ color: 'var(--mm-color-text-muted)' }}>
                    Total Cobrado Hoy
                  </div>
                  <div className="text-2xl font-black mt-1" style={{ color: 'var(--mm-color-primary)' }}>
                    $142.500
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: 'var(--mm-color-text-secondary)' }}>
                    28 ventas realizadas
                  </div>
                </div>

                <div 
                  className="p-4 rounded-xl border shadow-xs"
                  style={{
                    backgroundColor: 'var(--mm-color-surface)',
                    borderColor: 'var(--mm-color-border)'
                  }}
                >
                  <div className="text-xs font-bold" style={{ color: 'var(--mm-color-text-muted)' }}>
                    Artículos en Catálogo
                  </div>
                  <div className="text-2xl font-black mt-1" style={{ color: 'var(--mm-color-text)' }}>
                    124
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--mm-color-success-text)' }}>
                    96% con stock normal
                  </div>
                </div>

                <div 
                  className="p-4 rounded-xl border shadow-xs"
                  style={{
                    backgroundColor: 'var(--mm-color-surface)',
                    borderColor: 'var(--mm-color-border)'
                  }}
                >
                  <div className="text-xs font-bold" style={{ color: 'var(--mm-color-text-muted)' }}>
                    Mercado Pago
                  </div>
                  <div className="text-2xl font-black mt-1" style={{ color: 'var(--mm-color-info-text)' }}>
                    $68.200
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--mm-color-text-secondary)' }}>
                    12 pagos QR aprobados
                  </div>
                </div>
              </div>

              {/* Simulated Cart / Ticket Table */}
              <div 
                className="rounded-xl border overflow-hidden shadow-xs"
                style={{
                  backgroundColor: 'var(--mm-color-surface)',
                  borderColor: 'var(--mm-color-border)'
                }}
              >
                <div 
                  className="px-4 py-3 border-b font-bold text-xs"
                  style={{
                    backgroundColor: 'var(--mm-color-surface-subtle)',
                    borderColor: 'var(--mm-color-border)',
                    color: 'var(--mm-color-text)'
                  }}
                >
                  Ticket de Venta en Curso
                </div>

                <div className="divide-y" style={{ borderColor: 'var(--mm-color-border-subtle)' }}>
                  <div className="p-3.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold" style={{ color: 'var(--mm-color-text)' }}>
                        Coca Cola Sabor Original 500ml
                      </span>
                      <p className="text-[11px]" style={{ color: 'var(--mm-color-text-muted)' }}>
                        2 x $1.500
                      </p>
                    </div>
                    <span className="font-black" style={{ color: 'var(--mm-color-text)' }}>
                      $3.000
                    </span>
                  </div>

                  <div className="p-3.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold" style={{ color: 'var(--mm-color-text)' }}>
                        Alfajor Havanna 70% Cacao
                      </span>
                      <p className="text-[11px]" style={{ color: 'var(--mm-color-text-muted)' }}>
                        1 x $1.800
                      </p>
                    </div>
                    <span className="font-black" style={{ color: 'var(--mm-color-text)' }}>
                      $1.800
                    </span>
                  </div>
                </div>

                {/* Total & Action Bar */}
                <div 
                  className="p-4 border-t flex items-center justify-between"
                  style={{
                    backgroundColor: 'var(--mm-color-surface-subtle)',
                    borderColor: 'var(--mm-color-border)'
                  }}
                >
                  <div>
                    <span className="text-xs font-bold" style={{ color: 'var(--mm-color-text-muted)' }}>Total Venta</span>
                    <div className="text-xl font-black" style={{ color: 'var(--mm-color-text)' }}>$4.800</div>
                  </div>

                  <button
                    type="button"
                    className="px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all"
                    style={{
                      backgroundColor: 'var(--mm-color-primary)',
                      color: 'var(--mm-color-primary-text)'
                    }}
                  >
                    Confirmar Cobro
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div 
              className="px-6 py-4 border-t flex items-center justify-between gap-3"
              style={{
                backgroundColor: 'var(--mm-color-surface)',
                borderColor: 'var(--mm-color-border)'
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedPreviewTheme(null)}
                className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer"
                style={{
                  backgroundColor: 'var(--mm-color-surface)',
                  borderColor: 'var(--mm-color-border)',
                  color: 'var(--mm-color-text)'
                }}
              >
                Cerrar vista previa
              </button>

              <button
                type="button"
                disabled={selectedPreviewTheme.id === currentThemeId || applyingThemeId === selectedPreviewTheme.id}
                onClick={() => handleApplyTheme(selectedPreviewTheme)}
                className="px-5 py-2.5 rounded-xl font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all"
                style={{
                  backgroundColor: 'var(--mm-color-primary)',
                  color: 'var(--mm-color-primary-text)'
                }}
              >
                {applyingThemeId === selectedPreviewTheme.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Aplicando tema...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Aplicar "{selectedPreviewTheme.name}" a mi negocio</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
