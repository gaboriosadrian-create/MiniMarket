import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ThemeModel, ThemeTokens, PRESET_UWI_CLEAN } from '../types/theme';
import { 
  getActiveTheme, 
  getAllThemes, 
  applyTheme, 
  applyTokensToDom, 
  getCachedTheme,
  getBusinessTheme,
  applyBusinessTheme,
  getThemeModelById 
} from './themeService';
import { UserProfile, Business } from '../types';

interface ThemeContextType {
  activeTheme: ThemeModel;
  currentTokens: ThemeTokens;
  allThemes: ThemeModel[];
  loading: boolean;
  refreshThemes: () => Promise<void>;
  applyThemeById: (themeId: string, user: { uid: string; email: string }) => Promise<ThemeModel>;
  applyBusinessThemeById: (
    businessId: string, 
    themeId: string, 
    user: { uid: string; email: string; role?: string }
  ) => Promise<ThemeModel>;
  syncThemeForUser: (userProfile: UserProfile | null, business: Business | null) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize with cached theme for zero flicker / instant boot
  const [activeTheme, setActiveTheme] = useState<ThemeModel>(() => {
    const cached = getCachedTheme();
    if (typeof window !== 'undefined') {
      applyTokensToDom(cached.tokens, undefined, cached.id, cached.layoutStyle);
    }
    return cached;
  });

  const [allThemes, setAllThemes] = useState<ThemeModel[]>([]);
  const [loading, setLoading] = useState(true);

  const loadThemes = useCallback(async () => {
    try {
      setLoading(true);
      const [fetchedActive, fetchedAll] = await Promise.all([
        getActiveTheme(),
        getAllThemes()
      ]);

      if (fetchedActive) {
        setActiveTheme(fetchedActive);
        applyTokensToDom(fetchedActive.tokens, undefined, fetchedActive.id, fetchedActive.layoutStyle);
      }
      setAllThemes(fetchedAll);
    } catch (err) {
      console.error('Error in ThemeProvider:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  // Apply Super Admin / Global Theme
  const applyThemeById = async (themeId: string, user: { uid: string; email: string }): Promise<ThemeModel> => {
    const updated = await applyTheme(themeId, user);
    setActiveTheme(updated);
    applyTokensToDom(updated.tokens, undefined, updated.id, updated.layoutStyle);
    await loadThemes();
    return updated;
  };

  // Apply Business Specific Theme (Multi-tenant isolated)
  const applyBusinessThemeById = async (
    businessId: string, 
    themeId: string, 
    user: { uid: string; email: string; role?: string }
  ): Promise<ThemeModel> => {
    const updated = await applyBusinessTheme(businessId, themeId, user);
    setActiveTheme(updated);
    applyTokensToDom(updated.tokens, undefined, updated.id, updated.layoutStyle);
    return updated;
  };

  // Synchronize theme based on active role and tenant context
  const syncThemeForUser = useCallback(async (userProfile: UserProfile | null, business: Business | null) => {
    if (!userProfile) {
      // Unauthenticated: Keep default / cached
      return;
    }

    if (userProfile.role === 'SUPER_ADMIN') {
      // Super Admin uses Global UWI Platform theme
      const globalActive = await getActiveTheme();
      setActiveTheme(globalActive);
      applyTokensToDom(globalActive.tokens, undefined, globalActive.id, globalActive.layoutStyle);
    } else if ((userProfile.role === 'ADMIN' || userProfile.role === 'SELLER') && userProfile.businessId) {
      // Business Admin & Sellers use the specific Business Theme
      const businessThemeId = business?.visualTheme?.themeId || business?.themeId;
      const bTheme = await getBusinessTheme(userProfile.businessId, businessThemeId, {
        role: userProfile.role,
        email: userProfile.email,
        uid: userProfile.uid
      });

      // Keep in-memory business synchronized if it was uninitialized
      if (business && !business.visualTheme?.themeId && !business.themeId) {
        business.visualTheme = {
          themeId: bTheme.id,
          updatedAt: new Date().toISOString(),
          updatedBy: userProfile.email
        };
        business.themeId = bTheme.id;
      }

      setActiveTheme(bTheme);
      applyTokensToDom(bTheme.tokens, undefined, bTheme.id, bTheme.layoutStyle);
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        activeTheme,
        currentTokens: activeTheme.tokens,
        allThemes,
        loading,
        refreshThemes: loadThemes,
        applyThemeById,
        applyBusinessThemeById,
        syncThemeForUser
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
