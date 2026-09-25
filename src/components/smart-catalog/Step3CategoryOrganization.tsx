import React, { useState } from 'react';
import { 
  CategoryProposal, 
  ParsedCatalogProduct 
} from '../../lib/smartCatalogTypes';
import { 
  CheckCheck, 
  Edit2, 
  GitMerge, 
  Sparkles, 
  Search, 
  Tag, 
  AlertCircle
} from 'lucide-react';
import { CATEGORIES_PRESETS, normalizeCategoryName } from '../../lib/categoryUtils';

interface Step3CategoryOrganizationProps {
  proposals: CategoryProposal[];
  uncategorizedProducts: ParsedCatalogProduct[];
  existingBusinessCategories: string[];
  onAcceptAllProposals: () => void;
  onUpdateProposalName: (proposalId: string, newName: string) => void;
  onMergeCategory: (proposalId: string, targetCategoryName: string) => void;
  onBulkAssignUncategorized: (categoryName: string) => void;
}

export const Step3CategoryOrganization: React.FC<Step3CategoryOrganizationProps> = ({
  proposals,
  uncategorizedProducts,
  existingBusinessCategories,
  onAcceptAllProposals,
  onUpdateProposalName,
  onMergeCategory,
  onBulkAssignUncategorized
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [tempEditName, setTempEditName] = useState('');
  const [mergingProposalId, setMergingProposalId] = useState<string | null>(null);
  const [selectedMergeTarget, setSelectedMergeTarget] = useState('');
  const [uncategorizedTarget, setUncategorizedTarget] = useState('General');
  const [customUncategorizedName, setCustomUncategorizedName] = useState('');

  // Filtered proposals by search term
  const filteredProposals = proposals.filter(p => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      p.proposedName.toLowerCase().includes(term) ||
      p.originalVariants.some(v => v.toLowerCase().includes(term))
    );
  });

  const handleStartEdit = (p: CategoryProposal) => {
    setEditingProposalId(p.id);
    setTempEditName(p.selectedName);
  };

  const handleSaveEdit = (proposalId: string) => {
    if (tempEditName.trim()) {
      onUpdateProposalName(proposalId, normalizeCategoryName(tempEditName.trim()));
    }
    setEditingProposalId(null);
  };

  const handleSaveMerge = (proposalId: string) => {
    if (selectedMergeTarget) {
      onMergeCategory(proposalId, normalizeCategoryName(selectedMergeTarget));
    }
    setMergingProposalId(null);
    setSelectedMergeTarget('');
  };

  const handleApplyUncategorized = () => {
    const target = uncategorizedTarget === 'CUSTOM' ? customUncategorizedName.trim() : uncategorizedTarget;
    if (target) {
      onBulkAssignUncategorized(normalizeCategoryName(target) || 'General');
    }
  };

  // Combine unique category list for merge target selector
  const allAvailableTargetCategories = Array.from(
    new Set([
      ...CATEGORIES_PRESETS,
      ...existingBusinessCategories,
      ...proposals.map(p => p.selectedName)
    ])
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-3.5">
      
      {/* Search & Actions Bar */}
      <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-stone-600">
            {proposals.length} categorías
          </span>
          <button
            type="button"
            onClick={onAcceptAllProposals}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-2xs flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Aceptar todas</span>
          </button>
        </div>
      </div>

      {/* Uncategorized Products Section if any */}
      {uncategorizedProducts.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{uncategorizedProducts.length} productos sin rubro</strong> en el archivo:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <select
              value={uncategorizedTarget}
              onChange={(e) => setUncategorizedTarget(e.target.value)}
              className="px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="General">General (Por defecto)</option>
              {allAvailableTargetCategories.filter(c => c !== 'General').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="CUSTOM">+ Crear nueva...</option>
            </select>

            {uncategorizedTarget === 'CUSTOM' && (
              <input
                type="text"
                value={customUncategorizedName}
                onChange={(e) => setCustomUncategorizedName(e.target.value)}
                placeholder="Nombre de categoría..."
                className="px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            )}

            <button
              type="button"
              onClick={handleApplyUncategorized}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              Asignar a todos
            </button>
          </div>
        </div>
      )}

      {/* Category List Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-0.5">
        {filteredProposals.map((proposal) => {
          const isEditing = editingProposalId === proposal.id;
          const isMerging = mergingProposalId === proposal.id;
          const hasMultipleVariants = proposal.originalVariants.length > 1;

          return (
            <div 
              key={proposal.id}
              className="p-2.5 rounded-xl border border-stone-200 bg-white hover:border-stone-300 transition-all space-y-1.5 shadow-2xs"
            >
              {/* Top Row: Canonical Name and Count Badge */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-stone-100 text-stone-700 flex items-center justify-center font-bold text-xs shrink-0">
                    <Tag className="w-3 h-3" />
                  </div>
                  <span className="text-xs font-bold text-stone-900 truncate">
                    {proposal.selectedName}
                  </span>
                </div>

                <span className="px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 text-[10px] font-bold shrink-0">
                  {proposal.count}
                </span>
              </div>

              {/* Detected variations */}
              {hasMultipleVariants && (
                <div className="space-y-0.5">
                  <div className="flex flex-wrap gap-1">
                    {proposal.originalVariants.map((variant, vIdx) => (
                      <span 
                        key={vIdx} 
                        className="px-1.5 py-0.2 bg-stone-50 border border-stone-200 rounded text-[10px] font-mono text-stone-500 truncate max-w-[100px]"
                        title={variant}
                      >
                        {variant}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                    <span>Unificar en "{proposal.selectedName}"</span>
                  </p>
                </div>
              )}

              {/* Inline Editing Form */}
              {isEditing && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-stone-100">
                  <input
                    type="text"
                    value={tempEditName}
                    onChange={(e) => setTempEditName(e.target.value)}
                    className="flex-1 px-2 py-0.5 text-xs border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                    placeholder="Nuevo nombre..."
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(proposal.id)}
                    className="px-2 py-0.5 bg-emerald-600 text-white rounded-md text-[11px] font-bold hover:bg-emerald-700 cursor-pointer"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProposalId(null)}
                    className="px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded-md text-[11px] hover:bg-stone-200 cursor-pointer"
                  >
                    X
                  </button>
                </div>
              )}

              {/* Inline Merge Form */}
              {isMerging && (
                <div className="space-y-1 pt-1 border-t border-stone-100">
                  <div className="flex items-center gap-1">
                    <select
                      value={selectedMergeTarget}
                      onChange={(e) => setSelectedMergeTarget(e.target.value)}
                      className="flex-1 px-1.5 py-0.5 text-xs border border-stone-300 rounded-md font-bold bg-white"
                    >
                      <option value="">Destino...</option>
                      {allAvailableTargetCategories
                        .filter(c => c !== proposal.selectedName)
                        .map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={!selectedMergeTarget}
                      onClick={() => handleSaveMerge(proposal.id)}
                      className="px-2 py-0.5 bg-blue-600 text-white rounded-md text-[11px] font-bold hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      onClick={() => setMergingProposalId(null)}
                      className="px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded-md text-[11px] hover:bg-stone-200 cursor-pointer"
                    >
                      X
                    </button>
                  </div>
                </div>
              )}

              {/* Actions Toolbar */}
              {!isEditing && !isMerging && (
                <div className="flex items-center justify-end gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(proposal)}
                    className="px-1.5 py-0.5 text-[10px] font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded transition-colors flex items-center gap-0.5 cursor-pointer"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                    <span>Renombrar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMergingProposalId(proposal.id); setSelectedMergeTarget(''); }}
                    className="px-1.5 py-0.5 text-[10px] font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded transition-colors flex items-center gap-0.5 cursor-pointer"
                  >
                    <GitMerge className="w-2.5 h-2.5" />
                    <span>Fusionar</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};
