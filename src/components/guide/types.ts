export interface SectionGuideStep {
  /** Stable identifier matching data-uwi-guide="..." attribute */
  target?: string;
  /** Component/Step title */
  title: string;
  /** Concise description (1-2 sentences) */
  description: string;
  /** Optional position hint */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  /** Optional role filtering */
  roles?: ('ADMIN' | 'SUPER_ADMIN' | 'SELLER')[];
}

export interface SectionGuideIntro {
  title: string;
  description: string;
  badge?: string;
}

export interface SectionGuideConclusion {
  title?: string;
  description?: string;
}

export interface SectionGuideConfig {
  id: string;
  sectionName: string;
  intro: SectionGuideIntro;
  steps: SectionGuideStep[];
  conclusion?: SectionGuideConclusion;
}
