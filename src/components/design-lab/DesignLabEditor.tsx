import React, { useState, useEffect } from 'react';
import { ThemeModel, ThemeTokens, INITIAL_PRESET_THEMES } from '../../types/theme';
import { getTokensCssProperties } from '../../lib/themeService';
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Check, 
  Copy, 
  Sliders, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Palette, 
  Layers, 
  Type, 
  Maximize2, 
  Zap, 
  Smartphone, 
  Layout, 
  HelpCircle,
  RotateCcw,
  Edit2
} from 'lucide-react';
import { DesignLabMobilePreview } from './DesignLabMobilePreview';
import { DesignLabNavigation } from './DesignLabNavigation';
import { DesignLabDashboard } from './DesignLabDashboard';
import { DesignLabPOS } from './DesignLabPOS';
import { DesignLabProduct } from './DesignLabProduct';
import { DesignLabReceiving } from './DesignLabReceiving';
import { DesignLabRequest } from './DesignLabRequest';
import { DesignLabSuggestions } from './DesignLabSuggestions';
import { DesignLabStates } from './DesignLabStates';
import { DesignLabForms } from './DesignLabForms';
import { DesignLabButtons } from './DesignLabButtons';
import { DesignLabTables } from './DesignLabTables';
import { DesignLabModal } from './DesignLabModal';
import { DesignLabAlerts } from './DesignLabAlerts';
import { DesignLabMicrointeractions } from './DesignLabMicrointeractions';
import { DesignLabEvaluation } from './DesignLabEvaluation';
import { DesignVariant } from './types';

interface Props {
  initialTheme: ThemeModel;
  isActiveTheme: boolean;
  onBack: () => void;
  onSave: (theme: ThemeModel) => Promise<void>;
  onApply: (theme: ThemeModel) => Promise<void>;
  onDuplicate: (theme: ThemeModel) => Promise<void>;
  onOpenPreviewModal: (theme: ThemeModel) => void;
}

export const DesignLabEditor: React.FC<Props> = ({
  initialTheme,
  isActiveTheme,
  onBack,
  onSave,
  onApply,
  onDuplicate,
  onOpenPreviewModal
}) => {
  const [theme, setTheme] = useState<ThemeModel>(initialTheme);
  const [initialSavedState, setInitialSavedState] = useState<string>(JSON.stringify(initialTheme));
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(initialTheme.name);

  // Editor sub-tab for token categories
  const [tokenCategory, setTokenCategory] = useState<'colors' | 'geometry' | 'typography' | 'presets'>('colors');
  // Component showcase filter
  const [activeSectionFilter, setActiveSectionFilter] = useState<'all' | 'micro' | 'mobile' | 'components' | 'flows'>('all');
  const [reducedMotion, setReducedMotion] = useState(false);

  // Confirmation dialogs
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);

  // Detect unsaved changes
  useEffect(() => {
    const isDifferent = JSON.stringify(theme) !== initialSavedState;
    setHasUnsavedChanges(isDifferent);
  }, [theme, initialSavedState]);

  // Update token helper
  const updateToken = <K extends keyof ThemeTokens>(key: K, value: ThemeTokens[K]) => {
    setTheme((prev) => ({
      ...prev,
      tokens: {
        ...prev.tokens,
        [key]: value
      }
    }));
  };

  // Preset loader
  const handleLoadPreset = (presetTheme: ThemeModel) => {
    setTheme((prev) => ({
      ...prev,
      tokens: JSON.parse(JSON.stringify(presetTheme.tokens))
    }));
  };

  // Save handler
  const handleSaveClick = async () => {
    try {
      setSaving(true);
      await onSave(theme);
      setInitialSavedState(JSON.stringify(theme));
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Error saving theme:', err);
    } finally {
      setSaving(false);
    }
  };

  // Apply handler
  const handleApplyClick = () => {
    setShowApplyConfirm(true);
  };

  const handleConfirmApply = async () => {
    setShowApplyConfirm(false);
    try {
      setSaving(true);
      if (hasUnsavedChanges) {
        await onSave(theme);
        setInitialSavedState(JSON.stringify(theme));
        setHasUnsavedChanges(false);
      }
      await onApply(theme);
    } catch (err) {
      console.error('Error applying theme:', err);
    } finally {
      setSaving(false);
    }
  };

  // Back safety handler
  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      setShowExitConfirm(true);
    } else {
      onBack();
    }
  };

  const currentVariantForEvaluation: DesignVariant = 
    theme.id.includes('editorial') ? 'uwi-editorial' :
    theme.id.includes('bento') ? 'uwi-bento' :
    theme.id.includes('neo') ? 'uwi-neo' :
    theme.id.includes('swiss') ? 'uwi-swiss' :
    theme.id.includes('terminal') ? 'uwi-terminal' :
    theme.id.includes('aurora') ? 'uwi-aurora' :
    theme.id.includes('emerald') ? 'uwi-emerald' :
    theme.id.includes('graphite') ? 'uwi-graphite' :
    theme.id.includes('soft') ? 'uwi-soft' :
    theme.id.includes('command') || theme.id.includes('square') ? 'uwi-command' : 'uwi-clean';

  const scopedCssProperties = getTokensCssProperties(theme.tokens);

  return (
    <div 
      className="min-h-screen pb-20 space-y-6"
      id="design-lab-editor-view"
      style={scopedCssProperties as React.CSSProperties}
    >
      {/* 1. STICKY TOP EDITOR BAR */}
      <div className="sticky top-0 z-30 backdrop-blur-md bg-stone-900/95 text-white border-b border-stone-800 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-3 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Back button & Theme Title & Status Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleBackClick}
              id="btn-back-to-library"
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Biblioteca</span>
            </button>

            {/* Editable Title */}
            <div className="flex items-center gap-2">
              {isEditingTitle ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="px-2.5 py-1 text-sm font-black rounded-lg bg-stone-800 text-white border border-emerald-500 focus:outline-hidden"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (titleDraft.trim()) {
                        setTheme((prev) => ({ ...prev, name: titleDraft.trim() }));
                      }
                      setIsEditingTitle(false);
                    }}
                    className="p-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => {
                    setTitleDraft(theme.name);
                    setIsEditingTitle(true);
                  }}
                  className="flex items-center gap-2 cursor-pointer hover:bg-stone-800 px-2 py-1 rounded-lg transition-colors group"
                  title="Click para renombrar tema"
                >
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                    {theme.name}
                  </h2>
                  <Edit2 className="w-3.5 h-3.5 text-stone-400 group-hover:text-emerald-400" />
                </div>
              )}
            </div>

            {/* Status & Version Badges */}
            <div className="flex items-center gap-1.5">
              {isActiveTheme ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                  🟢 Activo
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700 text-[10px] font-black uppercase tracking-wider">
                  ⚪ Guardado
                </span>
              )}

              <span className="px-2 py-0.5 rounded-md bg-stone-800 text-stone-400 text-xs font-mono font-bold">
                v{theme.version}
              </span>

              {/* Unsaved changes pill indicator */}
              {hasUnsavedChanges ? (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black animate-pulse flex items-center gap-1">
                  <span>●</span>
                  <span>Cambios sin guardar</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-medium hidden lg:inline-flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Guardado</span>
                </span>
              )}
            </div>
          </div>

          {/* Right: Actions (Preview, Save, Apply, Duplicate) */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* 1. Vista Previa */}
            <button
              type="button"
              onClick={() => onOpenPreviewModal(theme)}
              id="btn-editor-preview"
              className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs border border-stone-700 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>Vista previa</span>
            </button>

            {/* 2. Guardar */}
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={saving}
              id="btn-editor-save"
              className={`px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
                hasUnsavedChanges 
                  ? 'bg-amber-500 hover:bg-amber-600 text-stone-950 font-black' 
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Guardando...' : hasUnsavedChanges ? 'Guardar cambios *' : 'Guardar'}</span>
            </button>

            {/* 3. Aplicar tema */}
            <button
              type="button"
              onClick={handleApplyClick}
              disabled={saving}
              id="btn-editor-apply"
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer hover:scale-[1.02]"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Aplicar tema</span>
            </button>

            {/* 4. Duplicar */}
            <button
              type="button"
              onClick={() => onDuplicate(theme)}
              id="btn-editor-duplicate"
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors cursor-pointer"
              title="Duplicar como nuevo tema"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* 2. TOKEN CUSTOMIZER TOOLBAR / ACCORDION */}
        <div 
          className="rounded-3xl border p-5 shadow-sm space-y-4 transition-colors"
          style={{
            backgroundColor: 'var(--mm-color-surface)',
            borderColor: 'var(--mm-color-border)'
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--mm-color-border-subtle)' }}>
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5" style={{ color: 'var(--mm-color-primary)' }} />
              <div>
                <h3 className="text-sm font-black tracking-tight" style={{ color: 'var(--mm-color-text)' }}>
                  Configuración de Tokens Visuales
                </h3>
                <p className="text-xs" style={{ color: 'var(--mm-color-text-muted)' }}>
                  Ajustá los valores en tiempo real; todos los componentes se actualizan instantáneamente abajo
                </p>
              </div>
            </div>

            {/* Category tabs */}
            <div 
              className="flex items-center gap-1 p-1 rounded-xl border"
              style={{
                backgroundColor: 'var(--mm-color-surface-subtle)',
                borderColor: 'var(--mm-color-border)'
              }}
            >
              <button
                type="button"
                onClick={() => setTokenCategory('colors')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  tokenCategory === 'colors' ? 'shadow-xs font-black' : 'opacity-70'
                }`}
                style={tokenCategory === 'colors' ? {
                  backgroundColor: 'var(--mm-color-primary)',
                  color: 'var(--mm-color-primary-text)'
                } : { color: 'var(--mm-color-text)' }}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Colores</span>
              </button>

              <button
                type="button"
                onClick={() => setTokenCategory('geometry')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  tokenCategory === 'geometry' ? 'shadow-xs font-black' : 'opacity-70'
                }`}
                style={tokenCategory === 'geometry' ? {
                  backgroundColor: 'var(--mm-color-primary)',
                  color: 'var(--mm-color-primary-text)'
                } : { color: 'var(--mm-color-text)' }}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Radios & Bordes</span>
              </button>

              <button
                type="button"
                onClick={() => setTokenCategory('typography')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  tokenCategory === 'typography' ? 'shadow-xs font-black' : 'opacity-70'
                }`}
                style={tokenCategory === 'typography' ? {
                  backgroundColor: 'var(--mm-color-primary)',
                  color: 'var(--mm-color-primary-text)'
                } : { color: 'var(--mm-color-text)' }}
              >
                <Type className="w-3.5 h-3.5" />
                <span>Espaciado & Botones</span>
              </button>

              <button
                type="button"
                onClick={() => setTokenCategory('presets')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  tokenCategory === 'presets' ? 'shadow-xs font-black' : 'opacity-70'
                }`}
                style={tokenCategory === 'presets' ? {
                  backgroundColor: 'var(--mm-color-primary)',
                  color: 'var(--mm-color-primary-text)'
                } : { color: 'var(--mm-color-text)' }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Cargar Presets</span>
              </button>
            </div>
          </div>

          {/* TAB: COLORES */}
          {tokenCategory === 'colors' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
              {/* Primary Color */}
              <div className="p-3 rounded-2xl border space-y-2" style={{ backgroundColor: 'var(--mm-color-surface-subtle)', borderColor: 'var(--mm-color-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold" style={{ color: 'var(--mm-color-text)' }}>Color Primario / Marca</span>
                  <span className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: theme.tokens.primary }} />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.tokens.primary.startsWith('#') ? theme.tokens.primary : '#008060'}
                    onChange={(e) => updateToken('primary', e.target.value)}
                    className="w-8 h-8 rounded-lg border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={theme.tokens.primary}
                    onChange={(e) => updateToken('primary', e.target.value)}
                    className="flex-1 px-2 py-1 font-mono text-xs border rounded-lg bg-white"
                  />
                </div>
              </div>

              {/* Background Color */}
              <div className="p-3 rounded-2xl border space-y-2" style={{ backgroundColor: 'var(--mm-color-surface-subtle)', borderColor: 'var(--mm-color-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold" style={{ color: 'var(--mm-color-text)' }}>Fondo General (Canvas)</span>
                  <span className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: theme.tokens.bg }} />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.tokens.bg.startsWith('#') ? theme.tokens.bg : '#F6F6F7'}
                    onChange={(e) => updateToken('bg', e.target.value)}
                    className="w-8 h-8 rounded-lg border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={theme.tokens.bg}
                    onChange={(e) => updateToken('bg', e.target.value)}
                    className="flex-1 px-2 py-1 font-mono text-xs border rounded-lg bg-white"
                  />
                </div>
              </div>

              {/* Surface Color */}
              <div className="p-3 rounded-2xl border space-y-2" style={{ backgroundColor: 'var(--mm-color-surface-subtle)', borderColor: 'var(--mm-color-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold" style={{ color: 'var(--mm-color-text)' }}>Superficie (Cards)</span>
                  <span className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: theme.tokens.surface }} />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.tokens.surface.startsWith('#') ? theme.tokens.surface : '#FFFFFF'}
                    onChange={(e) => updateToken('surface', e.target.value)}
                    className="w-8 h-8 rounded-lg border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={theme.tokens.surface}
                    onChange={(e) => updateToken('surface', e.target.value)}
                    className="flex-1 px-2 py-1 font-mono text-xs border rounded-lg bg-white"
                  />
                </div>
              </div>

              {/* Border Color */}
              <div className="p-3 rounded-2xl border space-y-2" style={{ backgroundColor: 'var(--mm-color-surface-subtle)', borderColor: 'var(--mm-color-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold" style={{ color: 'var(--mm-color-text)' }}>Borde de Contenedores</span>
                  <span className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: theme.tokens.border }} />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.tokens.border.startsWith('#') ? theme.tokens.border : '#E1E3E5'}
                    onChange={(e) => updateToken('border', e.target.value)}
                    className="w-8 h-8 rounded-lg border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={theme.tokens.border}
                    onChange={(e) => updateToken('border', e.target.value)}
                    className="flex-1 px-2 py-1 font-mono text-xs border rounded-lg bg-white"
                  />
                </div>
              </div>

              {/* Text Primary */}
              <div className="p-3 rounded-2xl border space-y-2" style={{ backgroundColor: 'var(--mm-color-surface-subtle)', borderColor: 'var(--mm-color-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold" style={{ color: 'var(--mm-color-text)' }}>Texto Principal</span>
                  <span className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: theme.tokens.text }} />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.tokens.text.startsWith('#') ? theme.tokens.text : '#202223'}
                    onChange={(e) => updateToken('text', e.target.value)}
                    className="w-8 h-8 rounded-lg border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={theme.tokens.text}
                    onChange={(e) => updateToken('text', e.target.value)}
                    className="flex-1 px-2 py-1 font-mono text-xs border rounded-lg bg-white"
                  />
                </div>
              </div>

              {/* Success Feedback */}
              <div className="p-3 rounded-2xl border space-y-2" style={{ backgroundColor: 'var(--mm-color-surface-subtle)', borderColor: 'var(--mm-color-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold" style={{ color: 'var(--mm-color-text)' }}>Feedback Éxito</span>
                  <span className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: theme.tokens.success }} />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.tokens.success.startsWith('#') ? theme.tokens.success : '#007A5C'}
                    onChange={(e) => updateToken('success', e.target.value)}
                    className="w-8 h-8 rounded-lg border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={theme.tokens.success}
                    onChange={(e) => updateToken('success', e.target.value)}
                    className="flex-1 px-2 py-1 font-mono text-xs border rounded-lg bg-white"
                  />
                </div>
              </div>

              {/* Warning Feedback */}
              <div className="p-3 rounded-2xl border space-y-2" style={{ backgroundColor: 'var(--mm-color-surface-subtle)', borderColor: 'var(--mm-color-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold" style={{ color: 'var(--mm-color-text)' }}>Feedback Advertencia</span>
                  <span className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: theme.tokens.warning }} />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.tokens.warning.startsWith('#') ? theme.tokens.warning : '#B98900'}
                    onChange={(e) => updateToken('warning', e.target.value)}
                    className="w-8 h-8 rounded-lg border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={theme.tokens.warning}
                    onChange={(e) => updateToken('warning', e.target.value)}
                    className="flex-1 px-2 py-1 font-mono text-xs border rounded-lg bg-white"
                  />
                </div>
              </div>

              {/* Danger Feedback */}
              <div className="p-3 rounded-2xl border space-y-2" style={{ backgroundColor: 'var(--mm-color-surface-subtle)', borderColor: 'var(--mm-color-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold" style={{ color: 'var(--mm-color-text)' }}>Feedback Error / Peligro</span>
                  <span className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: theme.tokens.danger }} />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.tokens.danger.startsWith('#') ? theme.tokens.danger : '#D72C0D'}
                    onChange={(e) => updateToken('danger', e.target.value)}
                    className="w-8 h-8 rounded-lg border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={theme.tokens.danger}
                    onChange={(e) => updateToken('danger', e.target.value)}
                    className="flex-1 px-2 py-1 font-mono text-xs border rounded-lg bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: GEOMETRIA & RADIOS */}
          {tokenCategory === 'geometry' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-2xl border space-y-2" style={{ backgroundColor: 'var(--mm-color-surface-subtle)', borderColor: 'var(--mm-color-border)' }}>
                <span className="font-bold block" style={{ color: 'var(--mm-color-text)' }}>Radio Pequeño (sm)</span>
                <div className="flex items-center gap-1.5">
                  {['2px', '4px', '6px', '8px'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => updateToken('radiusSm', r)}
                      className={`flex-1 py-1.5 font-mono text-xs rounded-lg border cursor-pointer ${
                        theme.tokens.radiusSm === r ? 'bg-stone-900 text-white font-bold' : 'bg-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-2xl border space-y-2" style={{ backgroundColor: 'var(--mm-color-surface-subtle)', borderColor: 'var(--mm-color-border)' }}>
                <span className="font-bold block" style={{ color: 'var(--mm-color-text)' }}>Radio Medio / Botones (md)</span>
                <div className="flex items-center gap-1.5">
                  {['4px', '6px', '10px', '14px'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => updateToken('radiusMd', r)}
                      className={`flex-1 py-1.5 font-mono text-xs rounded-lg border cursor-pointer ${
                        theme.tokens.radiusMd === r ? 'bg-stone-900 text-white font-bold' : 'bg-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-2xl border space-y-2" style={{ backgroundColor: 'var(--mm-color-surface-subtle)', borderColor: 'var(--mm-color-border)' }}>
                <span className="font-bold block" style={{ color: 'var(--mm-color-text)' }}>Radio Grande / Cards (lg)</span>
                <div className="flex items-center gap-1.5">
                  {['6px', '8px', '14px', '20px'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => updateToken('radiusLg', r)}
                      className={`flex-1 py-1.5 font-mono text-xs rounded-lg border cursor-pointer ${
                        theme.tokens.radiusLg === r ? 'bg-stone-900 text-white font-bold' : 'bg-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-2xl border space-y-2" style={{ backgroundColor: 'var(--mm-color-surface-subtle)', borderColor: 'var(--mm-color-border)' }}>
                <span className="font-bold block" style={{ color: 'var(--mm-color-text)' }}>Radio Extra Grande (xl)</span>
                <div className="flex items-center gap-1.5">
                  {['8px', '12px', '16px', '24px'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => updateToken('radiusXl', r)}
                      className={`flex-1 py-1.5 font-mono text-xs rounded-lg border cursor-pointer ${
                        theme.tokens.radiusXl === r ? 'bg-stone-900 text-white font-bold' : 'bg-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: ESPACIADO & BOTONES */}
          {tokenCategory === 'typography' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-2xl border space-y-2" style={{ backgroundColor: 'var(--mm-color-surface-subtle)', borderColor: 'var(--mm-color-border)' }}>
                <span className="font-bold block" style={{ color: 'var(--mm-color-text)' }}>Altura de Botón Principal</span>
                <div className="flex items-center gap-1.5">
                  {['34px', '40px', '44px', '48px'].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => updateToken('btnHeight', h)}
                      className={`flex-1 py-1.5 font-mono text-xs rounded-lg border cursor-pointer ${
                        theme.tokens.btnHeight === h ? 'bg-stone-900 text-white font-bold' : 'bg-white'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-2xl border space-y-2" style={{ backgroundColor: 'var(--mm-color-surface-subtle)', borderColor: 'var(--mm-color-border)' }}>
                <span className="font-bold block" style={{ color: 'var(--mm-color-text)' }}>Altura de Input</span>
                <div className="flex items-center gap-1.5">
                  {['32px', '38px', '42px', '46px'].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => updateToken('inputHeight', h)}
                      className={`flex-1 py-1.5 font-mono text-xs rounded-lg border cursor-pointer ${
                        theme.tokens.inputHeight === h ? 'bg-stone-900 text-white font-bold' : 'bg-white'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-2xl border space-y-2" style={{ backgroundColor: 'var(--mm-color-surface-subtle)', borderColor: 'var(--mm-color-border)' }}>
                <span className="font-bold block" style={{ color: 'var(--mm-color-text)' }}>Factor de Densidad / Spacing</span>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: 'Compacto (0.85x)', val: 0.85 },
                    { label: 'Normal (1.0x)', val: 1.0 },
                    { label: 'Espacioso (1.1x)', val: 1.1 }
                  ].map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() => updateToken('spacingFactor', s.val)}
                      className={`flex-1 py-1.5 text-[11px] rounded-lg border cursor-pointer ${
                        theme.tokens.spacingFactor === s.val ? 'bg-stone-900 text-white font-bold' : 'bg-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: PRESETS RAPIDOS */}
          {tokenCategory === 'presets' && (
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold" style={{ color: 'var(--mm-color-text-muted)' }}>
                Cargar tokens base de un preset predeterminado en el editor:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {INITIAL_PRESET_THEMES.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleLoadPreset(preset)}
                    className="p-3 rounded-2xl border bg-white hover:border-emerald-500 text-left transition-all cursor-pointer shadow-2xs space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-3.5 h-3.5 rounded-full border" style={{ backgroundColor: preset.tokens.primary }} />
                      <span className="text-[10px] font-mono text-stone-400">Preset</span>
                    </div>
                    <div>
                      <p className="font-black text-xs text-stone-900 group-hover:text-emerald-700">{preset.name}</p>
                      <p className="text-[10px] text-stone-500">{preset.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. COMPONENT SHOWCASE FILTER BAR */}
        <div className="sticky top-14 z-20 py-2.5 backdrop-blur-md bg-stone-100/90 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b border-stone-200/80 flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-black text-stone-500 uppercase tracking-wider mr-1 hidden sm:inline">
              Vistas:
            </span>
            <button
              type="button"
              onClick={() => setActiveSectionFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSectionFilter === 'all'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
              }`}
            >
              Todos los componentes (16)
            </button>
            <button
              type="button"
              onClick={() => setActiveSectionFilter('micro')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSectionFilter === 'micro'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>⚡ Microinteracciones</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSectionFilter('mobile')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSectionFilter === 'mobile'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>📱 Mobile Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSectionFilter('flows')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSectionFilter === 'flows'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>Flujos POS / Recepción / Pedidos</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSectionFilter('components')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSectionFilter === 'components'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>UI Tokens (Botones / Tablas / Formularios)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenPreviewModal(theme)}
              className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Simulación Completa</span>
            </button>
          </div>
        </div>

        {/* 4. REAL-TIME COMPONENT SHOWCASE (All 16 components responding to scoped CSS variables) */}
        <div className="design-lab-scope space-y-8" data-reduced-motion={reducedMotion}>
          
          {/* Microinteractions Section */}
          {(activeSectionFilter === 'all' || activeSectionFilter === 'micro') && (
            <div id="section-microinteractions" className="space-y-4">
              <DesignLabMicrointeractions 
                reducedMotion={reducedMotion}
                onToggleReducedMotion={() => setReducedMotion(!reducedMotion)}
              />
            </div>
          )}

          {/* Mobile Preview Section */}
          {(activeSectionFilter === 'all' || activeSectionFilter === 'mobile') && (
            <div id="section-mobile-preview" className="space-y-4">
              <DesignLabMobilePreview />
            </div>
          )}

          {/* Business Flows */}
          {(activeSectionFilter === 'all' || activeSectionFilter === 'flows') && (
            <div className="space-y-6">
              <DesignLabDashboard />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DesignLabPOS />
                <DesignLabReceiving />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DesignLabRequest />
                <DesignLabProduct />
              </div>
              <DesignLabSuggestions />
            </div>
          )}

          {/* Atomic UI Tokens */}
          {(activeSectionFilter === 'all' || activeSectionFilter === 'components') && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DesignLabNavigation />
                <DesignLabStates />
              </div>
              <DesignLabForms />
              <DesignLabButtons />
              <DesignLabTables />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DesignLabModal />
                <DesignLabAlerts />
              </div>
            </div>
          )}

          {/* Visual Evaluation Rubric */}
          <DesignLabEvaluation currentVariant={currentVariantForEvaluation} />
        </div>

      </div>

      {/* CONFIRMATION MODAL: EXIT WITH UNSAVED CHANGES */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-stone-900 text-base">Tenés cambios sin guardar</h3>
                <p className="text-xs text-stone-500">¿Estás seguro de que querés salir sin guardar?</p>
              </div>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Si salís ahora, las modificaciones realizadas en el tema <strong>"{theme.name}"</strong> se perderán.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
              >
                Continuar editando
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false);
                  onBack();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: APPLY THEME */}
      {showApplyConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-stone-900 text-base">¿Aplicar este tema globalmente?</h3>
                <p className="text-xs text-stone-500">Pasará a ser el diseño activo en todo Uwi</p>
              </div>
            </div>

            {hasUnsavedChanges ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 space-y-1">
                <p className="font-bold">⚠️ Tenés cambios sin guardar</p>
                <p>Al aplicar este tema, los cambios pendientes se guardarán automáticamente incrementando la versión.</p>
              </div>
            ) : (
              <p className="text-xs text-stone-600 leading-relaxed">
                El tema <strong>"{theme.name}" (v{theme.version})</strong> se aplicará a todos los módulos y comercios del sistema inmediatamente.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApplyConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmApply}
                id="btn-confirm-apply-theme"
                className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{hasUnsavedChanges ? 'Guardar y aplicar' : 'Sí, aplicar tema'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
