import React, { useState } from 'react';
import { ThemeModel, INITIAL_PRESET_THEMES } from '../../types/theme';
import { getTokensCssProperties } from '../../lib/themeService';
import {
  Store,
  TrendingUp,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  Building2,
  Package,
  Layers,
  HelpCircle,
  FileText,
  SlidersHorizontal,
  ChevronRight,
  Plus,
  Layout,
  Maximize2,
  Grid,
  Zap,
  Terminal as TerminalIcon,
  BookOpen,
  Filter,
  DollarSign,
  Activity,
  ArrowUpRight,
  ExternalLink,
  ChevronDown
} from 'lucide-react';

interface Props {
  themes: ThemeModel[];
  activeThemeId: string;
  onApplyTheme: (theme: ThemeModel) => void;
  onPreviewTheme: (theme: ThemeModel) => void;
}

export const DesignLabComparison: React.FC<Props> = ({
  themes,
  activeThemeId,
  onApplyTheme,
  onPreviewTheme
}) => {
  // Use either the passed themes or ensure all 11 presets are available
  const availableThemes = themes.length >= 11 ? themes : INITIAL_PRESET_THEMES;

  // View Mode: 'matrix' (Side-by-side comparison) | 'full-view' (Vista completa de pantalla Super Admin con layout del tema)
  const [viewMode, setViewMode] = useState<'matrix' | 'full-view'>('matrix');

  // Selected theme for full view
  const [fullViewThemeId, setFullViewThemeId] = useState<string>(
    availableThemes.find((t) => t.id === 'uwi-editorial')?.id || availableThemes[0]?.id
  );

  // Selected themes for matrix comparison
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([
    'uwi-clean',
    'uwi-editorial',
    'uwi-bento',
    'uwi-neo',
    'uwi-swiss',
    'uwi-terminal'
  ]);

  const [filterComponent, setFilterComponent] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'core' | 'experimental'>('all');

  const handleToggleThemeSelection = (id: string) => {
    if (selectedThemeIds.includes(id)) {
      if (selectedThemeIds.length > 1) {
        setSelectedThemeIds(selectedThemeIds.filter((t) => t !== id));
      }
    } else {
      setSelectedThemeIds([...selectedThemeIds, id]);
    }
  };

  const handleSelectAll = (category?: 'core' | 'experimental') => {
    if (!category) {
      setSelectedThemeIds(availableThemes.map((t) => t.id));
    } else if (category === 'core') {
      const coreIds = availableThemes
        .filter((t) => t.category === 'core' || ['uwi-clean', 'uwi-emerald', 'uwi-graphite', 'uwi-soft', 'uwi-command'].includes(t.id))
        .map((t) => t.id);
      setSelectedThemeIds(coreIds);
    } else {
      const expIds = availableThemes
        .filter((t) => t.category === 'experimental' || ['uwi-editorial', 'uwi-bento', 'uwi-neo', 'uwi-swiss', 'uwi-terminal', 'uwi-aurora'].includes(t.id))
        .map((t) => t.id);
      setSelectedThemeIds(expIds);
    }
  };

  const themesToDisplay = availableThemes.filter((t) => selectedThemeIds.includes(t.id));
  const fullViewTheme = availableThemes.find((t) => t.id === fullViewThemeId) || availableThemes[0];
  const fullViewScopedStyles = getTokensCssProperties(fullViewTheme.tokens);

  // Layout style detector
  const getLayoutStyle = (t: ThemeModel) => {
    return t.layoutStyle || (
      t.id.includes('editorial') ? 'editorial' :
      t.id.includes('bento') ? 'bento' :
      t.id.includes('neo') ? 'neo' :
      t.id.includes('swiss') ? 'swiss' :
      t.id.includes('terminal') ? 'terminal' :
      t.id.includes('aurora') ? 'aurora' : 'standard'
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" id="design-lab-comparison-root">
      {/* Header & Controls */}
      <div className="bg-stone-900 text-white rounded-3xl p-6 shadow-xl border border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/90 border border-purple-800 text-xs font-black text-purple-300">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>COMPARADOR RADICAL DE TEMAS UWI</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
            <SlidersHorizontal className="w-7 h-7 text-emerald-400" />
            <span>Comparación de 11 Lenguajes Visuales</span>
          </h2>
          <p className="text-stone-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
            Compará lado a lado los 5 temas <strong>UWI Core</strong> y los 6 nuevos temas <strong>UWI Experimental</strong>, o activá la <strong>Vista Completa</strong> para ver una pantalla real de Super Admin renderizada con el layout de cada diseño.
          </p>
        </div>

        {/* View Mode Switcher Toggle */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-stone-800 border border-stone-700 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('matrix')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'matrix'
                ? 'bg-emerald-500 text-white shadow-md'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Matriz Lado a Lado</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('full-view')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'full-view'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Maximize2 className="w-4 h-4" />
            <span>Vista Completa Super Admin</span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODE 1: MATRIZ COMPARATIVA LADO A LADO                       */}
      {/* ============================================================ */}
      {viewMode === 'matrix' && (
        <div className="space-y-6">
          {/* Quick Filter Bar for Themes in Matrix */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Temas activos en matriz:</span>
              <button
                type="button"
                onClick={() => handleSelectAll()}
                className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs cursor-pointer"
              >
                Todos (11)
              </button>
              <button
                type="button"
                onClick={() => handleSelectAll('experimental')}
                className="px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 font-black text-xs cursor-pointer"
              >
                ✨ 6 Experimentales
              </button>
              <button
                type="button"
                onClick={() => handleSelectAll('core')}
                className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-xs cursor-pointer"
              >
                🏛️ 5 Core
              </button>
            </div>

            {/* Individual Theme Toggle Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {availableThemes.map((t) => {
                const isSelected = selectedThemeIds.includes(t.id);
                const isCurrentActive = t.id === activeThemeId;
                const isExp = t.category === 'experimental' || ['uwi-editorial', 'uwi-bento', 'uwi-neo', 'uwi-swiss', 'uwi-terminal', 'uwi-aurora'].includes(t.id);

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleToggleThemeSelection(t.id)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? isExp
                          ? 'bg-purple-900 text-purple-100 border-purple-700 shadow-xs'
                          : 'bg-stone-900 text-white border-stone-800 shadow-xs'
                        : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: t.tokens.primary }}
                    />
                    <span>{t.name}</span>
                    {isCurrentActive && <span className="text-emerald-400 font-black">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Component Tabs Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {[
              { id: 'all', label: 'Todos los Componentes' },
              { id: 'kpi', label: '1. Métricas & Tratamiento de Datos' },
              { id: 'table', label: '2. Tabla de Comercios & Badges' },
              { id: 'forms', label: '3. Inputs & Botones de Acción' },
              { id: 'alerts', label: '4. Alertas & Estados de Sistema' },
              { id: 'modal', label: '5. Modales & Feedback' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterComponent(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                  filterComponent === tab.id
                    ? 'bg-stone-900 text-white shadow-md'
                    : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Matrix Grid */}
          <div
            className={`grid gap-6 ${
              themesToDisplay.length === 1
                ? 'grid-cols-1'
                : themesToDisplay.length === 2
                ? 'grid-cols-1 lg:grid-cols-2'
                : themesToDisplay.length === 3
                ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                : themesToDisplay.length <= 4
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6'
            }`}
          >
            {themesToDisplay.map((theme) => {
              const scopedStyles = getTokensCssProperties(theme.tokens);
              const isCurrentActive = theme.id === activeThemeId;
              const layoutStyle = getLayoutStyle(theme);
              const isExp = theme.category === 'experimental' || ['uwi-editorial', 'uwi-bento', 'uwi-neo', 'uwi-swiss', 'uwi-terminal', 'uwi-aurora'].includes(theme.id);

              return (
                <div
                  key={theme.id}
                  className={`rounded-3xl border shadow-sm flex flex-col justify-between overflow-hidden transition-all duration-200 ${
                    isCurrentActive ? 'ring-2 ring-emerald-500 border-emerald-400' : 'border-stone-200 bg-white'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-4 border-b border-stone-100 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full shadow-2xs"
                          style={{ backgroundColor: theme.tokens.primary }}
                        />
                        <h3 className="font-black text-sm text-stone-900 line-clamp-1">
                          {theme.name}
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-stone-400">
                        v{theme.version}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] font-bold text-stone-500 truncate">
                        {theme.subtitle}
                      </span>
                      {isExp ? (
                        <span className="px-2 py-0.2 rounded-full bg-purple-100 text-purple-800 text-[9px] font-black uppercase">
                          Nuevo
                        </span>
                      ) : (
                        <span className="px-2 py-0.2 rounded-full bg-stone-100 text-stone-600 text-[9px] font-bold uppercase">
                          Core
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Scoped Canvas Preview */}
                  <div
                    className="p-4 space-y-4 flex-1 transition-all"
                    style={{
                      ...scopedStyles,
                      backgroundColor: 'var(--mm-color-bg)',
                      color: 'var(--mm-color-text)'
                    }}
                  >
                    {/* SECTION: 1. KPI METRICS (Rendered by Theme Paradigm) */}
                    {(filterComponent === 'all' || filterComponent === 'kpi') && (
                      <div className="space-y-2">
                        <span
                          className="text-[9px] font-black uppercase tracking-wider block"
                          style={{ color: 'var(--mm-color-text-muted)' }}
                        >
                          Métricas Clave
                        </span>

                        {layoutStyle === 'editorial' ? (
                          // Editorial Headline Metric
                          <div className="p-3 border-b-2" style={{ borderColor: 'var(--mm-color-border-strong)' }}>
                            <span className="text-3xl font-serif font-black block leading-none" style={{ color: 'var(--mm-color-primary)' }}>16</span>
                            <span className="text-[9px] font-sans uppercase font-bold tracking-widest block mt-1" style={{ color: 'var(--mm-color-text-muted)' }}>COMERCIOS ACTIVOS</span>
                            <div className="mt-2 pt-2 border-t flex justify-between text-[10px] font-sans" style={{ borderColor: 'var(--mm-color-border)' }}>
                              <span className="font-bold">$1.84M Hoy</span>
                              <span className="text-emerald-700 font-bold">+18.4%</span>
                            </div>
                          </div>
                        ) : layoutStyle === 'swiss' ? (
                          // Swiss Stark Typography Metric
                          <div className="p-3 border-2 border-black space-y-1">
                            <span className="text-2xl font-black block leading-none">16</span>
                            <div className="h-0.5 bg-black w-full my-1" />
                            <span className="text-[8px] font-black uppercase tracking-widest block">COMERCIOS VINCULADOS</span>
                            <span className="text-[10px] font-mono block mt-1 font-bold">VOLUMEN: $184.250</span>
                          </div>
                        ) : layoutStyle === 'terminal' ? (
                          // Terminal Monospace Telemetry
                          <div className="p-2.5 rounded-sm border font-mono space-y-1 text-[10px]" style={{ backgroundColor: 'var(--mm-color-surface)', borderColor: 'var(--mm-color-border)' }}>
                            <div className="flex justify-between">
                              <span className="text-stone-400">NODES_ONLINE:</span>
                              <span className="text-sky-400 font-bold">16 / 16</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-stone-400">VOL_24H:</span>
                              <span className="text-emerald-400 font-bold">$184.250</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-stone-400">STATUS:</span>
                              <span className="text-emerald-400 font-bold">[ HEALTHY ]</span>
                            </div>
                          </div>
                        ) : (
                          // Standard & Bento & Neo & Aurora Box Cards
                          <div
                            className="p-3 rounded-xl border shadow-2xs space-y-1"
                            style={{
                              backgroundColor: 'var(--mm-color-surface)',
                              borderColor: 'var(--mm-color-border)'
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold" style={{ color: 'var(--mm-color-text-muted)' }}>Comercios Activos</span>
                              <Store className="w-3.5 h-3.5" style={{ color: 'var(--mm-color-primary)' }} />
                            </div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-xl font-black" style={{ color: 'var(--mm-color-text)' }}>16</span>
                              <span className="text-[10px] font-bold" style={{ color: 'var(--mm-color-success)' }}>+2 este mes</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SECTION: 2. BUSINESS TABLE & BADGES */}
                    {(filterComponent === 'all' || filterComponent === 'table') && (
                      <div className="space-y-2">
                        <span
                          className="text-[9px] font-black uppercase tracking-wider block"
                          style={{ color: 'var(--mm-color-text-muted)' }}
                        >
                          Tabla & Estados
                        </span>
                        <div
                          className="rounded-xl border overflow-hidden shadow-2xs"
                          style={{
                            backgroundColor: 'var(--mm-color-surface)',
                            borderColor: 'var(--mm-color-border)'
                          }}
                        >
                          <div
                            className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider border-b flex justify-between"
                            style={{
                              backgroundColor: 'var(--mm-color-surface-subtle)',
                              borderColor: 'var(--mm-color-border-subtle)',
                              color: 'var(--mm-color-text-muted)'
                            }}
                          >
                            <span>Comercio</span>
                            <span>Estado</span>
                          </div>

                          <div className="p-2 space-y-1.5 text-[10px]">
                            <div className="flex items-center justify-between">
                              <span className="font-bold truncate" style={{ color: 'var(--mm-color-text)' }}>Central School</span>
                              <span
                                className="px-1.5 py-0.5 rounded-md text-[8px] font-bold border"
                                style={{
                                  backgroundColor: 'var(--mm-color-success-bg)',
                                  color: 'var(--mm-color-success-text)',
                                  borderColor: 'var(--mm-color-success-border)'
                                }}
                              >
                                Activo
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="font-bold truncate" style={{ color: 'var(--mm-color-text)' }}>Kiosco Express</span>
                              <span
                                className="px-1.5 py-0.5 rounded-md text-[8px] font-bold border"
                                style={{
                                  backgroundColor: 'var(--mm-color-warning-bg)',
                                  color: 'var(--mm-color-warning-text)',
                                  borderColor: 'var(--mm-color-warning-border)'
                                }}
                              >
                                Reposición
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SECTION: 3. FORMS & BUTTONS */}
                    {(filterComponent === 'all' || filterComponent === 'forms') && (
                      <div className="space-y-2">
                        <span
                          className="text-[9px] font-black uppercase tracking-wider block"
                          style={{ color: 'var(--mm-color-text-muted)' }}
                        >
                          Botones & Inputs
                        </span>
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            placeholder="Buscar comercio..."
                            readOnly
                            value="Minimarket..."
                            className="w-full px-2.5 py-1 text-[10px] rounded-lg border shadow-2xs font-medium"
                            style={{
                              backgroundColor: 'var(--mm-color-surface)',
                              borderColor: 'var(--mm-color-border)',
                              color: 'var(--mm-color-text)'
                            }}
                          />
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              className="flex-1 py-1 px-2 rounded-lg text-[10px] font-black shadow-2xs cursor-default flex items-center justify-center gap-1"
                              style={{
                                backgroundColor: 'var(--mm-color-primary)',
                                color: 'var(--mm-color-primary-text)'
                              }}
                            >
                              + Crear
                            </button>
                            <button
                              type="button"
                              className="py-1 px-2 rounded-lg text-[10px] font-bold border cursor-default"
                              style={{
                                backgroundColor: 'var(--mm-color-secondary)',
                                color: 'var(--mm-color-secondary-text)',
                                borderColor: 'var(--mm-color-secondary-border)'
                              }}
                            >
                              Filtrar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div className="p-3 bg-white border-t border-stone-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFullViewThemeId(theme.id);
                        setViewMode('full-view');
                      }}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3 text-stone-600" />
                      <span>Ver Completo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onApplyTheme(theme)}
                      disabled={isCurrentActive}
                      className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        isCurrentActive
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 opacity-90'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>{isCurrentActive ? 'Activo' : 'Aplicar'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODE 2: VISTA COMPLETA SUPER ADMIN CON LAYOUT DEL TEMA       */}
      {/* ============================================================ */}
      {viewMode === 'full-view' && (
        <div className="space-y-4">
          {/* Top Full-View Selector Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Seleccionar Tema para Pantalla Completa:</span>
              <select
                value={fullViewThemeId}
                onChange={(e) => setFullViewThemeId(e.target.value)}
                className="px-3 py-1.5 text-xs font-black rounded-xl border border-stone-200 bg-stone-50 focus:bg-white cursor-pointer"
              >
                <optgroup label="✨ UWI Experimental (Nuevos)">
                  {availableThemes
                    .filter((t) => t.category === 'experimental' || ['uwi-editorial', 'uwi-bento', 'uwi-neo', 'uwi-swiss', 'uwi-terminal', 'uwi-aurora'].includes(t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.subtitle})
                      </option>
                    ))}
                </optgroup>
                <optgroup label="🏛️ UWI Core (Estándar)">
                  {availableThemes
                    .filter((t) => t.category === 'core' || ['uwi-clean', 'uwi-emerald', 'uwi-graphite', 'uwi-soft', 'uwi-command'].includes(t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.subtitle})
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPreviewTheme(fullViewTheme)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Simulador Interactivo POS</span>
              </button>

              <button
                type="button"
                onClick={() => onApplyTheme(fullViewTheme)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Aplicar "{fullViewTheme.name}" Globalmente</span>
              </button>
            </div>
          </div>

          {/* REAL COMPLETE SUPER ADMIN SCREEN RENDERED WITH THE CHOSEN THEME */}
          <div
            className="rounded-3xl border shadow-xl overflow-hidden transition-all duration-200"
            style={{
              ...fullViewScopedStyles,
              backgroundColor: 'var(--mm-color-bg)',
              borderColor: 'var(--mm-color-border-strong)',
              color: 'var(--mm-color-text)'
            }}
          >
            <div className="flex flex-col lg:flex-row min-h-[640px]">
              {/* 1. SIDEBAR (Adapts to theme paradigm) */}
              <div
                className="w-full lg:w-64 p-5 border-b lg:border-b-0 lg:border-r space-y-6 shrink-0"
                style={{
                  backgroundColor: 'var(--mm-color-surface)',
                  borderColor: 'var(--mm-color-border)'
                }}
              >
                {/* Brand / Masthead */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shadow-xs"
                      style={{
                        backgroundColor: 'var(--mm-color-primary)',
                        color: 'var(--mm-color-primary-text)'
                      }}
                    >
                      U
                    </div>
                    <div>
                      <h3 className="font-black text-base leading-none tracking-tight">Uwi SuperAdmin</h3>
                      <span className="text-[10px] font-bold" style={{ color: 'var(--mm-color-text-muted)' }}>
                        {fullViewTheme.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Nav Links */}
                <div className="space-y-1 text-xs font-bold">
                  {[
                    { label: 'Panel General', active: true, icon: Layout },
                    { label: 'Comercios (16)', active: false, icon: Building2 },
                    { label: 'Administradores', active: false, icon: Users },
                    { label: 'Inventario Global', active: false, icon: Package },
                    { label: 'Auditoría & Logs', active: false, icon: ShieldCheck }
                  ].map((link, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 rounded-xl flex items-center gap-2.5 cursor-pointer transition-all"
                      style={
                        link.active
                          ? {
                              backgroundColor: 'var(--mm-color-primary-subtle)',
                              color: 'var(--mm-color-primary)'
                            }
                          : {
                              color: 'var(--mm-color-text-secondary)'
                            }
                      }
                    >
                      <link.icon className="w-4 h-4" />
                      <span>{link.label}</span>
                    </div>
                  ))}
                </div>

                {/* Sidebar Bottom Profile Widget */}
                <div
                  className="p-3 rounded-2xl border flex items-center gap-2.5"
                  style={{
                    backgroundColor: 'var(--mm-color-surface-subtle)',
                    borderColor: 'var(--mm-color-border-subtle)'
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs"
                    style={{
                      backgroundColor: 'var(--mm-color-primary)',
                      color: 'var(--mm-color-primary-text)'
                    }}
                  >
                    SA
                  </div>
                  <div className="overflow-hidden text-xs">
                    <span className="font-black block truncate">Super Admin</span>
                    <span className="text-[10px] truncate block" style={{ color: 'var(--mm-color-text-muted)' }}>
                      admin@uwi.lat
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. MAIN DASHBOARD CONTENT AREA */}
              <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                {/* Header Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--mm-color-text)' }}>
                      Control de Comercios y Operaciones
                    </h1>
                    <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--mm-color-text-muted)' }}>
                      Supervisión en tiempo real de todos los puntos de venta vinculados
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5"
                      style={{
                        backgroundColor: 'var(--mm-color-secondary)',
                        color: 'var(--mm-color-secondary-text)',
                        borderColor: 'var(--mm-color-border)'
                      }}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      <span>Filtros</span>
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5"
                      style={{
                        backgroundColor: 'var(--mm-color-primary)',
                        color: 'var(--mm-color-primary-text)'
                      }}
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>+ Crear Comercio</span>
                    </button>
                  </div>
                </div>

                {/* 3 Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div
                    className="p-4 rounded-2xl border shadow-2xs space-y-2"
                    style={{
                      backgroundColor: 'var(--mm-color-surface)',
                      borderColor: 'var(--mm-color-border)'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: 'var(--mm-color-text-muted)' }}>Ventas Totales Hoy</span>
                      <DollarSign className="w-4 h-4" style={{ color: 'var(--mm-color-primary)' }} />
                    </div>
                    <span className="text-2xl font-black block" style={{ color: 'var(--mm-color-text)' }}>
                      $184.250
                    </span>
                    <span className="text-xs font-bold block" style={{ color: 'var(--mm-color-success)' }}>
                      +18.4% respecto a ayer
                    </span>
                  </div>

                  <div
                    className="p-4 rounded-2xl border shadow-2xs space-y-2"
                    style={{
                      backgroundColor: 'var(--mm-color-surface)',
                      borderColor: 'var(--mm-color-border)'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: 'var(--mm-color-text-muted)' }}>Comercios Activos</span>
                      <Building2 className="w-4 h-4" style={{ color: 'var(--mm-color-primary)' }} />
                    </div>
                    <span className="text-2xl font-black block" style={{ color: 'var(--mm-color-text)' }}>
                      16 de 16
                    </span>
                    <span className="text-xs font-bold block" style={{ color: 'var(--mm-color-info)' }}>
                      100% operativos en red
                    </span>
                  </div>

                  <div
                    className="p-4 rounded-2xl border shadow-2xs space-y-2"
                    style={{
                      backgroundColor: 'var(--mm-color-surface)',
                      borderColor: 'var(--mm-color-border)'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: 'var(--mm-color-text-muted)' }}>Reposición Stock</span>
                      <Package className="w-4 h-4" style={{ color: 'var(--mm-color-primary)' }} />
                    </div>
                    <span className="text-2xl font-black block" style={{ color: 'var(--mm-color-text)' }}>
                      98.2%
                    </span>
                    <span className="text-xs font-bold block" style={{ color: 'var(--mm-color-warning)' }}>
                      2 solicitudes pendientes
                    </span>
                  </div>
                </div>

                {/* Table of Businesses */}
                <div
                  className="rounded-2xl border overflow-hidden shadow-2xs"
                  style={{
                    backgroundColor: 'var(--mm-color-surface)',
                    borderColor: 'var(--mm-color-border)'
                  }}
                >
                  <div
                    className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    style={{ borderColor: 'var(--mm-color-border-subtle)' }}
                  >
                    <div>
                      <h3 className="font-black text-base" style={{ color: 'var(--mm-color-text)' }}>
                        Listado de Comercios Registrados
                      </h3>
                      <p className="text-xs" style={{ color: 'var(--mm-color-text-muted)' }}>
                        Administración de comercios, administradores y estados
                      </p>
                    </div>

                    <div className="w-full sm:w-64 relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--mm-color-text-muted)' }} />
                      <input
                        type="text"
                        placeholder="Buscar por nombre..."
                        readOnly
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border"
                        style={{
                          backgroundColor: 'var(--mm-color-surface-subtle)',
                          borderColor: 'var(--mm-color-border)',
                          color: 'var(--mm-color-text)'
                        }}
                      />
                    </div>
                  </div>

                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr
                        className="border-b text-[10px] font-black uppercase tracking-wider"
                        style={{
                          backgroundColor: 'var(--mm-color-surface-subtle)',
                          borderColor: 'var(--mm-color-border-subtle)',
                          color: 'var(--mm-color-text-muted)'
                        }}
                      >
                        <th className="p-3">Comercio</th>
                        <th className="p-3">Administrador</th>
                        <th className="p-3">Ventas Hoy</th>
                        <th className="p-3">Estado</th>
                        <th className="p-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--mm-color-border-subtle)' }}>
                      {[
                        { name: 'Minimarket Central School', email: 'gaboriosadrian@gmail.com', sales: '$68.400', status: 'Operativo', stateType: 'success' },
                        { name: 'Kiosco Express Turno Mañana', email: 'laura.kiosco@gmail.com', sales: '$42.100', status: 'Operativo', stateType: 'success' },
                        { name: 'Cantina Secundaria Norte', email: 'carlos.cantina@gmail.com', sales: '$34.800', status: 'Reposición', stateType: 'warning' },
                        { name: 'Buffet Universitario Anexo', email: 'mariana.buffet@gmail.com', sales: '$38.950', status: 'Operativo', stateType: 'success' }
                      ].map((biz, idx) => (
                        <tr key={idx} className="hover:opacity-90">
                          <td className="p-3 font-black" style={{ color: 'var(--mm-color-text)' }}>
                            {biz.name}
                          </td>
                          <td className="p-3" style={{ color: 'var(--mm-color-text-secondary)' }}>
                            {biz.email}
                          </td>
                          <td className="p-3 font-mono font-bold" style={{ color: 'var(--mm-color-text)' }}>
                            {biz.sales}
                          </td>
                          <td className="p-3">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block"
                              style={
                                biz.stateType === 'success'
                                  ? {
                                      backgroundColor: 'var(--mm-color-success-bg)',
                                      color: 'var(--mm-color-success-text)',
                                      borderColor: 'var(--mm-color-success-border)'
                                    }
                                  : {
                                      backgroundColor: 'var(--mm-color-warning-bg)',
                                      color: 'var(--mm-color-warning-text)',
                                      borderColor: 'var(--mm-color-warning-border)'
                                    }
                              }
                            >
                              {biz.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              className="px-3 py-1 rounded-lg text-[10px] font-black border cursor-pointer"
                              style={{
                                backgroundColor: 'var(--mm-color-surface-subtle)',
                                color: 'var(--mm-color-text)',
                                borderColor: 'var(--mm-color-border)'
                              }}
                            >
                              Gestionar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
