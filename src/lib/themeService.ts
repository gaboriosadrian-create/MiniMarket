import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  query,
  where 
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  ThemeModel, 
  ThemeTokens, 
  INITIAL_PRESET_THEMES, 
  PRESET_UWI_CLEAN,
  PRESET_UWI_SOFT,
  DesignLabGlobalConfig 
} from '../types/theme';
import { logAdminAction } from './auditService';

const COLLECTION_THEMES = 'design_themes';
const DOC_GLOBAL_CONFIG = 'design_lab';
const COLLECTION_SETTINGS = 'app_settings';
const LOCAL_CACHE_KEY = 'uwi_active_theme';
const LOCAL_THEME_ID_KEY = 'uwi_active_theme_id';

/**
 * Injects theme CSS variables into a DOM element (defaults to document.documentElement).
 * Both Minimarket (--mm-*), Design Lab (--dl-*), and root data attributes are synchronized.
 */
export function applyTokensToDom(
  tokens: ThemeTokens, 
  targetElement?: HTMLElement,
  themeId?: string,
  layoutStyle?: string
): void {
  if (typeof document === 'undefined') return;
  const el = targetElement || document.documentElement;

  // 0. Attributes for global layout & theme targeting
  if (themeId) {
    el.setAttribute('data-theme', themeId);
    el.setAttribute('data-design', themeId);
  }
  if (layoutStyle) {
    el.setAttribute('data-layout', layoutStyle);
  }

  // 1. Surface & Background
  el.style.setProperty('--mm-color-bg', tokens.bg);
  el.style.setProperty('--mm-color-surface', tokens.surface);
  el.style.setProperty('--mm-color-surface-subtle', tokens.surfaceSubtle);
  el.style.setProperty('--mm-color-surface-hover', tokens.surfaceHover);
  el.style.setProperty('--mm-color-surface-active', tokens.surfaceActive);

  // 2. Borders & Dividers
  el.style.setProperty('--mm-color-border', tokens.border);
  el.style.setProperty('--mm-color-border-subtle', tokens.borderSubtle);
  el.style.setProperty('--mm-color-border-strong', tokens.borderStrong);
  el.style.setProperty('--mm-color-border-focus', tokens.borderFocus || tokens.primary);

  // 3. Typography & Text
  el.style.setProperty('--mm-color-text', tokens.text);
  el.style.setProperty('--mm-color-text-secondary', tokens.textSecondary || tokens.textMuted);
  el.style.setProperty('--mm-color-text-muted', tokens.textMuted);
  el.style.setProperty('--mm-color-text-subtle', tokens.textSubtle);
  el.style.setProperty('--mm-color-text-inverse', tokens.textInverse || '#FFFFFF');

  // 4. Primary Brand & Action
  el.style.setProperty('--mm-color-primary', tokens.primary);
  el.style.setProperty('--mm-color-primary-hover', tokens.primaryHover);
  el.style.setProperty('--mm-color-primary-active', tokens.primaryActive);
  el.style.setProperty('--mm-color-primary-subtle', tokens.primarySubtle);
  el.style.setProperty('--mm-color-primary-text', tokens.primaryText);

  // 5. Semantic Feedback: Success
  el.style.setProperty('--mm-color-success', tokens.success);
  el.style.setProperty('--mm-color-success-bg', tokens.successBg);
  el.style.setProperty('--mm-color-success-border', tokens.successBorder);
  el.style.setProperty('--mm-color-success-text', tokens.successText);

  // 6. Semantic Feedback: Warning
  el.style.setProperty('--mm-color-warning', tokens.warning);
  el.style.setProperty('--mm-color-warning-bg', tokens.warningBg);
  el.style.setProperty('--mm-color-warning-border', tokens.warningBorder);
  el.style.setProperty('--mm-color-warning-text', tokens.warningText);

  // 7. Semantic Feedback: Danger
  el.style.setProperty('--mm-color-danger', tokens.danger);
  el.style.setProperty('--mm-color-danger-bg', tokens.dangerBg);
  el.style.setProperty('--mm-color-danger-border', tokens.dangerBorder);
  el.style.setProperty('--mm-color-danger-text', tokens.dangerText);

  // 8. Semantic Feedback: Info
  el.style.setProperty('--mm-color-info', tokens.info);
  el.style.setProperty('--mm-color-info-bg', tokens.infoBg);
  el.style.setProperty('--mm-color-info-border', tokens.infoBorder);
  el.style.setProperty('--mm-color-info-text', tokens.infoText);

  // 9. Radii
  el.style.setProperty('--mm-radius-sm', tokens.radiusSm);
  el.style.setProperty('--mm-radius-md', tokens.radiusMd);
  el.style.setProperty('--mm-radius-lg', tokens.radiusLg);
  el.style.setProperty('--mm-radius-xl', tokens.radiusXl || tokens.radiusLg);
  el.style.setProperty('--mm-radius-full', tokens.radiusFull);

  // 10. Shadows
  el.style.setProperty('--mm-shadow-xs', tokens.shadowXs);
  el.style.setProperty('--mm-shadow-sm', tokens.shadowSm);
  el.style.setProperty('--mm-shadow-md', tokens.shadowMd);
  el.style.setProperty('--mm-shadow-lg', tokens.shadowLg);

  // 11. Sizing & Typography
  el.style.setProperty('--mm-btn-height', tokens.btnHeight);
  el.style.setProperty('--mm-btn-height-sm', tokens.btnHeightSm || '34px');
  el.style.setProperty('--mm-input-height', tokens.inputHeight);
  el.style.setProperty('--mm-touch-target', tokens.touchTarget || '44px');
  el.style.setProperty('--mm-font-sans', tokens.fontSans);
  el.style.setProperty('--mm-font-mono', tokens.fontMono);
  el.style.setProperty('--mm-spacing-factor', `${tokens.spacingFactor || 1}`);

  // 12. Design Lab Tokens (--dl-*)
  el.style.setProperty('--dl-bg', tokens.bg);
  el.style.setProperty('--dl-surface', tokens.surface);
  el.style.setProperty('--dl-surface-subtle', tokens.surfaceSubtle);
  el.style.setProperty('--dl-surface-hover', tokens.surfaceHover);
  el.style.setProperty('--dl-border', tokens.border);
  el.style.setProperty('--dl-border-subtle', tokens.borderSubtle);
  el.style.setProperty('--dl-border-strong', tokens.borderStrong);
  el.style.setProperty('--dl-text', tokens.text);
  el.style.setProperty('--dl-text-muted', tokens.textMuted);
  el.style.setProperty('--dl-text-subtle', tokens.textSubtle);
  el.style.setProperty('--dl-primary', tokens.primary);
  el.style.setProperty('--dl-primary-hover', tokens.primaryHover);
  el.style.setProperty('--dl-primary-text', tokens.primaryText);
  el.style.setProperty('--dl-primary-subtle', tokens.primarySubtle);
  el.style.setProperty('--dl-secondary', tokens.secondary);
  el.style.setProperty('--dl-secondary-hover', tokens.secondaryHover);
  el.style.setProperty('--dl-secondary-text', tokens.secondaryText);
  el.style.setProperty('--dl-secondary-border', tokens.secondaryBorder);
  el.style.setProperty('--dl-success', tokens.success);
  el.style.setProperty('--dl-success-bg', tokens.successBg);
  el.style.setProperty('--dl-success-border', tokens.successBorder);
  el.style.setProperty('--dl-success-text', tokens.successText);
  el.style.setProperty('--dl-warning', tokens.warning);
  el.style.setProperty('--dl-warning-bg', tokens.warningBg);
  el.style.setProperty('--dl-warning-border', tokens.warningBorder);
  el.style.setProperty('--dl-warning-text', tokens.warningText);
  el.style.setProperty('--dl-danger', tokens.danger);
  el.style.setProperty('--dl-danger-bg', tokens.dangerBg);
  el.style.setProperty('--dl-danger-border', tokens.dangerBorder);
  el.style.setProperty('--dl-danger-text', tokens.dangerText);
  el.style.setProperty('--dl-info', tokens.info);
  el.style.setProperty('--dl-info-bg', tokens.infoBg);
  el.style.setProperty('--dl-info-border', tokens.infoBorder);
  el.style.setProperty('--dl-info-text', tokens.infoText);
  el.style.setProperty('--dl-radius-sm', tokens.radiusSm);
  el.style.setProperty('--dl-radius-md', tokens.radiusMd);
  el.style.setProperty('--dl-radius-lg', tokens.radiusLg);
  el.style.setProperty('--dl-radius-full', tokens.radiusFull);
  el.style.setProperty('--dl-shadow-xs', tokens.shadowXs);
  el.style.setProperty('--dl-shadow-sm', tokens.shadowSm);
  el.style.setProperty('--dl-shadow-md', tokens.shadowMd);
  el.style.setProperty('--dl-font-sans', tokens.fontSans);
  el.style.setProperty('--dl-spacing-factor', `${tokens.spacingFactor || 1}`);
  el.style.setProperty('--dl-btn-height', tokens.btnHeight);
  el.style.setProperty('--dl-input-height', tokens.inputHeight);
}

/**
 * Returns a React CSSProperties object containing all CSS variable overrides for scoped preview.
 */
export function getTokensCssProperties(tokens: ThemeTokens): Record<string, string> {
  return {
    '--mm-color-bg': tokens.bg,
    '--mm-color-surface': tokens.surface,
    '--mm-color-surface-subtle': tokens.surfaceSubtle,
    '--mm-color-surface-hover': tokens.surfaceHover,
    '--mm-color-surface-active': tokens.surfaceActive,
    '--mm-color-border': tokens.border,
    '--mm-color-border-subtle': tokens.borderSubtle,
    '--mm-color-border-strong': tokens.borderStrong,
    '--mm-color-border-focus': tokens.borderFocus || tokens.primary,
    '--mm-color-text': tokens.text,
    '--mm-color-text-secondary': tokens.textSecondary || tokens.textMuted,
    '--mm-color-text-muted': tokens.textMuted,
    '--mm-color-text-subtle': tokens.textSubtle,
    '--mm-color-text-inverse': tokens.textInverse || '#FFFFFF',
    '--mm-color-primary': tokens.primary,
    '--mm-color-primary-hover': tokens.primaryHover,
    '--mm-color-primary-active': tokens.primaryActive,
    '--mm-color-primary-subtle': tokens.primarySubtle,
    '--mm-color-primary-text': tokens.primaryText,
    '--mm-color-success': tokens.success,
    '--mm-color-success-bg': tokens.successBg,
    '--mm-color-success-border': tokens.successBorder,
    '--mm-color-success-text': tokens.successText,
    '--mm-color-warning': tokens.warning,
    '--mm-color-warning-bg': tokens.warningBg,
    '--mm-color-warning-border': tokens.warningBorder,
    '--mm-color-warning-text': tokens.warningText,
    '--mm-color-danger': tokens.danger,
    '--mm-color-danger-bg': tokens.dangerBg,
    '--mm-color-danger-border': tokens.dangerBorder,
    '--mm-color-danger-text': tokens.dangerText,
    '--mm-color-info': tokens.info,
    '--mm-color-info-bg': tokens.infoBg,
    '--mm-color-info-border': tokens.infoBorder,
    '--mm-color-info-text': tokens.infoText,
    '--mm-radius-sm': tokens.radiusSm,
    '--mm-radius-md': tokens.radiusMd,
    '--mm-radius-lg': tokens.radiusLg,
    '--mm-radius-xl': tokens.radiusXl || tokens.radiusLg,
    '--mm-radius-full': tokens.radiusFull,
    '--mm-shadow-xs': tokens.shadowXs,
    '--mm-shadow-sm': tokens.shadowSm,
    '--mm-shadow-md': tokens.shadowMd,
    '--mm-shadow-lg': tokens.shadowLg,
    '--mm-btn-height': tokens.btnHeight,
    '--mm-btn-height-sm': tokens.btnHeightSm || '34px',
    '--mm-input-height': tokens.inputHeight,
    '--mm-touch-target': tokens.touchTarget || '44px',
    '--mm-font-sans': tokens.fontSans,
    '--mm-font-mono': tokens.fontMono,
    '--mm-spacing-factor': `${tokens.spacingFactor || 1}`,
    '--dl-bg': tokens.bg,
    '--dl-surface': tokens.surface,
    '--dl-surface-subtle': tokens.surfaceSubtle,
    '--dl-surface-hover': tokens.surfaceHover,
    '--dl-border': tokens.border,
    '--dl-border-subtle': tokens.borderSubtle,
    '--dl-border-strong': tokens.borderStrong,
    '--dl-text': tokens.text,
    '--dl-text-muted': tokens.textMuted,
    '--dl-text-subtle': tokens.textSubtle,
    '--dl-primary': tokens.primary,
    '--dl-primary-hover': tokens.primaryHover,
    '--dl-primary-text': tokens.primaryText,
    '--dl-primary-subtle': tokens.primarySubtle,
    '--dl-secondary': tokens.secondary,
    '--dl-secondary-hover': tokens.secondaryHover,
    '--dl-secondary-text': tokens.secondaryText,
    '--dl-secondary-border': tokens.secondaryBorder,
    '--dl-success': tokens.success,
    '--dl-success-bg': tokens.successBg,
    '--dl-success-border': tokens.successBorder,
    '--dl-success-text': tokens.successText,
    '--dl-warning': tokens.warning,
    '--dl-warning-bg': tokens.warningBg,
    '--dl-warning-border': tokens.warningBorder,
    '--dl-warning-text': tokens.warningText,
    '--dl-danger': tokens.danger,
    '--dl-danger-bg': tokens.dangerBg,
    '--dl-danger-border': tokens.dangerBorder,
    '--dl-danger-text': tokens.dangerText,
    '--dl-info': tokens.info,
    '--dl-info-bg': tokens.infoBg,
    '--dl-info-border': tokens.infoBorder,
    '--dl-info-text': tokens.infoText,
    '--dl-radius-sm': tokens.radiusSm,
    '--dl-radius-md': tokens.radiusMd,
    '--dl-radius-lg': tokens.radiusLg,
    '--dl-radius-full': tokens.radiusFull,
    '--dl-shadow-xs': tokens.shadowXs,
    '--dl-shadow-sm': tokens.shadowSm,
    '--dl-shadow-md': tokens.shadowMd,
    '--dl-font-sans': tokens.fontSans,
    '--dl-spacing-factor': `${tokens.spacingFactor || 1}`,
    '--dl-btn-height': tokens.btnHeight,
    '--dl-input-height': tokens.inputHeight
  };
}

/**
 * Initializes and retrieves cached theme from localStorage for instant loading on boot.
 */
export function getCachedTheme(): ThemeModel {
  if (typeof window === 'undefined') return PRESET_UWI_CLEAN;
  try {
    const cached = localStorage.getItem(LOCAL_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as ThemeModel;
      if (parsed && parsed.tokens) {
        return parsed;
      }
    }

    const cachedId = localStorage.getItem(LOCAL_THEME_ID_KEY);
    if (cachedId) {
      const foundPreset = INITIAL_PRESET_THEMES.find((p) => p.id === cachedId);
      if (foundPreset) return foundPreset;
    }
  } catch (err) {
    console.warn('Failed to parse cached theme:', err);
  }
  return PRESET_UWI_CLEAN;
}

/**
 * Fetches all themes from Firestore. Guarantees all 11 official presets are included.
 */
export async function getAllThemes(): Promise<ThemeModel[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTION_THEMES));
    
    // Map of existing themes by ID
    const themeMap = new Map<string, ThemeModel>();
    
    // Add all 11 official presets first
    for (const preset of INITIAL_PRESET_THEMES) {
      themeMap.set(preset.id, preset);
    }

    // Overlay Firestore saved/custom themes
    if (!snap.empty) {
      snap.forEach((d) => {
        const data = d.data() as ThemeModel;
        themeMap.set(d.id, { ...data, id: d.id });
      });
    }

    const themes = Array.from(themeMap.values());

    // Sort active theme first, then by updatedAt
    return themes.sort((a, b) => {
      if (a.status === 'active') return -1;
      if (b.status === 'active') return 1;
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });
  } catch (err) {
    console.error('Error fetching themes from Firestore, fallback to presets:', err);
    return INITIAL_PRESET_THEMES;
  }
}

/**
 * Gets the current active theme model from Firestore with safe fallback.
 */
export async function getActiveTheme(): Promise<ThemeModel> {
  try {
    const configDoc = await getDoc(doc(db, COLLECTION_SETTINGS, DOC_GLOBAL_CONFIG));
    let activeId = PRESET_UWI_CLEAN.id;

    if (configDoc.exists()) {
      const data = configDoc.data() as DesignLabGlobalConfig;
      if (data.activeThemeId) {
        activeId = data.activeThemeId;
      }
    }

    // Check if preset
    const preset = INITIAL_PRESET_THEMES.find((p) => p.id === activeId);

    const themeDoc = await getDoc(doc(db, COLLECTION_THEMES, activeId));
    if (themeDoc.exists()) {
      const activeTheme = { ...themeDoc.data(), id: themeDoc.id } as ThemeModel;
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(activeTheme));
        localStorage.setItem(LOCAL_THEME_ID_KEY, activeTheme.id);
      }
      return activeTheme;
    } else if (preset) {
      const activeTheme = { ...preset, status: 'active' as const };
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(activeTheme));
        localStorage.setItem(LOCAL_THEME_ID_KEY, activeTheme.id);
      }
      return activeTheme;
    }
  } catch (err) {
    console.error('Error getting active theme from Firestore:', err);
  }

  return getCachedTheme();
}

/**
 * Saves a theme (create new or update existing).
 * Increments version on edit, keeps same themeId, updates updatedAt timestamp.
 */
export async function saveTheme(
  theme: ThemeModel,
  user: { uid: string; email: string }
): Promise<ThemeModel> {
  const isNew = !theme.id || theme.id.startsWith('draft_') || theme.id === 'new';
  const now = new Date().toISOString();

  let finalId = isNew ? `theme_${Date.now()}_${Math.random().toString(36).substring(2, 6)}` : theme.id;
  const isExisting = !isNew;
  const nextVersion = isExisting ? (Number(theme.version) || 1) + 1 : 1;

  const toSave: ThemeModel = {
    ...theme,
    id: finalId,
    version: nextVersion,
    status: theme.status || 'saved',
    createdAt: theme.createdAt || now,
    updatedAt: now,
    createdBy: theme.createdBy || user.email,
    updatedBy: user.email
  };

  const themeRef = doc(db, COLLECTION_THEMES, finalId);
  await setDoc(themeRef, toSave, { merge: true });

  // If this was the active theme, update local cache and DOM immediately
  if (toSave.status === 'active') {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(toSave));
      localStorage.setItem(LOCAL_THEME_ID_KEY, toSave.id);
    }
    applyTokensToDom(toSave.tokens, undefined, toSave.id, toSave.layoutStyle);
  }

  // Audit log
  await logAdminAction({
    businessId: 'global',
    adminId: user.uid,
    adminEmail: user.email,
    targetUserId: finalId,
    action: isExisting ? 'THEME_UPDATED' : 'THEME_CREATED',
    details: `Tema visual "${toSave.name}" ${isExisting ? `actualizado a v${nextVersion}` : 'creado'}`
  });

  return toSave;
}

/**
 * Applies a theme globally across Uwi and persists the selection.
 * Enforces single active theme rule atomically in Firestore & localStorage.
 */
export async function applyTheme(
  themeId: string,
  user: { uid: string; email: string }
): Promise<ThemeModel> {
  const now = new Date().toISOString();
  
  // 1. Locate theme: either from Firestore or from built-in 11 official presets
  let targetTheme: ThemeModel | null = null;
  const targetDoc = await getDoc(doc(db, COLLECTION_THEMES, themeId));
  
  if (targetDoc.exists()) {
    targetTheme = { ...targetDoc.data(), id: targetDoc.id } as ThemeModel;
  } else {
    const preset = INITIAL_PRESET_THEMES.find((p) => p.id === themeId);
    if (preset) {
      targetTheme = { ...preset, status: 'active' };
    }
  }

  if (!targetTheme) {
    throw new Error(`El tema "${themeId}" no existe.`);
  }

  const updatedTheme: ThemeModel = {
    ...targetTheme,
    status: 'active',
    updatedAt: now,
    updatedBy: user.email
  };

  try {
    // 2. Fetch all currently active themes to deactivate them
    const activeQuery = query(collection(db, COLLECTION_THEMES), where('status', '==', 'active'));
    const activeSnap = await getDocs(activeQuery);

    const batch = writeBatch(db);

    // Set global setting
    const configRef = doc(db, COLLECTION_SETTINGS, DOC_GLOBAL_CONFIG);
    batch.set(configRef, {
      activeThemeId: themeId,
      updatedAt: now,
      updatedBy: user.email
    }, { merge: true });

    // Mark target theme as active in Firestore
    const targetRef = doc(db, COLLECTION_THEMES, themeId);
    batch.set(targetRef, updatedTheme, { merge: true });

    // Deactivate any previously active themes
    activeSnap.forEach((d) => {
      if (d.id !== themeId) {
        batch.update(doc(db, COLLECTION_THEMES, d.id), {
          status: 'saved',
          updatedAt: now,
          updatedBy: user.email
        });
      }
    });

    await batch.commit();
  } catch (firestoreErr) {
    console.warn('Firestore theme update encountered an issue, continuing with local persistence:', firestoreErr);
  }

  // 3. Persist in localStorage and apply tokens & attributes to DOM
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(updatedTheme));
    localStorage.setItem(LOCAL_THEME_ID_KEY, themeId);
  }
  applyTokensToDom(updatedTheme.tokens, undefined, updatedTheme.id, updatedTheme.layoutStyle);

  // 4. Audit log
  try {
    await logAdminAction({
      businessId: 'global',
      adminId: user.uid,
      adminEmail: user.email,
      targetUserId: themeId,
      action: 'THEME_APPLIED',
      details: `Tema visual "${updatedTheme.name}" aplicado como tema global activo de Uwi (v${updatedTheme.version})`
    });
  } catch (auditErr) {
    console.warn('Theme audit log skipped:', auditErr);
  }

  return updatedTheme;
}

/**
 * Duplicates a theme.
 */
export async function duplicateTheme(
  sourceTheme: ThemeModel,
  user: { uid: string; email: string }
): Promise<ThemeModel> {
  const now = new Date().toISOString();
  const newId = `theme_copy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newName = `${sourceTheme.name} — Copia`;

  const duplicated: ThemeModel = {
    ...sourceTheme,
    id: newId,
    name: newName,
    description: sourceTheme.description ? `${sourceTheme.description} (Copia)` : undefined,
    subtitle: sourceTheme.subtitle,
    badge: 'Copia Personalizada',
    category: sourceTheme.category,
    layoutStyle: sourceTheme.layoutStyle,
    keyFeatures: sourceTheme.keyFeatures ? [...sourceTheme.keyFeatures] : undefined,
    status: 'saved',
    version: 1,
    isPreset: false,
    tokens: JSON.parse(JSON.stringify(sourceTheme.tokens)), // Deep clone tokens
    createdAt: now,
    updatedAt: now,
    createdBy: user.email,
    updatedBy: user.email
  };

  const docRef = doc(db, COLLECTION_THEMES, newId);
  await setDoc(docRef, duplicated);

  // Audit log
  await logAdminAction({
    businessId: 'global',
    adminId: user.uid,
    adminEmail: user.email,
    targetUserId: newId,
    action: 'THEME_DUPLICATED',
    details: `Tema "${sourceTheme.name}" duplicado como "${newName}" (ID: ${newId})`
  });

  return duplicated;
}

/**
 * Archives a theme (cannot archive active theme).
 */
export async function archiveTheme(
  themeId: string,
  user: { uid: string; email: string }
): Promise<void> {
  const themeRef = doc(db, COLLECTION_THEMES, themeId);
  const snap = await getDoc(themeRef);
  if (!snap.exists()) {
    throw new Error('El tema a archivar no existe.');
  }

  const themeData = snap.data() as ThemeModel;
  if (themeData.status === 'active') {
    throw new Error('No es posible archivar el tema activo. Aplica otro tema antes de archivar este.');
  }

  const now = new Date().toISOString();
  await updateDoc(themeRef, {
    status: 'archived',
    updatedAt: now,
    updatedBy: user.email
  });

  await logAdminAction({
    businessId: 'global',
    adminId: user.uid,
    adminEmail: user.email,
    targetUserId: themeId,
    action: 'THEME_ARCHIVED',
    details: `Tema visual "${themeData.name}" archivado`
  });
}

/**
 * Restores an archived theme to saved state.
 */
export async function unarchiveTheme(
  themeId: string,
  user: { uid: string; email: string }
): Promise<void> {
  const themeRef = doc(db, COLLECTION_THEMES, themeId);
  const now = new Date().toISOString();
  await updateDoc(themeRef, {
    status: 'saved',
    updatedAt: now,
    updatedBy: user.email
  });
}

/**
 * Deletes a custom theme (presets or active themes cannot be deleted).
 */
export async function deleteTheme(
  themeId: string,
  user: { uid: string; email: string }
): Promise<void> {
  const themeRef = doc(db, COLLECTION_THEMES, themeId);
  const snap = await getDoc(themeRef);
  if (!snap.exists()) return;

  const data = snap.data() as ThemeModel;
  if (data.status === 'active') {
    throw new Error('No es posible eliminar el tema activo de Uwi.');
  }

  await deleteDoc(themeRef);

  await logAdminAction({
    businessId: 'global',
    adminId: user.uid,
    adminEmail: user.email,
    targetUserId: themeId,
    action: 'THEME_DELETED',
    details: `Tema visual "${data.name}" eliminado definitivamente`
  });
}

/**
 * Returns a ThemeModel by themeId from presets or returns PRESET_UWI_CLEAN fallback.
 */
export function getThemeModelById(themeId?: string | null): ThemeModel {
  if (!themeId) return PRESET_UWI_CLEAN;
  const match = INITIAL_PRESET_THEMES.find((p) => p.id === themeId);
  if (match) return match;
  return PRESET_UWI_CLEAN;
}

/**
 * Gets the active theme for a specific Business (multi-tenant isolated).
 * For a new Administrator or business without a configured theme, initializes with UWI Soft (PRESET_UWI_SOFT).
 * For existing businesses with a saved preference, strictly respects and returns the saved theme.
 */
export async function getBusinessTheme(
  businessId: string,
  cachedThemeId?: string | null,
  userProfile?: { role: string; email: string; uid?: string } | null
): Promise<ThemeModel> {
  if (!businessId) return PRESET_UWI_SOFT;

  // 1. Check passed cached themeId (from business object in memory)
  if (cachedThemeId) {
    const found = getThemeModelById(cachedThemeId);
    if (found) return found;
  }

  // 2. Check localStorage business cache
  if (typeof window !== 'undefined') {
    try {
      const localId = localStorage.getItem(`uwi_business_theme_${businessId}`);
      if (localId) {
        const found = getThemeModelById(localId);
        if (found) return found;
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  // 3. Query Firestore business doc
  try {
    const bizDoc = await getDoc(doc(db, 'businesses', businessId));
    if (bizDoc.exists()) {
      const data = bizDoc.data();
      const themeId = data?.visualTheme?.themeId || data?.themeId;
      if (themeId) {
        const found = getThemeModelById(themeId);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`uwi_business_theme_${businessId}`, themeId);
          } catch {
            // Ignore
          }
        }
        return found;
      }
    }
  } catch (err) {
    console.warn('[getBusinessTheme] Error reading business theme from Firestore:', err);
  }

  // 4. No theme configured yet:
  // Official initial default theme for new businesses and Administrators is UWI Soft
  const defaultTheme = PRESET_UWI_SOFT;
  const initialThemeId = 'uwi-soft';

  // Cache locally
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`uwi_business_theme_${businessId}`, initialThemeId);
    } catch {
      // Ignore
    }
  }

  // If the user has ADMIN role, persist this initial preference to Firestore so subsequent logins preserve it
  if (userProfile?.role === 'ADMIN') {
    try {
      const now = new Date().toISOString();
      const bizRef = doc(db, 'businesses', businessId);
      await updateDoc(bizRef, {
        'visualTheme.themeId': initialThemeId,
        'visualTheme.updatedAt': now,
        'visualTheme.updatedBy': userProfile.email || 'initial_admin_setup',
        themeId: initialThemeId,
        updatedAt: now
      });
    } catch (persistErr) {
      console.warn('[getBusinessTheme] Could not persist initial uwi-soft theme:', persistErr);
    }
  }

  return defaultTheme;
}

/**
 * Applies a theme to a specific business.
 * Persists in Firestore businesses/{businessId}, updates localStorage, and applies tokens to DOM.
 */
export async function applyBusinessTheme(
  businessId: string,
  themeId: string,
  user: { uid: string; email: string; role?: string }
): Promise<ThemeModel> {
  if (!businessId) {
    throw new Error('Identificador de negocio requerido.');
  }
  if (user.role === 'SELLER') {
    throw new Error('Los vendedores no tienen permisos para modificar la apariencia del negocio.');
  }

  const targetTheme = getThemeModelById(themeId);
  const now = new Date().toISOString();

  // 1. Update Firestore businesses doc
  try {
    const bizRef = doc(db, 'businesses', businessId);
    await updateDoc(bizRef, {
      'visualTheme.themeId': themeId,
      'visualTheme.updatedAt': now,
      'visualTheme.updatedBy': user.email,
      themeId: themeId,
      updatedAt: now
    });
  } catch (err: any) {
    console.error('Error updating business visual theme in Firestore:', err);
    throw new Error('No se pudo guardar la apariencia del negocio en el servidor. Intenta nuevamente.');
  }

  // 2. Cache in localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`uwi_business_theme_${businessId}`, themeId);
    } catch {
      // Ignore
    }
  }

  // 3. Apply tokens to DOM
  applyTokensToDom(targetTheme.tokens, undefined, targetTheme.id, targetTheme.layoutStyle);

  // 4. Audit Log
  try {
    await logAdminAction({
      businessId,
      adminId: user.uid,
      adminEmail: user.email,
      targetUserId: businessId,
      action: 'BUSINESS_THEME_UPDATED',
      details: `Tema visual del negocio actualizado a "${targetTheme.name}" (${themeId})`
    });
  } catch (auditErr) {
    console.warn('Audit log error on theme update:', auditErr);
  }

  return targetTheme;
}

