import { describe, expect, it } from 'vitest';
import { CHASSIS, CHASSIS_ORDER } from '../src/data/chassis';
import { ENEMIES } from '../src/data/enemies';
import { balanceReport, enemyNumbers, loadoutNumbers, outliers, playerWeapons, weaponNumbers } from '../src/game/balance';
import { WEAPONS } from '../src/data/weapons';

describe('balance numbers', () => {
  it('are finite and positive for every player weapon', () => {
    for (const w of playerWeapons()) {
      const n = weaponNumbers(w);
      expect(n.dps, w.id).toBeGreaterThan(0);
      expect(Number.isFinite(n.dps), w.id).toBe(true);
      expect(n.heatPerSec, w.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('count a whole missile salvo and stream damage per second', () => {
    const pack = WEAPONS.missilePack;
    expect(weaponNumbers(pack).dps).toBeCloseTo(pack.damage * pack.missile!.salvo * pack.fireRate);
    const beam = Object.values(WEAPONS).find((w) => w.delivery === 'stream')!;
    expect(weaponNumbers(beam).dps).toBe(beam.damage);
  });

  it('work out stock mechs and every enemy', () => {
    for (const id of CHASSIS_ORDER) {
      const n = loadoutNumbers({ chassis: id, ...CHASSIS[id].stock });
      expect(n.sustainedDps, id).toBeGreaterThan(0);
      expect(n.sustained, id).toBeLessThanOrEqual(1);
      expect(n.effectiveHp, id).toBeGreaterThan(CHASSIS[id].sections.torso);
    }
    for (const e of Object.values(ENEMIES)) {
      const n = enemyNumbers(e);
      expect(Number.isFinite(n.hp), e.id).toBe(true);
    }
  });

  it('flags values far from their group median', () => {
    const items = [1, 1.1, 1, 0.9, 3, 0.3].map((v, i) => ({ v, i }));
    const m = outliers(items, (x) => x.v, () => 'all');
    expect(m.get(items[4])).toBe('high');
    expect(m.get(items[5])).toBe('low');
    expect(m.has(items[0])).toBe(false);
  });

  it('builds the report', () => {
    const md = balanceReport();
    expect(md).toContain('## Weapons');
    expect(md).not.toContain('NaN');
  });
});
