import React, { useState } from 'react';
import { ThemeModel, INITIAL_PRESET_THEMES } from '../../types/theme';
import { getTokensCssProperties } from '../../lib/themeService';
import { 
  Palette, 
  Plus, 
  CheckCircle2, 
  Eye, 
  Edit3, 
  Copy, 
  Archive, 
  Trash2, 
  Sparkles, 
  Check, 
  RefreshCw, 
  Layers,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Building2,
  TrendingUp,
  DollarSign,
  Package,
  Clock,
  Search,
  SlidersHorizontal,
  ArrowRight,
  RotateCcw,
  Zap,
  Terminal,
  Grid,
  BookOpen,
  Radio,
  Cpu,
  Flame,
  LayoutGrid
} from 'lucide-react';

interface Props {
  themes: ThemeModel[];
  activeThemeId: string;
  loading: boolean;
  onSelectThemeToEdit: (theme: ThemeModel) => void;
  onPreviewTheme: (theme: ThemeModel) => void;
  onApplyTheme: (theme: ThemeModel) => void;
  onDuplicateTheme: (theme: ThemeModel) => void;
  onArchiveTheme: (themeId: string) => void;
  onUnarchiveTheme: (themeId: string) => void;
  onDeleteTheme: (themeId: string) => void;
  onCreateNewTheme: () => void;
  onRefresh: () => void;
  onGoToComparison?: () => void;
}

export const DesignLabLibrary: React.FC<Props> = ({
  themes,
  activeThemeId,
  loading,
  onSelectThemeToEdit,
  onPreviewTheme,
  onApplyTheme,
  onDuplicateTheme,
  onArchiveTheme,
  onUnarchiveTheme,
  onDeleteTheme,
  onCreateNewTheme,
  onRefresh,
  onGoToComparison
}) => {
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | 'core' | 'experimental'>('all');

  // Ensure all 11 themes exist
  const allThemesList = themes.length >= 11 ? themes : INITIAL_PRESET_THEMES;

  const activeTheme =
    allThemesList.find((t) => t.id === activeThemeId) ||
    allThemesList.find((t) => t.status === 'active') ||
    allThemesList[0];

  const nonArchivedThemes = allThemesList.filter((t) => t.status !== 'archived');
  const archivedThemes = allThemesList.filter((t) => t.status === 'archived');

  const coreThemes = nonArchivedThemes.filter(
    (t) => t.category === 'core' || ['uwi-clean', 'uwi-emerald', 'uwi-graphite', 'uwi-soft', 'uwi-command', 'shopify', 'square', 'shop'].includes(t.id)
  );

  const experimentalThemes = nonArchivedThemes.filter(
    (t) => t.category === 'experimental' || ['uwi-editorial', 'uwi-bento', 'uwi-neo', 'uwi-swiss', 'uwi-terminal', 'uwi-aurora'].includes(t.id)
  );

  const filteredCoreThemes = coreThemes.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.subtitle && t.subtitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredExperimentalThemes = experimentalThemes.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.subtitle && t.subtitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Helper renderer for real mini-UI preview according to radical theme personality
  const renderMiniUiPreview = (theme: ThemeModel) => {
    const scopedStyles = getTokensCssProperties(theme.tokens);
    const layoutStyle = theme.layoutStyle || (
      theme.id.includes('editorial') ? 'editorial' :
      theme.id.includes('bento') ? 'bento' :
      theme.id.includes('neo') ? 'neo' :
      theme.id.includes('swiss') ? 'swiss' :
      theme.id.includes('terminal') ? 'terminal' :
      theme.id.includes('aurora') ? 'aurora' : 'standard'
    );

    // 1. EDITORIAL MINI PREVIEW (Serif, big titles, newspaper headlines, no heavy box borders)
    if (layoutStyle === 'editorial') {
      return (
        <div
          className="rounded-xl border p-4 shadow-xs space-y-3 font-serif transition-all"
          style={{
            ...scopedStyles,
            backgroundColor: 'var(--mm-color-bg)',
            borderColor: 'var(--mm-color-border-strong)',
            color: 'var(--mm-color-text)'
          }}
        >
          <div className="border-b pb-2 flex items-center justify-between" style={{ borderColor: 'var(--mm-color-border-strong)' }}>
            <div>
              <span className="text-[9px] uppercase tracking-widest block text-stone-500 font-sans">Reporte Ejecutivo UWI</span>
              <h4 className="text-base font-serif font-black tracking-tight leading-none mt-0.5">Plataforma General</h4>
            </div>
            <span className="text-[10px] font-sans font-bold italic">Edición 2026</span>
          </div>

          <div className="grid grid-cols-3 gap-2 border-b pb-2.5" style={{ borderColor: 'var(--mm-color-border)' }}>
            <div>
              <span className="text-2xl font-serif font-black block leading-none" style={{ color: 'var(--mm-color-primary)' }}>16</span>
              <span className="text-[8px] uppercase tracking-wider font-sans font-bold block mt-1" style={{ color: 'var(--mm-color-text-muted)' }}>Comercios Activos</span>
            </div>
            <div>
              <span className="text-2xl font-serif font-black block leading-none" style={{ color: 'var(--mm-color-primary)' }}>$1.8M</span>
              <span className="text-[8px] uppercase tracking-wider font-sans font-bold block mt-1" style={{ color: 'var(--mm-color-text-muted)' }}>Volumen Hoy</span>
            </div>
            <div>
              <span className="text-2xl font-serif font-black block leading-none" style={{ color: 'var(--mm-color-success)' }}>99%</span>
              <span className="text-[8px] uppercase tracking-wider font-sans font-bold block mt-1" style={{ color: 'var(--mm-color-text-muted)' }}>Operatividad</span>
            </div>
          </div>

          <div className="space-y-1 text-[10px] font-sans">
            <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--mm-color-border-subtle)' }}>
              <span className="font-bold">Minimarket Central</span>
              <span className="italic text-emerald-700">✓ Operativo</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="font-bold">Kiosco Express</span>
              <span className="italic text-emerald-700">✓ Operativo</span>
            </div>
          </div>

          <button
            type="button"
            className="w-full py-1.5 px-2 rounded-xs text-[10px] font-sans font-black uppercase tracking-widest shadow-xs cursor-default"
            style={{
              backgroundColor: 'var(--mm-color-primary)',
              color: 'var(--mm-color-primary-text)'
            }}
          >
            Abrir Sumario Operativo →
          </button>
        </div>
      );
    }

    // 2. BENTO MINI PREVIEW (Modular cards, 2-col / 1-col modules, Apple style rounded corners)
    if (layoutStyle === 'bento') {
      return (
        <div
          className="rounded-2xl border p-3 shadow-xs space-y-2.5 transition-all"
          style={{
            ...scopedStyles,
            backgroundColor: 'var(--mm-color-bg)',
            borderColor: 'var(--mm-color-border)',
            color: 'var(--mm-color-text)'
          }}
        >
          {/* Bento Top Header Module */}
          <div
            className="rounded-xl p-2.5 border flex items-center justify-between shadow-2xs"
            style={{
              backgroundColor: 'var(--mm-color-surface)',
              borderColor: 'var(--mm-color-border)'
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs"
                style={{
                  backgroundColor: 'var(--mm-color-primary)',
                  color: 'var(--mm-color-primary-text)'
                }}
              >
                U
              </div>
              <div>
                <span className="text-[10px] font-black block leading-none">BENTO DASHBOARD</span>
                <span className="text-[8px] font-medium" style={{ color: 'var(--mm-color-text-muted)' }}>Módulos en vivo</span>
              </div>
            </div>
            <span
              className="px-2 py-0.5 rounded-full text-[8px] font-black"
              style={{
                backgroundColor: 'var(--mm-color-primary-subtle)',
                color: 'var(--mm-color-primary)'
              }}
            >
              16 Activos
            </span>
          </div>

          {/* Bento Grid: 2 Col Modules */}
          <div className="grid grid-cols-2 gap-2">
            <div
              className="p-2.5 rounded-xl border flex flex-col justify-between shadow-2xs"
              style={{
                backgroundColor: 'var(--mm-color-surface)',
                borderColor: 'var(--mm-color-border)'
              }}
            >
              <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: 'var(--mm-color-text-muted)' }}>Ventas</span>
              <span className="text-base font-black mt-1" style={{ color: 'var(--mm-color-text)' }}>$184.2k</span>
              <span className="text-[8px] font-bold text-emerald-600 mt-0.5">+18% hoy</span>
            </div>

            <div
              className="p-2.5 rounded-xl border flex flex-col justify-between shadow-2xs"
              style={{
                backgroundColor: 'var(--mm-color-surface-subtle)',
                borderColor: 'var(--mm-color-border)'
              }}
            >
              <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: 'var(--mm-color-text-muted)' }}>Comercios</span>
              <span className="text-base font-black mt-1" style={{ color: 'var(--mm-color-primary)' }}>14 / 16</span>
              <span className="text-[8px] font-bold text-sky-600 mt-0.5">100% Sync</span>
            </div>
          </div>

          {/* Bento Bottom Full Width Module */}
          <div
            className="p-2 rounded-xl border flex items-center justify-between text-[10px] font-bold shadow-2xs"
            style={{
              backgroundColor: 'var(--mm-color-surface)',
              borderColor: 'var(--mm-color-border)'
            }}
          >
            <span>Minimarket Central</span>
            <span
              className="px-2 py-0.5 rounded-lg text-[8px] font-black"
              style={{
                backgroundColor: 'var(--mm-color-success-bg)',
                color: 'var(--mm-color-success-text)'
              }}
            >
              En línea
            </span>
          </div>
        </div>
      );
    }

    // 3. NEO MINI PREVIEW (Cyber dark, glowing neon green, telemetry pulse)
    if (layoutStyle === 'neo') {
      return (
        <div
          className="rounded-2xl border p-3.5 shadow-md space-y-2.5 transition-all relative overflow-hidden"
          style={{
            ...scopedStyles,
            backgroundColor: 'var(--mm-color-bg)',
            borderColor: 'var(--mm-color-border-strong)',
            color: 'var(--mm-color-text)'
          }}
        >
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--mm-color-border)' }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[10px] font-mono font-black tracking-widest text-emerald-400">NEO_OS // v2.6</span>
            </div>
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
              SYS: ONLINE
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 font-mono">
            <div className="p-2 rounded-lg bg-black/40 border border-stone-800 text-center">
              <span className="text-[8px] text-stone-400 block">VOL_TX</span>
              <span className="text-xs font-black text-emerald-400 block mt-0.5">$184k</span>
            </div>
            <div className="p-2 rounded-lg bg-black/40 border border-stone-800 text-center">
              <span className="text-[8px] text-stone-400 block">NODES</span>
              <span className="text-xs font-black text-cyan-400 block mt-0.5">14</span>
            </div>
            <div className="p-2 rounded-lg bg-black/40 border border-stone-800 text-center">
              <span className="text-[8px] text-stone-400 block">LATENCY</span>
              <span className="text-xs font-black text-emerald-400 block mt-0.5">18ms</span>
            </div>
          </div>

          <div className="p-2 rounded-lg bg-black/60 border border-stone-800 text-[9px] font-mono flex justify-between items-center">
            <span className="text-stone-300">NODE_01: Central</span>
            <span className="text-emerald-400 font-bold">[ ACTIVE_SYNC ]</span>
          </div>

          <button
            type="button"
            className="w-full py-1.5 rounded-lg text-[10px] font-mono font-black shadow-sm cursor-default"
            style={{
              backgroundColor: 'var(--mm-color-primary)',
              color: 'var(--mm-color-primary-text)'
            }}
          >
            EXECUTE TELEMETRY &gt;
          </button>
        </div>
      );
    }

    // 4. SWISS MINI PREVIEW (Strict grid, 0px radius, black rules, oversized typography)
    if (layoutStyle === 'swiss') {
      return (
        <div
          className="p-3.5 space-y-2.5 transition-all border-2 border-black"
          style={{
            ...scopedStyles,
            backgroundColor: '#FFFFFF',
            color: '#000000'
          }}
        >
          <div className="border-b-2 border-black pb-1.5 flex justify-between items-baseline">
            <h4 className="text-sm font-black uppercase tracking-tight">UWI SWISS</h4>
            <span className="text-[9px] font-mono font-bold">GRID.01</span>
          </div>

          <div className="grid grid-cols-3 gap-2 border-b-2 border-black pb-2">
            <div>
              <span className="text-xl font-black block leading-none">16</span>
              <span className="text-[7px] font-black uppercase tracking-widest block mt-0.5">COMERCIOS</span>
            </div>
            <div>
              <span className="text-xl font-black block leading-none">184K</span>
              <span className="text-[7px] font-black uppercase tracking-widest block mt-0.5">VENTAS</span>
            </div>
            <div>
              <span className="text-xl font-black block leading-none">100%</span>
              <span className="text-[7px] font-black uppercase tracking-widest block mt-0.5">ACTIVO</span>
            </div>
          </div>

          <div className="text-[9px] font-bold space-y-1">
            <div className="flex justify-between border-b border-black py-0.5">
              <span>01. CENTRAL SCHOOL</span>
              <span className="font-mono">OPERATIVO</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>02. KIOSCO EXPRESS</span>
              <span className="font-mono">OPERATIVO</span>
            </div>
          </div>

          <button
            type="button"
            className="w-full py-1.5 bg-black text-white text-[9px] font-black uppercase tracking-widest cursor-default"
          >
            APLICAR FILTRO SUIZO
          </button>
        </div>
      );
    }

    // 5. TERMINAL MINI PREVIEW (DevOps, monospace telemetry, timestamp, OS flags)
    if (layoutStyle === 'terminal') {
      return (
        <div
          className="rounded-md border p-3 shadow-md space-y-2 font-mono transition-all"
          style={{
            ...scopedStyles,
            backgroundColor: 'var(--mm-color-bg)',
            borderColor: 'var(--mm-color-border)',
            color: 'var(--mm-color-text)'
          }}
        >
          <div className="flex items-center justify-between border-b pb-1 text-[9px]" style={{ borderColor: 'var(--mm-color-border)' }}>
            <span className="text-sky-400 font-bold">root@uwi-node:~#</span>
            <span className="text-stone-400">14:28:03 UTC</span>
          </div>

          <div className="grid grid-cols-3 gap-1 text-[9px]">
            <div className="p-1 rounded bg-stone-900 border border-stone-800">
              <span className="text-stone-400 block text-[8px]">ACTIVE_BIZ</span>
              <span className="text-sky-400 font-bold">16_OK</span>
            </div>
            <div className="p-1 rounded bg-stone-900 border border-stone-800">
              <span className="text-stone-400 block text-[8px]">TOTAL_TX</span>
              <span className="text-emerald-400 font-bold">$184k</span>
            </div>
            <div className="p-1 rounded bg-stone-900 border border-stone-800">
              <span className="text-stone-400 block text-[8px]">ERR_COUNT</span>
              <span className="text-emerald-400 font-bold">0_ERR</span>
            </div>
          </div>

          <div className="p-1.5 rounded bg-black/60 border border-stone-800 text-[8px] space-y-0.5">
            <div className="flex justify-between">
              <span className="text-stone-300">BIZ_ID: school_central</span>
              <span className="text-emerald-400">[ READY ]</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-300">SYNC_STAT: pos_feed_ok</span>
              <span className="text-sky-400">[ SYNCED ]</span>
            </div>
          </div>

          <button
            type="button"
            className="w-full py-1 text-[9px] font-bold rounded-xs cursor-default"
            style={{
              backgroundColor: 'var(--mm-color-primary)',
              color: 'var(--mm-color-primary-text)'
            }}
          >
            $ uwi --inspect-cluster
          </button>
        </div>
      );
    }

    // 6. AURORA MINI PREVIEW (Ambient atmospheric gradient mesh, multi-layer depth)
    if (layoutStyle === 'aurora') {
      return (
        <div
          className="rounded-2xl border p-3.5 shadow-lg space-y-2.5 transition-all relative overflow-hidden"
          style={{
            ...scopedStyles,
            backgroundColor: 'var(--mm-color-bg)',
            borderColor: 'var(--mm-color-border)',
            color: 'var(--mm-color-text)'
          }}
        >
          {/* Ambient Glows */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/15 rounded-full blur-xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/15 rounded-full blur-xl pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between border-b pb-1.5" style={{ borderColor: 'var(--mm-color-border)' }}>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-black tracking-tight text-white">Aurora Atmosphere</span>
            </div>
            <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/60">
              Live Mesh
            </span>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-1.5">
            <div className="p-2 rounded-xl bg-stone-900/80 border border-stone-800 text-center shadow-xs">
              <span className="text-[8px] text-stone-400 block">Ventas</span>
              <span className="text-xs font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 block mt-0.5">$184k</span>
            </div>
            <div className="p-2 rounded-xl bg-stone-900/80 border border-stone-800 text-center shadow-xs">
              <span className="text-[8px] text-stone-400 block">Comercios</span>
              <span className="text-xs font-black text-purple-300 block mt-0.5">16</span>
            </div>
            <div className="p-2 rounded-xl bg-stone-900/80 border border-stone-800 text-center shadow-xs">
              <span className="text-[8px] text-stone-400 block">Atmósfera</span>
              <span className="text-xs font-black text-emerald-400 block mt-0.5">100%</span>
            </div>
          </div>

          <div className="relative z-10 p-2 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between text-[10px]">
            <span className="font-bold text-stone-200">Minimarket Central</span>
            <span className="text-[8px] font-bold text-emerald-400">✨ Óptimo</span>
          </div>

          <button
            type="button"
            className="relative z-10 w-full py-1.5 rounded-xl text-[10px] font-black shadow-md cursor-default bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
          >
            Explorar Vista Aurora
          </button>
        </div>
      );
    }

    // DEFAULT STANDARD MINI PREVIEW (For Core 5 Themes: Clean, Emerald, Graphite, Soft, Command)
    return (
      <div
        className="rounded-2xl border p-3.5 shadow-xs space-y-3 transition-all"
        style={{
          ...scopedStyles,
          backgroundColor: 'var(--mm-color-bg)',
          borderColor: 'var(--mm-color-border-strong)',
          color: 'var(--mm-color-text)'
        }}
      >
        <div
          className="rounded-xl border p-2 flex items-center justify-between gap-2 shadow-2xs"
          style={{
            backgroundColor: 'var(--mm-color-surface)',
            borderColor: 'var(--mm-color-border)'
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px]"
              style={{
                backgroundColor: 'var(--mm-color-primary)',
                color: 'var(--mm-color-primary-text)'
              }}
            >
              U
            </div>
            <span className="font-black text-[11px]" style={{ color: 'var(--mm-color-text)' }}>
              Uwi Dashboard
            </span>
          </div>

          <span
            className="px-1.5 py-0.5 rounded-md text-[9px] font-bold"
            style={{
              backgroundColor: 'var(--mm-color-surface-subtle)',
              color: 'var(--mm-color-text-secondary)'
            }}
          >
            Online
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <div
            className="p-2 rounded-lg border shadow-2xs text-center"
            style={{
              backgroundColor: 'var(--mm-color-surface)',
              borderColor: 'var(--mm-color-border)'
            }}
          >
            <span className="text-[9px] block truncate" style={{ color: 'var(--mm-color-text-muted)' }}>
              Ventas Hoy
            </span>
            <span className="text-xs font-black block mt-0.5" style={{ color: 'var(--mm-color-text)' }}>
              $184.250
            </span>
          </div>

          <div
            className="p-2 rounded-lg border shadow-2xs text-center"
            style={{
              backgroundColor: 'var(--mm-color-surface)',
              borderColor: 'var(--mm-color-border)'
            }}
          >
            <span className="text-[9px] block truncate" style={{ color: 'var(--mm-color-text-muted)' }}>
              Comercios
            </span>
            <span className="text-xs font-black block mt-0.5" style={{ color: 'var(--mm-color-text)' }}>
              14
            </span>
          </div>

          <div
            className="p-2 rounded-lg border shadow-2xs text-center"
            style={{
              backgroundColor: 'var(--mm-color-surface)',
              borderColor: 'var(--mm-color-border)'
            }}
          >
            <span className="text-[9px] block truncate" style={{ color: 'var(--mm-color-text-muted)' }}>
              Reposición
            </span>
            <span className="text-xs font-black block mt-0.5" style={{ color: 'var(--mm-color-text)' }}>
              98.2%
            </span>
          </div>
        </div>

        <div
          className="rounded-xl border overflow-hidden shadow-2xs p-2 flex items-center justify-between text-[10px]"
          style={{
            backgroundColor: 'var(--mm-color-surface)',
            borderColor: 'var(--mm-color-border)'
          }}
        >
          <span className="font-bold" style={{ color: 'var(--mm-color-text)' }}>Minimarket Central</span>
          <span
            className="px-1.5 py-0.5 rounded-full text-[8px] font-bold border"
            style={{
              backgroundColor: 'var(--mm-color-success-bg)',
              color: 'var(--mm-color-success-text)',
              borderColor: 'var(--mm-color-success-border)'
            }}
          >
            ✓ Operativo
          </span>
        </div>

        <button
          type="button"
          className="w-full py-1.5 px-2 rounded-md text-[10px] font-black shadow-2xs cursor-default"
          style={{
            backgroundColor: 'var(--mm-color-primary)',
            color: 'var(--mm-color-primary-text)'
          }}
        >
          + Nueva Venta
        </button>
      </div>
    );
  };

  const renderThemeCard = (theme: ThemeModel, isExperimental: boolean) => {
    const isCurrentActive = theme.id === activeThemeId || theme.status === 'active';

    return (
      <div
        key={theme.id}
        id={`theme-card-${theme.id}`}
        className={`rounded-3xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-lg ${
          isCurrentActive
            ? 'ring-2 ring-emerald-500 border-emerald-400'
            : isExperimental
            ? 'border-purple-200/80 bg-white hover:border-purple-400'
            : 'border-stone-200 bg-white'
        }`}
      >
        {/* Header Info */}
        <div className="p-5 border-b border-stone-100 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full shadow-xs shrink-0"
                style={{ backgroundColor: theme.tokens.primary }}
              />
              <h3 className="font-black text-base text-stone-900 tracking-tight">
                {theme.name}
              </h3>
            </div>

            <div className="flex items-center gap-1.5">
              {isCurrentActive ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>Activo Global</span>
                </span>
              ) : isExperimental ? (
                <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-wider shadow-xs animate-pulse">
                  ✨ Nuevo
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-black uppercase tracking-wider">
                  {theme.badge || 'Core'}
                </span>
              )}
              <span className="text-[11px] font-mono font-bold text-stone-400">
                v{theme.version || 1}
              </span>
            </div>
          </div>

          {theme.subtitle && (
            <p className="text-xs font-bold text-stone-700">
              {theme.subtitle}
            </p>
          )}

          <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
            {theme.description || 'Configuración visual para la plataforma Uwi.'}
          </p>

          {/* Key Features Tags */}
          {theme.keyFeatures && theme.keyFeatures.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {theme.keyFeatures.slice(0, 2).map((feat, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[10px] font-medium"
                >
                  • {feat}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Real Mini-UI Preview Box */}
        <div className="p-4 bg-stone-50/70 border-b border-stone-100">
          {renderMiniUiPreview(theme)}
        </div>

        {/* Action Buttons Footer */}
        <div className="p-4 bg-white space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onPreviewTheme(theme)}
              className="py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              title="Abrir vista previa interactiva completa"
            >
              <Eye className="w-3.5 h-3.5 text-stone-600" />
              <span>Vista previa</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectThemeToEdit(theme)}
              className="py-2 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar tokens</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => onApplyTheme(theme)}
              disabled={isCurrentActive}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                isCurrentActive
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default opacity-90'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{isCurrentActive ? 'Tema Activo Global' : 'Aplicar tema'}</span>
            </button>

            <button
              type="button"
              onClick={() => onDuplicateTheme(theme)}
              className="p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
              title="Duplicar como nuevo tema"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            {!isCurrentActive && (
              <button
                type="button"
                onClick={() => onArchiveTheme(theme.id)}
                className="p-2 rounded-xl text-stone-400 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                title="Archivar tema"
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
            )}

            {!theme.isPreset && !isCurrentActive && (
              <button
                type="button"
                onClick={() => onDeleteTheme(theme.id)}
                className="p-2 rounded-xl text-stone-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                title="Eliminar permanentemente"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8" id="design-lab-library-view">
      {/* Top Hero Banner */}
      <div className="bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-bl from-emerald-500/10 via-purple-500/10 to-transparent pointer-events-none rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-800/90 border border-stone-700 text-xs font-black text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>SISTEMA DE DISEÑO VISUAL UWI // 11 TEMAS</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight flex items-center gap-3 text-white">
              <Palette className="w-8 h-8 text-emerald-400" />
              <span>Biblioteca de Temas Visuales</span>
            </h1>
            <p className="text-stone-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Explorá la colección de <strong>11 lenguajes visuales de Uwi</strong>: 5 temas estándar <em>UWI Core</em> y 6 temas radicales de segunda generación <em>UWI Experimental</em> (Editorial, Bento, Neo, Swiss, Terminal y Aurora).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onGoToComparison && (
              <button
                type="button"
                onClick={onGoToComparison}
                className="px-4 py-2.5 rounded-xl bg-purple-950/90 hover:bg-purple-900 text-purple-200 font-black text-xs border border-purple-700/60 flex items-center gap-2 cursor-pointer transition-all shadow-sm hover:scale-[1.02]"
              >
                <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                <span>Comparador de 11 temas</span>
              </button>
            )}
            <button
              type="button"
              onClick={onRefresh}
              className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs border border-stone-700 flex items-center gap-2 cursor-pointer transition-colors"
              title="Actualizar lista de temas"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Recargar</span>
            </button>
            <button
              type="button"
              onClick={onCreateNewTheme}
              id="btn-create-new-theme"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Nuevo tema</span>
            </button>
          </div>
        </div>

        {/* Quick Summary Pill Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-stone-800/80 text-xs">
          <div className="bg-stone-900/60 p-3 rounded-xl border border-stone-800">
            <span className="text-stone-400 font-bold uppercase tracking-wider block text-[10px]">Temas Disponibles</span>
            <span className="text-lg font-black text-white">{allThemesList.length} (5 Core + 6 Exp.)</span>
          </div>
          <div className="bg-stone-900/60 p-3 rounded-xl border border-stone-800">
            <span className="text-stone-400 font-bold uppercase tracking-wider block text-[10px]">Tema Activo Global</span>
            <span className="text-sm font-black text-emerald-400 truncate block">{activeTheme?.name || 'UWI Clean'}</span>
          </div>
          <div className="bg-stone-900/60 p-3 rounded-xl border border-stone-800">
            <span className="text-stone-400 font-bold uppercase tracking-wider block text-[10px]">Versión Activa</span>
            <span className="text-lg font-black text-white">v{activeTheme?.version || 1}</span>
          </div>
          <div className="bg-stone-900/60 p-3 rounded-xl border border-stone-800">
            <span className="text-stone-400 font-bold uppercase tracking-wider block text-[10px]">Categoría Activa</span>
            <span className="text-sm font-bold text-stone-200">{activeTheme?.category === 'experimental' ? '✨ UWI Experimental' : '🏛️ UWI Core'}</span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
        {/* Category Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveCategoryFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeCategoryFilter === 'all'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Todos ({nonArchivedThemes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveCategoryFilter('core')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeCategoryFilter === 'core'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <span>🏛️ UWI Core</span>
            <span className="px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-800 text-[10px]">5</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveCategoryFilter('experimental')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeCategoryFilter === 'experimental'
                ? 'bg-purple-900 text-purple-100 shadow-xs'
                : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
            }`}
          >
            <span>✨ UWI Experimental</span>
            <span className="px-1.5 py-0.2 rounded-full bg-purple-200 text-purple-900 text-[10px] font-bold">6 Nuevos</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o estilo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 1: UWI EXPERIMENTAL (6 NUEVOS TEMAS RADICALES)       */}
      {/* ============================================================ */}
      {(activeCategoryFilter === 'all' || activeCategoryFilter === 'experimental') && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-black text-stone-900 tracking-tight flex items-center gap-2">
                  <span>UWI EXPERIMENTAL</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-bold uppercase tracking-wider">
                    6 Nuevos Lenguajes Visuales
                  </span>
                </h2>
                <p className="text-xs text-stone-500">
                  Temas de segunda generación con cambios radicales en composición, tipografía, grilla y navegación
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredExperimentalThemes.map((theme) => renderThemeCard(theme, true))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 2: UWI CORE (5 TEMAS ESTÁNDAR DE LA PLATAFORMA)      */}
      {/* ============================================================ */}
      {(activeCategoryFilter === 'all' || activeCategoryFilter === 'core') && (
        <div className="space-y-4 pt-6 border-t border-stone-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-black text-stone-900 tracking-tight flex items-center gap-2">
                  <span>UWI CORE</span>
                  <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold uppercase tracking-wider">
                    5 Temas Estándar
                  </span>
                </h2>
                <p className="text-xs text-stone-500">
                  Variaciones del lenguaje SaaS probado de Uwi (Clean, Emerald, Graphite, Soft y Command)
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCoreThemes.map((theme) => renderThemeCard(theme, false))}
          </div>
        </div>
      )}

      {/* 3. SECCIÓN DE TEMAS ARCHIVADOS */}
      {archivedThemes.length > 0 && (
        <div className="pt-4 border-t border-stone-200 space-y-3">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-stone-800 cursor-pointer"
          >
            {showArchived ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>Temas Archivados ({archivedThemes.length})</span>
          </button>

          {showArchived && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {archivedThemes.map((at) => (
                <div 
                  key={at.id}
                  className="bg-stone-50 rounded-2xl border border-stone-200 p-4 space-y-3 opacity-75"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-stone-200 text-stone-700">
                      Archivado
                    </span>
                    <span className="text-xs font-mono text-stone-400">v{at.version}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-stone-800">{at.name}</h4>
                    <p className="text-xs text-stone-500">{at.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-stone-200">
                    <button
                      type="button"
                      onClick={() => onUnarchiveTheme(at.id)}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Desarchivar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTheme(at.id)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 cursor-pointer"
                      title="Eliminar permanentemente"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
