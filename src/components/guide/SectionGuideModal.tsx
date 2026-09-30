import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SectionGuideConfig, SectionGuideStep } from './types';
import { 
  HelpCircle, 
  X, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Sparkles,
  Info
} from 'lucide-react';

export interface SectionGuideModalProps {
  guide: SectionGuideConfig | null;
  isOpen: boolean;
  onClose: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export const SectionGuideModal: React.FC<SectionGuideModalProps> = ({
  guide,
  isOpen,
  onClose,
}) => {
  // Current index: 0 = Intro, 1..N = Step 1..N, N+1 = Conclusion
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [activeElement, setActiveElement] = useState<HTMLElement | null>(null);

  const steps = useMemo(() => guide?.steps || [], [guide]);
  const totalSteps = steps.length;

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
      setTargetRect(null);
      setActiveElement(null);
    }
  }, [isOpen, guide?.id]);

  // Find target element and measure its bounding box
  const measureTarget = useCallback(() => {
    if (!isOpen || !guide) return;

    // Intro or Conclusion -> no target
    if (currentStepIndex === 0 || currentStepIndex > totalSteps) {
      setTargetRect(null);
      setActiveElement(null);
      return;
    }

    const currentStep: SectionGuideStep | undefined = steps[currentStepIndex - 1];
    if (!currentStep || !currentStep.target) {
      setTargetRect(null);
      setActiveElement(null);
      return;
    }

    // Try finding by data-uwi-guide first, then by ID
    let el = document.querySelector<HTMLElement>(`[data-uwi-guide="${currentStep.target}"]`);
    if (!el) {
      el = document.getElementById(currentStep.target);
    }

    if (!el) {
      // Element not in DOM -> gracefully advance to next step or conclusion
      if (currentStepIndex < totalSteps) {
        setCurrentStepIndex((prev) => prev + 1);
      } else {
        setCurrentStepIndex(totalSteps + 1);
      }
      return;
    }

    setActiveElement(el);

    // Scroll into view if off-screen
    el.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
      inline: 'nearest'
    });

    const rect = el.getBoundingClientRect();
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
      right: rect.right,
    });
  }, [isOpen, guide, currentStepIndex, steps, totalSteps]);

  // Measure on step change
  useEffect(() => {
    if (!isOpen) return;

    // Small delay to allow scroll and render to settle
    const timer = setTimeout(() => {
      measureTarget();
    }, 120);

    return () => clearTimeout(timer);
  }, [currentStepIndex, isOpen, measureTarget]);

  // Re-measure on resize or scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => {
      if (activeElement) {
        const rect = activeElement.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          right: rect.right,
        });
      }
    };

    window.addEventListener('resize', handleUpdate, { passive: true });
    window.addEventListener('scroll', handleUpdate, { passive: true });

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate);
    };
  }, [isOpen, activeElement]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex, totalSteps]);

  const handleNext = () => {
    if (currentStepIndex <= totalSteps) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  if (!isOpen || !guide) return null;

  const isIntro = currentStepIndex === 0;
  const isConclusion = currentStepIndex > totalSteps;
  const isStep = !isIntro && !isConclusion;
  const currentStep = isStep ? steps[currentStepIndex - 1] : null;

  // Calculate Tooltip position relative to Target Rect
  const calculateTooltipStyle = (): React.CSSProperties => {
    if (!targetRect || isIntro || isConclusion) {
      return {};
    }

    const padding = 12;
    const cardWidth = Math.min(340, window.innerWidth - 32);
    const cardHeightEst = 190;

    // Viewport dimensions
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    const spaceBelow = vh - targetRect.bottom;
    const spaceAbove = targetRect.top;

    let top = 0;
    let left = targetRect.left + (targetRect.width / 2) - (cardWidth / 2);

    // Keep horizontally within viewport
    left = Math.max(16, Math.min(left, vw - cardWidth - 16));

    // Place above or below target depending on available space
    if (spaceBelow >= cardHeightEst + padding || spaceBelow >= spaceAbove) {
      top = targetRect.bottom + padding;
    } else {
      top = Math.max(16, targetRect.top - cardHeightEst - padding);
    }

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${cardWidth}px`,
      zIndex: 10001,
    };
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ayuda guiada: ${guide.sectionName}`}
      className="fixed inset-0 z-[10000] select-none"
    >
      {/* 1. Backdrop Overlay */}
      {/* If pointing to a target, render cutout spotlight; else solid subtle backdrop */}
      {targetRect && isStep ? (
        <div className="fixed inset-0 pointer-events-auto bg-stone-950/60 transition-opacity duration-300">
          {/* Spotlight Cutout Frame */}
          <div
            className="fixed rounded-2xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(12,10,9,0.7),0_0_25px_rgba(16,185,129,0.35)] transition-all duration-300 pointer-events-none"
            style={{
              top: `${Math.max(4, targetRect.top - 6)}px`,
              left: `${Math.max(4, targetRect.left - 6)}px`,
              width: `${targetRect.width + 12}px`,
              height: `${targetRect.height + 12}px`,
            }}
          >
            {/* Corner pulse accents */}
            <span className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-emerald-400 rounded-full animate-ping opacity-75" />
            <span className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-emerald-500 rounded-full" />
          </div>
        </div>
      ) : (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-stone-950/70 backdrop-blur-xs transition-opacity duration-200"
        />
      )}

      {/* 2. Intro Step Modal (Centered) */}
      {isIntro && (
        <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border border-stone-200 space-y-4 pointer-events-auto animate-in fade-in zoom-in-95 duration-200 text-stone-900">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                    {guide.intro.badge || guide.sectionName}
                  </span>
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-stone-900 leading-tight">
                    {guide.intro.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar ayuda"
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-normal">
              {guide.intro.description}
            </p>

            <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors py-2 px-1 cursor-pointer"
              >
                Saltar
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
              >
                <span>Comenzar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Step Highlight Tooltip Card (Contextual / Anchored) */}
      {isStep && currentStep && (
        <div
          style={calculateTooltipStyle()}
          className="bg-white rounded-2xl p-4 sm:p-5 shadow-2xl border border-stone-200 pointer-events-auto space-y-3 animate-in fade-in zoom-in-95 duration-150 text-stone-900"
        >
          {/* Header with Title & Step Counter */}
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                Paso {currentStepIndex} de {totalSteps}
              </span>
              <h4 className="text-sm sm:text-base font-black tracking-tight text-stone-900 leading-snug">
                {currentStep.title}
              </h4>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar ayuda"
              className="text-stone-400 hover:text-stone-600 p-1 rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Description (1-2 sentences) */}
          <p className="text-xs text-stone-600 leading-relaxed font-normal">
            {currentStep.description}
          </p>

          {/* Footer Controls: Previous, Progress, Next */}
          <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="px-2.5 py-1.5 text-stone-600 hover:text-stone-900 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>

            <div className="flex items-center gap-1">
              {steps.map((_, idx) => (
                <span
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    idx + 1 === currentStepIndex
                      ? 'bg-emerald-600 w-3'
                      : idx + 1 < currentStepIndex
                      ? 'bg-stone-400'
                      : 'bg-stone-200'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleNext}
              className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer"
            >
              <span>{currentStepIndex === totalSteps ? 'Finalizar' : 'Siguiente'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 4. Conclusion Step Modal (Centered) */}
      {isConclusion && (
        <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border border-stone-200 space-y-4 pointer-events-auto animate-in fade-in zoom-in-95 duration-200 text-stone-900 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Check className="w-6 h-6 stroke-[2.5]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-stone-900">
                {guide.conclusion?.title || '¡Listo!'}
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                {guide.conclusion?.description || 'Ya conocés lo principal de esta sección.'}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
