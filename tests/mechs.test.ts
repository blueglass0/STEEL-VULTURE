import { describe, expect, it } from 'vitest';
import { CHASSIS } from '../src/data/chassis';
import { ENEMIES } from '../src/data/enemies';
import { EQUIPMENT } from '../src/data/equipment';
import { WEAPONS } from '../src/data/weapons';
import { fitsMount, mechStats } from '../src/game/mechStats';
import { SECTIONS, SectionDamage } from '../src/game/units/SectionDamage';
import { DEG } from '../src/core/math';

type Weapons = { mount: string; weapon: string }[];

/** Every weapon sits on a mount that exists and fits it, at most one per mount. */
function mountProblems(chassis: string, weapons: Weapons): string[] {
  const mounts = CHASSIS[chassis].mounts;
  const out: string[] = [];
  const used = new Set<string>();
  for (const w of weapons) {
    const mount = mounts.find((m) => m.id === w.mount);
    const def = WEAPONS[w.weapon];
    if (!def) out.push(`unknown weapon ${w.weapon}`);
    else if (!mount) out.push(`unknown mount ${w.mount}`);
    else if (!fitsMount(def, mount)) out.push(`${w.weapon} doesn't fit ${w.mount}`);
    if (used.has(w.mount)) out.push(`two weapons on ${w.mount}`);
    used.add(w.mount);
  }
  return out;
}

function limitProblems(l: { chassis: string; weapons: Weapons; equipment: string[] }): string[] {
  const st = mechStats({ ...l, weapons: l.weapons.map((w) => ({ ...w, group: 1 as const })) });
  const out: string[] = [];
  if (st.tonnage > st.maxTonnage) out.push(`too heavy ${st.tonnage}/${st.maxTonnage}`);
  if (st.powerDraw > st.powerOutput) out.push(`not enough power ${st.powerDraw}/${st.powerOutput}`);
  if (st.slotsUsed > st.slots) out.push(`too many slots ${st.slotsUsed}/${st.slots}`);
  if (st.reactors.length > 1) out.push('more than one reactor');
  return out;
}

describe('stock loadouts', () => {
  for (const [id, c] of Object.entries(CHASSIS)) {
    it(`${id} stock loadout is legal`, () => {
      expect(mountProblems(id, c.stock.weapons)).toEqual([]);
      expect(c.stock.equipment.every((e) => EQUIPMENT[e])).toBe(true);
      expect(limitProblems({ chassis: id, ...c.stock })).toEqual([]);
    });
  }
});

describe('enemy mech loadouts', () => {
  for (const [id, e] of Object.entries(ENEMIES)) {
    if (!e.mech) continue;
    const m = e.mech;
    it(`${id} fits its chassis and powers its weapons`, () => {
      expect(CHASSIS[m.chassis]).toBeDefined();
      expect(mountProblems(m.chassis, m.weapons)).toEqual([]);
      expect(m.equipment.every((x) => EQUIPMENT[x])).toBe(true);
      const st = mechStats({ chassis: m.chassis, weapons: m.weapons, equipment: m.equipment });
      expect(st.powerDraw).toBeLessThanOrEqual(st.powerOutput);
      // Keep big enemy mechs inside the 100-unit gap between obstacles.
      expect(CHASSIS[m.chassis].radius * (m.sizeScale ?? 1) * 2).toBeLessThan(100);
    });
  }
});

describe('mechStats', () => {
  it('adds equipment to the base chassis numbers', () => {
    const base = mechStats({ chassis: 'vulture', weapons: [], equipment: [] });
    const more = mechStats({ chassis: 'vulture', weapons: [], equipment: ['heatSink', 'standardReactor'] });
    expect(more.tonnage).toBeGreaterThan(base.tonnage);
    expect(more.dissipation).toBeGreaterThan(base.dissipation);
    expect(more.powerOutput).toBe(base.powerOutput + EQUIPMENT.standardReactor.output!);
  });
});

describe('SectionDamage', () => {
  const max = { torso: 100, leftArm: 60, rightArm: 60, legs: 80 };

  it('picks sections by hit angle', () => {
    expect(SectionDamage.sectionFor(0)).toEqual({ section: 'torso', rear: false });
    expect(SectionDamage.sectionFor(90 * DEG).section).toBe('rightArm');
    expect(SectionDamage.sectionFor(-90 * DEG).section).toBe('leftArm');
    expect(SectionDamage.sectionFor(180 * DEG)).toEqual({ section: 'torso', rear: true });
  });

  it('never loses or invents damage on a frontal hit', () => {
    const d = new SectionDamage(max);
    d.apply(20, 0);
    const lost = SECTIONS.reduce((t, s) => t + (max[s] - d.hp[s]), 0);
    expect(lost).toBeCloseTo(20);
    expect(d.hp.legs).toBeLessThan(max.legs);
  });

  it('carries damage past a destroyed arm into the torso', () => {
    const d = new SectionDamage(max);
    const r = d.apply(200, 90 * DEG);
    expect(d.hp.rightArm).toBe(0);
    expect(r.destroyed).toContain('rightArm');
    expect(d.hp.torso).toBeLessThan(max.torso);
  });

  it('hits harder from behind', () => {
    const front = new SectionDamage(max);
    const rear = new SectionDamage(max);
    front.apply(20, 0);
    rear.apply(20, Math.PI);
    expect(rear.hp.torso).toBeLessThan(front.hp.torso);
  });
});
