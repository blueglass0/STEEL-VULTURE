import { describe, expect, it } from 'vitest';
import { CHASSIS, CHASSIS_ORDER } from '../src/data/chassis';
import { ENEMIES } from '../src/data/enemies';
import { EQUIPMENT } from '../src/data/equipment';
import { FACTION_ORDER, FACTIONS, OPEN_MARKET } from '../src/data/factions';
import { SHOP_STOCK } from '../src/data/economy';
import { MISSION_TYPES } from '../src/data/missions';
import { TERRAIN } from '../src/data/terrain';
import { WEAPONS } from '../src/data/weapons';

const isItem = (id: string) => !!(WEAPONS[id] || EQUIPMENT[id] || CHASSIS[id]);

describe('data integrity', () => {
  it('ids match their keys and are unique across weapons, equipment and chassis', () => {
    const seen = new Set<string>();
    for (const table of [WEAPONS, EQUIPMENT, CHASSIS, ENEMIES] as Record<string, { id: string }>[]) {
      for (const [key, def] of Object.entries(table)) expect(def.id, key).toBe(key);
    }
    for (const id of [...Object.keys(WEAPONS), ...Object.keys(EQUIPMENT), ...Object.keys(CHASSIS)]) {
      expect(seen.has(id), `duplicate id ${id}`).toBe(false);
      seen.add(id);
    }
  });

  it('every chassis is in the hangar order', () => {
    expect([...CHASSIS_ORDER].sort()).toEqual(Object.keys(CHASSIS).sort());
  });

  it('shops only sell things that exist', () => {
    for (const id of [...OPEN_MARKET, ...SHOP_STOCK]) expect(isItem(id), id).toBe(true);
    for (const f of FACTION_ORDER) for (const e of FACTIONS[f].shop) expect(isItem(e.item), `${f}: ${e.item}`).toBe(true);
  });

  it('every player weapon can be bought somewhere', () => {
    const sold = new Set([...OPEN_MARKET, ...FACTION_ORDER.flatMap((f) => FACTIONS[f].shop.map((e) => e.item))]);
    // Weapons carried by tanks, turrets and drones are theirs alone.
    const vehicleOnly = new Set(Object.values(ENEMIES).filter((e) => e.kind !== 'mech' && e.weapon).map((e) => e.weapon as string));
    for (const id of Object.keys(WEAPONS)) {
      if (vehicleOnly.has(id) && !sold.has(id) && !SHOP_STOCK.includes(id)) continue;
      expect(sold.has(id), id).toBe(true);
    }
  });

  it('enemy units reference real weapons and textures, armies reference real units', () => {
    for (const [id, e] of Object.entries(ENEMIES)) {
      if (e.weapon) expect(WEAPONS[e.weapon], `${id}.weapon`).toBeDefined();
      if (e.kind === 'mech') expect(e.mech, id).toBeDefined();
    }
    for (const f of FACTION_ORDER) {
      const a = FACTIONS[f].army;
      for (const t of a.tankTypes) expect(ENEMIES[t.type]?.kind, `${f} tank ${t.type}`).toBe('tank');
      for (const t of a.turretTypes) expect(ENEMIES[t]?.kind, `${f} turret ${t}`).toBe('turret');
      for (const tier of [1, 2, 3] as const) for (const m of a.mechTypes[tier]) expect(ENEMIES[m.type]?.kind, `${f} mech ${m.type}`).toBe('mech');
    }
  });

  it('weapons have sane numbers', () => {
    for (const [id, w] of Object.entries(WEAPONS)) {
      expect(w.damage, id).toBeGreaterThan(0);
      expect(w.range, id).toBeGreaterThan(0);
      expect(w.tonnage, id).toBeGreaterThanOrEqual(0);
      expect(w.price, id).toBeGreaterThanOrEqual(0);
    }
  });

  it('terrain types are complete', () => {
    for (const [id, t] of Object.entries(TERRAIN)) expect(t.hp, id).toBeGreaterThan(0);
  });

  it('contracts never roll the tutorial', () => {
    expect(MISSION_TYPES.tutorial.weight).toBe(0);
    expect(Object.values(MISSION_TYPES).some((m) => m.weight > 0)).toBe(true);
  });
});
