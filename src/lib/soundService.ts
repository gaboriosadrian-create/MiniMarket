/**
 * Notification Sound Service
 * Web Audio API synthesizer for short, pleasant, discrete notification chimes.
 * Respects browser autoplay policies and tracks played notification IDs so sound
 * is played exactly once per new notification.
 */

let audioCtx: AudioContext | null = null;
let isAudioUnlocked = false;

// Set of notification IDs that have already been played
const playedNotificationIds = new Set<string>();

/**
 * Initializes and unlocks the Web Audio Context on the first user interaction.
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    return audioCtx;
  } catch {
    return null;
  }
}

// Global user interaction listener to unlock audio safely on mobile/PWA
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'running') {
      isAudioUnlocked = true;
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    }
  };

  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
}

/**
 * Plays a discrete, pleasant dual-tone chime (e.g. 587Hz -> 880Hz)
 */
export function playNotificationSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;

    // Master Gain for smooth volume control (gentle volume)
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.12, now);
    masterGain.connect(ctx.destination);

    // Note 1: 587.33 Hz (D5) - soft marimba/bell timbre
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc1.connect(gain1);
    gain1.connect(masterGain);

    osc1.start(now);
    osc1.stop(now + 0.2);

    // Note 2: 880.00 Hz (A5) - crisp bright resolving chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.12);

    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.18, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    osc2.connect(gain2);
    gain2.connect(masterGain);

    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch (err) {
    // Silently ignore audio playback issues if blocked by browser
  }
}

/**
 * Checks a list of notifications, marks them as seen, and plays chime once if any new unread notification arrived.
 */
export function handleIncomingNotificationsSound(
  notifications: Array<{ id: string; read?: boolean; createdAt?: string }>,
  isInitialLoad: boolean
): void {
  if (!notifications || notifications.length === 0) return;

  if (isInitialLoad) {
    // Seed initial notifications so we don't play sound for existing past notifications
    notifications.forEach((n) => playedNotificationIds.add(n.id));
    return;
  }

  let hasNewUnread = false;

  for (const n of notifications) {
    if (!playedNotificationIds.has(n.id)) {
      playedNotificationIds.add(n.id);
      if (!n.read) {
        // Check if created recently (within last 3 minutes)
        if (n.createdAt) {
          const ageMs = Date.now() - new Date(n.createdAt).getTime();
          if (ageMs < 3 * 60 * 1000) {
            hasNewUnread = true;
          }
        } else {
          hasNewUnread = true;
        }
      }
    }
  }

  if (hasNewUnread) {
    playNotificationSound();
  }
}
