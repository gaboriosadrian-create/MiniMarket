import React, { useState } from 'react';
import { useAuth } from '../../lib/authContext';
import { Product } from '../../types';
import { 
  SmartCatalogAnalysisResult, 
  ColumnMapping, 
  TargetFieldKey, 
  CategoryProposal, 
  ParsedCatalogProduct, 
  ImportExecutionOptions, 
  ImportExecutionResult 
} from '../../lib/smartCatalogTypes';
import { 
  analyzeSmartCatalog, 
  revalidateCatalogAnalysis 
} from '../../lib/smartCatalogAnalyzer';
import { executeSmartCatalogImport } from '../../lib/smartCatalogImportService';
import { Step1Upload } from './Step1Upload';
import { Step2ColumnMapping } from './Step2ColumnMapping';
import { Step3CategoryOrganization } from './Step3CategoryOrganization';
import { Step4ReviewAndPreview } from './Step4ReviewAndPreview';
import { Step5ProgressAndSuccess } from './Step5ProgressAndSuccess';
import { AssistedImportModal } from './AssistedImportModal';
import { 
  X, 
  Sparkles, 
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2
} from 'lucide-react';

interface SmartCatalogImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProducts: Product[];
  onImportComplete: () => Promise<void>;
  onNavigateToPOS?: () => void;
}

export const SmartCatalogImportModal: React.FC<SmartCatalogImportModalProps> = ({
  isOpen,
  onClose,
  existingProducts,
  onImportComplete,
  onNavigateToPOS
}) => {
  const { userProfile, business } = useAuth();

  // Wizard Step: 1 (Upload) | 2 (Mapping) | 3 (Categories) | 4 (Review) | 5 (Progress & Success)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Staged File and Analysis State
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<SmartCatalogAnalysisResult | null>(null);

  // Assisted Import Modal State
  const [showAssistedModal, setShowAssistedModal] = useState(false);

  // Import Execution Options & State
  const [importOptions, setImportOptions] = useState<ImportExecutionOptions>({
    updateExistingProducts: true,
    overwriteStockForExisting: false,
    createMissingCategories: true,
    createMissingSuppliers: true,
    skipRowsWithErrors: true
  });

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, itemName: '' });
  const [importResult, setImportResult] = useState<ImportExecutionResult | null>(null);

  if (!isOpen) return null;

  // STEP 1: Handle file analysis
  const handleFileSelected = async (file: File, selectedSheet?: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setCurrentFile(file);

    try {
      const result = await analyzeSmartCatalog(file, existingProducts, selectedSheet);
      setAnalysisResult(result);
      setCurrentStep(2);
    } catch (err: any) {
      setAnalysisError(err.message || 'Ocurrió un error al procesar el archivo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSheetChange = async (sheetName: string) => {
    if (currentFile) {
      await handleFileSelected(currentFile, sheetName);
    }
  };

  // STEP 2: Handle column mapping change
  const handleMappingChange = (sourceColumn: string, newTarget: TargetFieldKey) => {
    if (!analysisResult) return;

    const updatedMappings: ColumnMapping[] = analysisResult.mappings.map(m => {
      if (m.sourceColumn === sourceColumn) {
        return {
          ...m,
          targetField: newTarget,
          confidence: 'manual',
          reason: newTarget === 'ignore' ? 'Descartada manualmente' : 'Asignada manualmente'
        };
      }
      // If single-use field, unassign from other column
      if (
        newTarget !== 'ignore' && 
        ['name', 'barcode', 'sku', 'salePrice', 'costPrice', 'stock', 'category', 'supplier', 'brand'].includes(newTarget) &&
        m.targetField === newTarget &&
        m.sourceColumn !== sourceColumn
      ) {
        return {
          ...m,
          targetField: 'ignore',
          confidence: 'low',
          reason: `Reasignado a la columna "${sourceColumn}"`
        };
      }
      return m;
    });

    const revalidated = revalidateCatalogAnalysis(
      analysisResult,
      updatedMappings,
      analysisResult.categoryProposals,
      existingProducts
    );
    setAnalysisResult(revalidated);
  };

  // STEP 3: Handle category proposals
  const handleAcceptAllProposals = () => {
    if (!analysisResult) return;
    const accepted = analysisResult.categoryProposals.map(p => ({
      ...p,
      selectedName: p.proposedName,
      action: 'accept' as const
    }));
    const revalidated = revalidateCatalogAnalysis(
      analysisResult,
      analysisResult.mappings,
      accepted,
      existingProducts
    );
    setAnalysisResult(revalidated);
  };

  const handleUpdateProposalName = (proposalId: string, newName: string) => {
    if (!analysisResult) return;
    const updated = analysisResult.categoryProposals.map(p => {
      if (p.id === proposalId) {
        return { ...p, selectedName: newName, action: 'rename' as const };
      }
      return p;
    });
    const revalidated = revalidateCatalogAnalysis(
      analysisResult,
      analysisResult.mappings,
      updated,
      existingProducts
    );
    setAnalysisResult(revalidated);
  };

  const handleMergeCategory = (proposalId: string, targetCategoryName: string) => {
    if (!analysisResult) return;
    const updated = analysisResult.categoryProposals.map(p => {
      if (p.id === proposalId) {
        return { 
          ...p, 
          selectedName: targetCategoryName, 
          action: 'merge' as const, 
          mergeTargetCategory: targetCategoryName 
        };
      }
      return p;
    });
    const revalidated = revalidateCatalogAnalysis(
      analysisResult,
      analysisResult.mappings,
      updated,
      existingProducts
    );
    setAnalysisResult(revalidated);
  };

  const handleBulkAssignUncategorized = (categoryName: string) => {
    if (!analysisResult) return;
    const updatedRows = analysisResult.rows.map(r => {
      if (!r.category || r.category === 'General') {
        return {
          ...r,
          category: categoryName,
          warnings: r.warnings.filter(w => !w.includes('categoría'))
        };
      }
      return r;
    });

    setAnalysisResult({
      ...analysisResult,
      rows: updatedRows,
      uncategorizedCount: 0
    });
  };

  // STEP 4: Handle product edits in review table
  const handleUpdateProduct = (productId: string, updates: Partial<ParsedCatalogProduct>) => {
    if (!analysisResult) return;
    const updatedRows = analysisResult.rows.map(p => {
      if (p.id === productId) {
        const next = { ...p, ...updates };
        
        // Recompute row validation
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!next.name || !next.name.trim()) {
          errors.push('Falta el nombre del producto.');
        }
        if (next.salePrice < 0) {
          errors.push('El precio de venta no puede ser negativo.');
        }
        if (next.salePrice === 0) {
          warnings.push('El precio de venta es $0.');
        }
        if (!next.category || !next.category.trim()) {
          warnings.push('No tiene categoría asignada.');
        }

        next.errors = errors;
        next.warnings = warnings;
        next.status = errors.length > 0 ? 'ERROR' : warnings.length > 0 ? 'REVIEW' : 'READY';

        return next;
      }
      return p;
    });

    setAnalysisResult({
      ...analysisResult,
      rows: updatedRows,
      readyCount: updatedRows.filter(r => r.status === 'READY').length,
      reviewCount: updatedRows.filter(r => r.status === 'REVIEW').length,
      errorCount: updatedRows.filter(r => r.status === 'ERROR').length
    });
  };

  const handleBulkUpdateProducts = (productIds: string[], updates: Partial<ParsedCatalogProduct>) => {
    if (!analysisResult) return;
    const idSet = new Set(productIds);
    const updatedRows = analysisResult.rows.map(p => {
      if (idSet.has(p.id)) {
        return { ...p, ...updates };
      }
      return p;
    });

    setAnalysisResult({
      ...analysisResult,
      rows: updatedRows
    });
  };

  // STEP 5: Start execution of import
  const handleStartImport = async () => {
    if (!analysisResult || !business?.id || !userProfile?.uid) return;

    setCurrentStep(5);
    setIsImporting(true);
    setImportProgress({ current: 0, total: analysisResult.rows.length, itemName: 'Iniciando importación...' });

    try {
      const result = await executeSmartCatalogImport(
        business.id,
        userProfile.uid,
        userProfile.email || '',
        userProfile.displayName || business.adminName || 'Administrador',
        analysisResult.rows,
        importOptions,
        (current, total, currentItemName) => {
          setImportProgress({ current, total, itemName: currentItemName });
        }
      );

      setImportResult(result);
      await onImportComplete();
    } catch (err: any) {
      setAnalysisError(err.message || 'Error durante la importación.');
    } finally {
      setIsImporting(false);
    }
  };

  // Final Action Handlers
  const handleGoToPOS = () => {
    onClose();
    if (onNavigateToPOS) {
      onNavigateToPOS();
    }
  };

  const handleViewProducts = () => {
    onClose();
  };

  const existingCategoryList = Array.from(new Set(existingProducts.map(p => p.category).filter(Boolean)));

  // Validations for step progression
  const isNameMapped = analysisResult?.mappings.some(m => m.targetField === 'name') ?? false;
  const validForImportCount = analysisResult?.rows.filter(p => p.status !== 'ERROR' && p.duplicateResolution !== 'skip').length ?? 0;

  // Step names dictionary
  const stepTitles: Record<number, string> = {
    1: 'Subir archivo',
    2: 'Mapear columnas',
    3: 'Organizar categorías',
    4: 'Revisar datos',
    5: isImporting ? 'Importando...' : 'Catálogo listo'
  };

  const stepsList = [
    { num: 1, label: 'Subir' },
    { num: 2, label: 'Mapear' },
    { num: 3, label: 'Categorías' },
    { num: 4, label: 'Revisar' }
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
        
        {/* Compact Modal Box (760-820px max width, max 80vh height) */}
        <div className="bg-white rounded-2xl max-w-[780px] w-full shadow-2xl border border-stone-200 flex flex-col max-h-[80vh] sm:max-h-[80vh] h-full sm:h-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Fixed Header */}
          <div className="bg-white px-4 py-3 border-b border-stone-200 flex items-center justify-between shrink-0">
            
            {/* Title & Subtitle */}
            <div className="min-w-0 pr-2">
              <h2 className="text-sm sm:text-base font-bold text-stone-900 leading-tight">
                Importar catálogo
              </h2>
              <p className="text-[11px] text-stone-500 font-medium truncate mt-0.5">
                Paso {Math.min(currentStep, 4)} de 4 · {stepTitles[currentStep]}
              </p>
            </div>

            {/* Compact Horizontal Stepper */}
            <div className="hidden sm:flex items-center gap-1 shrink-0 text-xs">
              {stepsList.map((s, idx) => {
                const isCompleted = currentStep > s.num;
                const isCurrent = currentStep === s.num;

                return (
                  <React.Fragment key={s.num}>
                    <div
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors ${
                        isCurrent
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : isCompleted
                          ? 'text-emerald-700 bg-emerald-50'
                          : 'text-stone-400 bg-stone-50'
                      }`}
                    >
                      <span className="font-mono">
                        {isCompleted ? '✓' : s.num}
                      </span>
                      <span>{s.label}</span>
                    </div>
                    {idx < stepsList.length - 1 && (
                      <span className="text-stone-300 text-[10px]">→</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Close Button */}
            {!isImporting && (
              <button 
                type="button"
                onClick={onClose}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer shrink-0 ml-2"
                title="Cerrar asistente"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 bg-stone-50/40">
            
            {currentStep === 1 && (
              <Step1Upload
                onFileSelected={handleFileSelected}
                isAnalyzing={isAnalyzing}
                availableSheets={analysisResult?.availableSheets}
                selectedSheet={analysisResult?.selectedSheet}
                onSheetChange={handleSheetChange}
                error={analysisError}
                onOpenAssistedHelp={() => setShowAssistedModal(true)}
              />
            )}

            {currentStep === 2 && analysisResult && (
              <Step2ColumnMapping
                analysis={analysisResult}
                mappings={analysisResult.mappings}
                onMappingChange={handleMappingChange}
              />
            )}

            {currentStep === 3 && analysisResult && (
              <Step3CategoryOrganization
                proposals={analysisResult.categoryProposals}
                uncategorizedProducts={analysisResult.rows.filter(r => !r.category || r.category === 'General')}
                existingBusinessCategories={existingCategoryList}
                onAcceptAllProposals={handleAcceptAllProposals}
                onUpdateProposalName={handleUpdateProposalName}
                onMergeCategory={handleMergeCategory}
                onBulkAssignUncategorized={handleBulkAssignUncategorized}
              />
            )}

            {currentStep === 4 && analysisResult && (
              <Step4ReviewAndPreview
                products={analysisResult.rows}
                categoriesList={existingCategoryList}
                options={importOptions}
                onOptionsChange={setImportOptions}
                onUpdateProduct={handleUpdateProduct}
                onBulkUpdateProducts={handleBulkUpdateProducts}
              />
            )}

            {currentStep === 5 && (
              <Step5ProgressAndSuccess
                isImporting={isImporting}
                progressCurrent={importProgress.current}
                progressTotal={importProgress.total}
                currentItemName={importProgress.itemName}
                result={importResult}
                onGoToPOS={handleGoToPOS}
                onViewProducts={handleViewProducts}
              />
            )}

          </div>

          {/* Fixed Footer with Step Actions */}
          {currentStep > 1 && currentStep < 5 && (
            <div className="bg-white px-4 py-2.5 border-t border-stone-200 flex items-center justify-between shrink-0">
              
              {/* Back button */}
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1) as any)}
                className="px-3 py-1.5 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Atrás</span>
              </button>

              {/* Step specific Next / Import Action */}
              <div className="flex items-center gap-2">
                {currentStep === 2 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    disabled={!isNameMapped}
                    className="px-4 py-1.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-xs text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Continuar a Categorías</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {currentStep === 3 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="px-4 py-1.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Continuar a Revisión</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {currentStep === 4 && (
                  <button
                    type="button"
                    onClick={handleStartImport}
                    disabled={validForImportCount === 0}
                    className="px-4 py-1.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-xs text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Importar {validForImportCount} productos</span>
                  </button>
                )}
              </div>

            </div>
          )}

        </div>
      </div>

      {/* Assisted Import Modal */}
      <AssistedImportModal
        isOpen={showAssistedModal}
        onClose={() => setShowAssistedModal(false)}
        fileName={currentFile?.name}
        fileSizeBytes={currentFile?.size}
        estimatedProducts={analysisResult?.totalCount}
      />
    </>
  );
};
