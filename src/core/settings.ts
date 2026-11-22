/**
 * Player preferences, kept in localStorage. Storage can be unavailable
 * (private mode, blocked site data), so every access is guarded and the
 * game falls back to defaults.
 */
export type ControlScheme = 'tank' | 'direction';
export type InputDevice = 'kbm' | 'touch';
/**
 * Phone firing with the right stick: 'tiers' (default) fires group 1 past the inner ring and
 * both groups when the thumb goes past the stick's edge; 'swap' fires the selected group (a
 * button switches it); 'both' fires every weapon past the ring.
 */
export type TouchFire = 'tiers' | 'swap' | 'both';

export interface Settings {
  /** Movement scheme per input device. */
  scheme: Record<InputDevice, ControlScheme>;
  muted: boolean;
  /** Fog of war look: 'faded' keeps terrain dimly visible outside your vision, 'dark' hides it. */
  fog: 'faded' | 'dark';
  /** Master volume 0..1. */
  volume: number;
  /** 'low' renders fewer pixels and fewer particles, for weak phones and laptops. */
  quality: 'high' | 'low';
  /** Camera shake from footsteps, hits and landings. */
  shake: boolean;
  /** Small frame-rate readout in the corner. */
  showFps: boolean;
  touchFire: TouchFire;
  /** Size of the phone buttons around the right stick (0.8..1.3). */
  buttonScale: number;
}

const KEY = 'steel-vulture.settings.v1';

function defaults(): Settings {
  return {
    scheme: { kbm: 'tank', touch: 'direction' },
    muted: false,
    fog: 'faded',
    volume: 0.8,
    quality: 'high',
    shake: true,
    showFps: false,
    touchFire: 'tiers',
    buttonScale: 1,
  };
}

/**
 * Stored settings → valid settings: unknown or wrong-typed values fall back to the defaults,
 * numbers are clamped to their slider ranges. Stored data can be old, hand-edited or corrupt.
 */
export function sanitizeSettings(data: unknown): Settings {
  const d = defaults();
  if (!data || typeof data !== 'object') return d;
  const raw = data as Record<string, unknown>;
  const pick = <T>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  const num = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const scheme = (raw.scheme && typeof raw.scheme === 'object' ? raw.scheme : {}) as Record<string, unknown>;
  const schemes = ['tank', 'direction'] as const;
  return {
    scheme: { kbm: pick(scheme.kbm, schemes, d.scheme.kbm), touch: pick(scheme.touch, schemes, d.scheme.touch) },
    muted: bool(raw.muted, d.muted),
    fog: pick(raw.fog, ['faded', 'dark'] as const, d.fog),
    volume: num(raw.volume, 0, 1, d.volume),
    quality: pick(raw.quality, ['high', 'low'] as const, d.quality),
    shake: bool(raw.shake, d.shake),
    showFps: bool(raw.showFps, d.showFps),
    touchFire: pick(raw.touchFire, ['tiers', 'swap', 'both'] as const, d.touchFire),
    buttonScale: num(raw.buttonScale, BUTTON_SCALE.min, BUTTON_SCALE.max, d.buttonScale),
  };
}

/** Range of the phone button size setting. */
export const BUTTON_SCALE = { min: 0.8, max: 1.3 };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return sanitizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return defaults();
  }
}

export const settings: Settings = load();

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Not fatal: the setting just won't survive a reload.
  }
}
