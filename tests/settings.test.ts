import { describe, expect, it } from 'vitest';
import { BUTTON_SCALE, sanitizeSettings } from '../src/core/settings';

describe('sanitizeSettings', () => {
  const defaults = sanitizeSettings(null);

  it('returns defaults for missing or non-object data', () => {
    for (const bad of [null, undefined, 42, 'x', true]) expect(sanitizeSettings(bad)).toEqual(defaults);
    expect(defaults.volume).toBe(0.8);
    expect(defaults.touchFire).toBe('tiers');
  });

  it('keeps valid values', () => {
    const s = sanitizeSettings({
      scheme: { kbm: 'direction', touch: 'tank' },
      muted: true,
      fog: 'dark',
      volume: 0.3,
      quality: 'low',
      shake: false,
      showFps: true,
      touchFire: 'swap',
      buttonScale: 1.2,
      tutorialSeen: true,
    });
    expect(s).toEqual({
      scheme: { kbm: 'direction', touch: 'tank' },
      muted: true,
      fog: 'dark',
      volume: 0.3,
      quality: 'low',
      shake: false,
      showFps: true,
      touchFire: 'swap',
      buttonScale: 1.2,
      tutorialSeen: true,
    });
  });

  it('clamps numbers to their ranges', () => {
    expect(sanitizeSettings({ volume: 7 }).volume).toBe(1);
    expect(sanitizeSettings({ volume: -1 }).volume).toBe(0);
    expect(sanitizeSettings({ buttonScale: 5 }).buttonScale).toBe(BUTTON_SCALE.max);
    expect(sanitizeSettings({ buttonScale: 0.1 }).buttonScale).toBe(BUTTON_SCALE.min);
  });

  it('replaces wrong types, unknown enum values and NaN with defaults', () => {
    const s = sanitizeSettings({
      scheme: { kbm: 'joystick', touch: 3 },
      muted: 'yes',
      fog: 'purple',
      volume: Number.NaN,
      quality: 'ultra',
      shake: 1,
      touchFire: 'all',
      buttonScale: '1.2',
      extra: 'ignored',
    });
    expect(s).toEqual(defaults);
    expect('extra' in s).toBe(false);
  });

  it('fills in fields missing from older settings', () => {
    const s = sanitizeSettings({ scheme: { kbm: 'direction' }, muted: true });
    expect(s.scheme).toEqual({ kbm: 'direction', touch: defaults.scheme.touch });
    expect(s.muted).toBe(true);
    expect(s.quality).toBe(defaults.quality);
  });
});
