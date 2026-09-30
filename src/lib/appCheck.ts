import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider } from 'firebase/app-check';
import { app } from './firebase';

/**
 * Initializes Firebase App Check if site key is present in environment variables.
 * Gracefully bypasses if not configured, allowing seamless local development and previewing.
 */
export function initAppCheck(): void {
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  const isEnterprise = import.meta.env.VITE_RECAPTCHA_IS_ENTERPRISE === 'true';

  if (!recaptchaSiteKey || typeof window === 'undefined') {
    return;
  }

  try {
    if (import.meta.env.DEV) {
      // In development mode, App Check debug token can be enabled
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
    }

    const provider = isEnterprise
      ? new ReCaptchaEnterpriseProvider(recaptchaSiteKey)
      : new ReCaptchaV3Provider(recaptchaSiteKey);

    initializeAppCheck(app, {
      provider,
      isTokenAutoRefreshEnabled: true
    });
    console.log('[AppCheck] Initialized successfully.');
  } catch (err) {
    console.warn('[AppCheck] Initialization skipped or error:', err);
  }
}
