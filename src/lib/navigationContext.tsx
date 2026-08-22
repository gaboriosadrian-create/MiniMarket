import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  isActive?: boolean;
  onClick: () => void;
  badge?: string | number;
  color?: string;
}

type BackActionHandler = () => boolean | void;

interface NavigationContextType {
  navItems: NavItem[];
  setNavItems: (items: NavItem[]) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  registerBackAction: (handler: BackActionHandler) => () => void;
}

const NavigationContext = createContext<NavigationContextType>({
  navItems: [],
  setNavItems: () => {},
  isSidebarCollapsed: false,
  setIsSidebarCollapsed: () => {},
  toggleSidebar: () => {},
  isMobileMenuOpen: false,
  setIsMobileMenuOpen: () => {},
  toggleMobileMenu: () => {},
  registerBackAction: () => () => {},
});

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Stack of back action handlers (LIFO)
  const backHandlersRef = useRef<BackActionHandler[]>([]);
  const isMenuPushedRef = useRef(false);

  const registerBackAction = useCallback((handler: BackActionHandler) => {
    backHandlersRef.current.push(handler);
    // Push a dummy history state so hardware back button triggers popstate
    try {
      window.history.pushState({ minimarketBackStack: backHandlersRef.current.length }, '');
    } catch {
      // Ignore if history pushState is restricted
    }

    return () => {
      backHandlersRef.current = backHandlersRef.current.filter((h) => h !== handler);
    };
  }, []);

  const handleSetIsMobileMenuOpen = useCallback((open: boolean) => {
    setIsMobileMenuOpen((prev) => {
      if (prev === open) return prev;
      if (open) {
        try {
          window.history.pushState({ minimarketMobileMenu: true }, '');
          isMenuPushedRef.current = true;
        } catch {
          // Ignore
        }
      } else if (isMenuPushedRef.current) {
        isMenuPushedRef.current = false;
      }
      return open;
    });
  }, []);

  const toggleSidebar = () => setIsSidebarCollapsed((prev) => !prev);
  const toggleMobileMenu = () => {
    handleSetIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Global popstate handler to capture physical/browser back button on mobile
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // 1. Check custom back handlers (modals, wizards, active filters, etc.)
      if (backHandlersRef.current.length > 0) {
        const topHandler = backHandlersRef.current.pop();
        if (topHandler) {
          const handled = topHandler();
          // If handled was explicitly false, put it back or let default flow continue
          if (handled !== false) {
            e.preventDefault();
            return;
          }
        }
      }

      // 2. If mobile drawer menu was open, close it without leaving the app
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
        isMenuPushedRef.current = false;
        e.preventDefault();
        return;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isMobileMenuOpen]);

  return (
    <NavigationContext.Provider
      value={{
        navItems,
        setNavItems,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        toggleSidebar,
        isMobileMenuOpen,
        setIsMobileMenuOpen: handleSetIsMobileMenuOpen,
        toggleMobileMenu,
        registerBackAction,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => useContext(NavigationContext);

/**
 * Hook to intercept the mobile physical/browser "Back" button
 * when a modal, overlay, or multi-step wizard is active.
 */
export function useMobileBackHandler(isActive: boolean, onBack: () => void) {
  const { registerBackAction } = useNavigation();

  useEffect(() => {
    if (!isActive) return;
    const unregister = registerBackAction(() => {
      onBack();
      return true;
    });
    return () => {
      unregister();
    };
  }, [isActive, onBack, registerBackAction]);
}
