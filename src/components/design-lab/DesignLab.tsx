import React, { useState, useEffect } from 'react';
import './designTokens.css';
import { ThemeModel, PRESET_UWI_CLEAN } from '../../types/theme';
import { useTheme } from '../../lib/themeContext';
import { useAuth } from '../../lib/authContext';
import { 
  getAllThemes, 
  saveTheme, 
  applyTheme, 
  duplicateTheme, 
  archiveTheme, 
  unarchiveTheme, 
  deleteTheme 
} from '../../lib/themeService';
import { DesignLabLibrary } from './DesignLabLibrary';
import { DesignLabEditor } from './DesignLabEditor';
import { DesignLabComparison } from './DesignLabComparison';
import { DesignLabPreviewModal } from './DesignLabPreviewModal';
import { 
  CheckCircle2, 
  AlertCircle, 
  X,
  Sparkles,
  Palette,
  SlidersHorizontal,
  Edit3
} from 'lucide-react';

export const DesignLab: React.FC = () => {
  const { authUser, userProfile } = useAuth();
  const { activeTheme, allThemes, refreshThemes, applyThemeById } = useTheme();

  // View state: 'library' (Biblioteca y selector) | 'comparison' (Comparador de 5 temas) | 'editor' (Editor de tokens)
  const [viewMode, setViewMode] = useState<'library' | 'comparison' | 'editor'>('library');
  const [editingTheme, setEditingTheme] = useState<ThemeModel | null>(null);
  
  // Local list of themes for immediate optimistic updates
  const [themesList, setThemesList] = useState<ThemeModel[]>(allThemes);
  const [loading, setLoading] = useState(false);

  // Preview modal state
  const [previewTheme, setPreviewTheme] = useState<ThemeModel | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Modals
  const [applyModalTheme, setApplyModalTheme] = useState<ThemeModel | null>(null);

  // Sync themes list from context
  useEffect(() => {
    if (allThemes.length > 0) {
      setThemesList(allThemes);
    }
  }, [allThemes]);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((curr) => (curr?.text === text ? null : curr));
    }, 4000);
  };

  const currentUser = {
    uid: authUser?.uid || 'super-admin',
    email: userProfile?.email || authUser?.email || 'admin@uwi.lat'
  };

  // 1. Create new theme handler
  const handleCreateNewTheme = () => {
    const newTheme: ThemeModel = {
      id: `draft_${Date.now()}`,
      name: 'Nuevo Tema Personalizado',
      subtitle: 'Tema personalizado',
      description: 'Tema creado desde cero en Uwi Design Lab.',
      badge: 'Custom',
      keyFeatures: [
        'Tokens visuales personalizados',
        'Configurado por Super Admin'
      ],
      status: 'saved',
      version: 1,
      isPreset: false,
      tokens: JSON.parse(JSON.stringify(PRESET_UWI_CLEAN.tokens)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: currentUser.email,
      updatedBy: currentUser.email
    };

    setEditingTheme(newTheme);
    setViewMode('editor');
    showToast('Nuevo borrador de tema creado', 'info');
  };

  // 2. Select theme to edit
  const handleSelectThemeToEdit = (theme: ThemeModel) => {
    setEditingTheme(JSON.parse(JSON.stringify(theme)));
    setViewMode('editor');
  };

  // 3. Save theme handler
  const handleSaveTheme = async (themeToSave: ThemeModel): Promise<void> => {
    try {
      const saved = await saveTheme(themeToSave, currentUser);
      setEditingTheme(saved);
      await refreshThemes();
      const updatedList = await getAllThemes();
      setThemesList(updatedList);
      showToast(`Tema "${saved.name}" guardado correctamente (v${saved.version})`, 'success');
    } catch (err) {
      console.error('Error saving theme in Design Lab:', err);
      showToast('Error al guardar el tema', 'error');
      throw err;
    }
  };

  // 4. Apply theme handler
  const handleApplyTheme = async (themeToApply: ThemeModel): Promise<void> => {
    try {
      let targetId = themeToApply.id;
      if (targetId.startsWith('draft_')) {
        const saved = await saveTheme(themeToApply, currentUser);
        targetId = saved.id;
      }

      await applyThemeById(targetId, currentUser);
      const updatedList = await getAllThemes();
      setThemesList(updatedList);
      showToast(`Tema "${themeToApply.name}" aplicado como tema global activo de Uwi`, 'success');
    } catch (err) {
      console.error('Error applying theme:', err);
      showToast('Error al aplicar el tema', 'error');
      throw err;
    }
  };

  // 5. Duplicate theme handler
  const handleDuplicateTheme = async (sourceTheme: ThemeModel): Promise<void> => {
    try {
      setLoading(true);
      const duplicated = await duplicateTheme(sourceTheme, currentUser);
      await refreshThemes();
      const updatedList = await getAllThemes();
      setThemesList(updatedList);
      setLoading(false);
      showToast(`Tema duplicado como "${duplicated.name}"`, 'success');
      setEditingTheme(duplicated);
      setViewMode('editor');
    } catch (err) {
      console.error('Error duplicating theme:', err);
      showToast('Error al duplicar el tema', 'error');
      setLoading(false);
    }
  };

  // 6. Archive theme handler
  const handleArchiveTheme = async (themeId: string): Promise<void> => {
    try {
      setLoading(true);
      await archiveTheme(themeId, currentUser);
      await refreshThemes();
      const updatedList = await getAllThemes();
      setThemesList(updatedList);
      setLoading(false);
      showToast('Tema archivado correctamente', 'info');
    } catch (err) {
      console.error('Error archiving theme:', err);
      showToast(err instanceof Error ? err.message : 'Error al archivar el tema', 'error');
      setLoading(false);
    }
  };

  // 7. Unarchive theme handler
  const handleUnarchiveTheme = async (themeId: string): Promise<void> => {
    try {
      setLoading(true);
      await unarchiveTheme(themeId, currentUser);
      await refreshThemes();
      const updatedList = await getAllThemes();
      setThemesList(updatedList);
      setLoading(false);
      showToast('Tema desarchivado correctamente', 'success');
    } catch (err) {
      console.error('Error unarchiving theme:', err);
      showToast('Error al desarchivar el tema', 'error');
      setLoading(false);
    }
  };

  // 8. Delete theme handler
  const handleDeleteTheme = async (themeId: string): Promise<void> => {
    if (!window.confirm('¿Estás seguro de eliminar este tema permanentemente?')) return;
    try {
      setLoading(true);
      await deleteTheme(themeId, currentUser);
      await refreshThemes();
      const updatedList = await getAllThemes();
      setThemesList(updatedList);
      setLoading(false);
      showToast('Tema eliminado permanentemente', 'info');
    } catch (err) {
      console.error('Error deleting theme:', err);
      showToast(err instanceof Error ? err.message : 'Error al eliminar el tema', 'error');
      setLoading(false);
    }
  };

  // 9. Open full live preview modal
  const handleOpenPreviewModal = (theme: ThemeModel) => {
    setPreviewTheme(theme);
    setIsPreviewModalOpen(true);
  };

  // 10. Apply from Preview modal
  const handleApplyFromPreview = async (theme: ThemeModel) => {
    setIsPreviewModalOpen(false);
    await handleApplyTheme(theme);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4" id="uwi-design-lab-root">
      {/* Design Lab Main Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-stone-200 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setViewMode('library')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              viewMode === 'library'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Palette className="w-4 h-4 text-emerald-400" />
            <span>1. Temas visuales</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('comparison')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              viewMode === 'comparison'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-purple-400" />
            <span>2. Comparar temas</span>
          </button>

          {editingTheme && (
            <button
              type="button"
              onClick={() => setViewMode('editor')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                viewMode === 'editor'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Edit3 className="w-4 h-4 text-amber-400" />
              <span>3. Editor: {editingTheme.name}</span>
            </button>
          )}
        </div>

        {/* Current Active Theme Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-xs shrink-0">
          <span className="text-stone-400 font-bold text-[11px]">Tema Activo:</span>
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: activeTheme.tokens.primary }}
          />
          <span className="font-black text-stone-900">{activeTheme.name}</span>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div 
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-200 ${
            toastMessage.type === 'success' 
              ? 'bg-emerald-950 text-emerald-100 border-emerald-800' 
              : toastMessage.type === 'error'
              ? 'bg-red-950 text-red-100 border-red-800'
              : 'bg-stone-900 text-white border-stone-700'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {toastMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
          {toastMessage.type === 'info' && <Sparkles className="w-5 h-5 text-purple-400" />}
          <span className="text-xs font-bold">{toastMessage.text}</span>
          <button 
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-stone-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* VIEW 1: Visual Themes Library */}
      {viewMode === 'library' && (
        <DesignLabLibrary
          themes={themesList}
          activeThemeId={activeTheme.id}
          loading={loading}
          onSelectThemeToEdit={handleSelectThemeToEdit}
          onPreviewTheme={handleOpenPreviewModal}
          onApplyTheme={(t) => setApplyModalTheme(t)}
          onDuplicateTheme={handleDuplicateTheme}
          onArchiveTheme={handleArchiveTheme}
          onUnarchiveTheme={handleUnarchiveTheme}
          onDeleteTheme={handleDeleteTheme}
          onCreateNewTheme={handleCreateNewTheme}
          onRefresh={async () => {
            setLoading(true);
            await refreshThemes();
            const updated = await getAllThemes();
            setThemesList(updated);
            setLoading(false);
            showToast('Temas actualizados', 'info');
          }}
          onGoToComparison={() => setViewMode('comparison')}
        />
      )}

      {/* VIEW 2: Multi-theme Comparison Matrix */}
      {viewMode === 'comparison' && (
        <DesignLabComparison
          themes={themesList}
          activeThemeId={activeTheme.id}
          onApplyTheme={(t) => setApplyModalTheme(t)}
          onPreviewTheme={handleOpenPreviewModal}
        />
      )}

      {/* VIEW 3: Theme Visual Editor */}
      {viewMode === 'editor' && editingTheme && (
        <DesignLabEditor
          initialTheme={editingTheme}
          isActiveTheme={editingTheme.id === activeTheme.id}
          onBack={() => setViewMode('library')}
          onSave={handleSaveTheme}
          onApply={handleApplyTheme}
          onDuplicate={handleDuplicateTheme}
          onOpenPreviewModal={handleOpenPreviewModal}
        />
      )}

      {/* Interactive Live Preview Modal */}
      {previewTheme && (
        <DesignLabPreviewModal
          theme={previewTheme}
          isOpen={isPreviewModalOpen}
          onClose={() => {
            setIsPreviewModalOpen(false);
            setPreviewTheme(null);
          }}
          onApply={handleApplyFromPreview}
        />
      )}

      {/* Quick Apply Confirmation Modal */}
      {applyModalTheme && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-xs"
                style={{ backgroundColor: applyModalTheme.tokens.primary }}
              >
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-stone-900 text-base">¿Aplicar tema visual?</h3>
                <p className="text-xs text-stone-500">Pasará a ser el diseño activo en todo Uwi</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              ¿Querés aplicar <strong>"{applyModalTheme.name}"</strong> (v{applyModalTheme.version}) como el tema visual global de Uwi?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApplyModalTheme(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = applyModalTheme;
                  setApplyModalTheme(null);
                  await handleApplyTheme(target);
                }}
                id="btn-confirm-apply-from-library"
                className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white shadow-md cursor-pointer"
              >
                Sí, aplicar tema
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
