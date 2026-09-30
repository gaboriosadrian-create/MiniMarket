import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../lib/authContext';
import { getSectionGuide } from './sectionGuidesRegistry';
import { SectionGuideConfig } from './types';

export function useSectionGuide(guideId: string) {
  const { userProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const guideConfig: SectionGuideConfig | null = useMemo(() => {
    return getSectionGuide(guideId, userProfile?.role);
  }, [guideId, userProfile?.role]);

  const openGuide = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeGuide = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    openGuide,
    closeGuide,
    guideConfig
  };
}
