/**
 * Installable offline app: registers the service worker (production builds only; it caches
 * the whole game), keeps the browser's install prompt for an "Install app" button, and asks
 * for persistent storage once installed so the career save isn't evicted.
 */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let listener: (() => void) | null = null;

export function initPwa(): void {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    const register = () => navigator.serviceWorker.register('./sw.js').catch(() => undefined);
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep it for our own button instead of the browser's banner.
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listener?.();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listener?.();
  });
  if (isInstalled()) navigator.storage?.persist?.().catch(() => undefined);
}

/** Running as an installed app (home screen icon), not in a browser tab. */
export function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * How this browser can install the game: 'prompt' (Chrome, Edge, Samsung Internet: a real
 * install dialog), 'ios' (Safari: only by hand, Share → Add to Home Screen), or null.
 */
export function installMode(): 'prompt' | 'ios' | null {
  if (isInstalled()) return null;
  if (deferred) return 'prompt';
  return isIos() ? 'ios' : null;
}

/** Show the browser's install dialog (only in 'prompt' mode). */
export async function promptInstall(): Promise<void> {
  const e = deferred;
  if (!e) return;
  deferred = null;
  await e.prompt();
  await e.userChoice.catch(() => undefined);
  listener?.();
}

/** Called when `installMode()` may have changed (one listener: the title screen). */
export function onInstallChange(fn: (() => void) | null): void {
  listener = fn;
}
