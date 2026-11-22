import { beforeEach, describe, expect, it } from 'vitest';
import {
  SAVE_VERSION,
  buyChassis,
  checkLoadout,
  completeMission,
  deploy,
  install,
  installEquipment,
  itemSource,
  loadCareer,
  loadNotes,
  newCareer,
  refreshContracts,
  removeEquipment,
  saveCareer,
  saveUnreadable,
  shopStatus,
  totalRepairCost,
  upgradeSave,
} from '../src/career/career';
import type { CareerState, MissionOutcome } from '../src/career/types';
import { CHASSIS } from '../src/data/chassis';
import { ECONOMY } from '../src/data/economy';
import { EQUIPMENT } from '../src/data/equipment';
import { FACTION_ORDER, FACTIONS, REPUTATION } from '../src/data/factions';

const SAVE_KEY = 'steel-vulture.career.v1';
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

beforeEach(() => {
  loadNotes.length = 0;
});

describe('new career', () => {
  it('starts with one deployable stock Vulture and a full contract board', () => {
    const s = newCareer('normal', 'normal');
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.mechs).toHaveLength(1);
    expect(s.mechs[0].chassis).toBe('vulture');
    expect(checkLoadout(s.mechs[0]).ok).toBe(true);
    expect(s.contracts.length).toBeGreaterThan(0);
    for (const k of s.contracts) {
      expect(k.employerFaction).toBeDefined();
      expect(k.enemyFaction).toBeDefined();
      expect(k.employerFaction).not.toBe(k.enemyFaction);
      expect(k.payout).toBeGreaterThan(0);
    }
  });

  it('survives a save and load unchanged', () => {
    const s = newCareer('hard', 'easy');
    saveCareer(s);
    expect(loadCareer()).toEqual(s);
    expect(loadNotes).toEqual([]);
  });
});

describe('save upgrades', () => {
  /** A save from before the hangar, equipment and factions: version 1, one `mech`. */
  function legacySave(): Record<string, unknown> {
    const s = clone(newCareer('normal', 'normal')) as unknown as Record<string, unknown>;
    const mech = (s.mechs as Record<string, unknown>[])[0];
    delete mech.id;
    delete mech.equipment;
    s.mech = mech;
    delete s.mechs;
    delete s.activeMechId;
    delete s.backupIds;
    delete s.nextMechId;
    delete s.reputation;
    for (const k of s.contracts as Record<string, unknown>[]) {
      delete k.employerFaction;
      delete k.enemyFaction;
    }
    s.version = 1;
    return s;
  }

  it('upgrades a version-1 save to the current format', () => {
    const s = upgradeSave(legacySave());
    expect(s).not.toBeNull();
    const c = s as CareerState;
    expect(c.version).toBe(SAVE_VERSION);
    expect(c.mechs).toHaveLength(1);
    expect(c.mechs[0].id).toBe(1);
    expect(c.activeMechId).toBe(1);
    expect(c.backupIds).toEqual([]);
    expect(c.nextMechId).toBe(2);
    expect(c.mechs[0].equipment).toEqual(['standardReactor', 'heatSink']);
    expect(c.reputation).toEqual({ royalists: 0, technocrats: 0, freestars: 0 });
    expect(c.contracts.every((k) => k.employerFaction !== undefined)).toBe(true);
    expect(checkLoadout(c.mechs[0]).ok).toBe(true);
  });

  it('loads an upgraded save from storage, and it stays loadable', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(legacySave()));
    const s = loadCareer() as CareerState;
    expect(s.version).toBe(SAVE_VERSION);
    saveCareer(s);
    expect(loadCareer()).toEqual(s);
  });

  it('keeps a mid-mission board (the reload counts as a withdrawal elsewhere)', () => {
    const old = legacySave();
    const contracts = clone(old.contracts);
    old.activeContract = (contracts as { id: number }[])[0].id;
    const s = upgradeSave(old) as CareerState;
    expect(s.contracts).toEqual(contracts);
  });

  it('moves weapons that no longer fit their mount to storage, with a note', () => {
    const s = clone(newCareer('normal', 'normal'));
    s.mechs[0].weapons[0] = { mount: 'la-b', weapon: 'heavyCannon', group: 1 }; // large gun, medium mount
    s.mechs[0].weapons.push({ mount: 'gone', weapon: 'laser', group: 2 }); // mount no longer exists
    const up = upgradeSave(s) as CareerState;
    expect(up.mechs[0].weapons.map((w) => w.weapon)).toEqual(['machineGun', 'laser']);
    expect(up.inventory).toEqual(['heavyCannon', 'laser']);
    expect(loadNotes).toHaveLength(2);
  });

  it('drops items that no longer exist and clamps armor and ammo to the loadout', () => {
    const s = clone(newCareer('normal', 'normal'));
    s.inventory.push('removedGadget', 'laser');
    s.mechs[0].equipment.push('removedGadget');
    s.mechs[0].sections.torso = 1e6;
    s.mechs[0].ammo.ballistic = 1e6;
    const up = upgradeSave(s) as CareerState;
    expect(up.inventory).toEqual(['laser']);
    expect(up.mechs[0].equipment).toEqual(['standardReactor', 'heatSink']);
    expect(up.mechs[0].sections.torso).toBeLessThan(1e6);
    expect(up.mechs[0].ammo.ballistic).toBeLessThan(1e6);
  });

  it('rejects saves from a newer game, and data that is not a career', () => {
    const s = clone(newCareer('normal', 'normal'));
    s.version = SAVE_VERSION + 1;
    expect(upgradeSave(s)).toBeNull();
    for (const bad of [null, 'text', 3, {}, { version: 0 }, { version: '2' }, { version: 2, mechs: [] }]) expect(upgradeSave(bad)).toBeNull();
    localStorage.setItem(SAVE_KEY, '{not json');
    expect(loadCareer()).toBeNull();
    expect(saveUnreadable).toBe(true);
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    expect(loadCareer()).toBeNull();
    expect(saveUnreadable).toBe(true);
    localStorage.removeItem(SAVE_KEY);
    expect(loadCareer()).toBeNull();
    expect(saveUnreadable).toBe(false);
  });
});

describe('contracts and missions', () => {
  function outcome(s: CareerState, won: boolean): MissionOutcome {
    return {
      won,
      withdrew: false,
      bonusAchieved: false,
      time: 100,
      kills: 3,
      targetsDestroyed: won ? 3 : 0,
      targetsTotal: 3,
      damageDealt: 500,
      damageTaken: 100,
      shots: 50,
      hits: 30,
      ammoUsed: 40,
      mechs: [clone(s.mechs[0])],
      backupsUsed: 0,
      fieldCosts: [],
    };
  }

  /** A contract the starter mech may take (some boards roll a tonnage limit below it). */
  function openContract(s: CareerState) {
    const k = s.contracts[0];
    delete k.maxTonnage;
    return k;
  }

  it('deploys, pays a win and moves reputation', () => {
    const s = newCareer('normal', 'normal');
    const k = openContract(s);
    const before = s.money;
    const cfg = deploy(s, k.id, { ballistic: 0, missile: 0 });
    expect(cfg).not.toBeNull();
    expect(s.activeContract).toBe(k.id);
    expect(s.money).toBeLessThan(before);
    const afterDeploy = s.money;
    const d = completeMission(s, k, outcome(s, true));
    expect(s.activeContract).toBeNull();
    expect(s.money).toBe(afterDeploy + k.payout);
    expect(d.net).toBe(k.payout);
    expect(s.reputation[k.employerFaction!]).toBe(REPUTATION.win[k.tier]);
    expect(s.reputation[k.enemyFaction!]).toBe(REPUTATION.fought[k.tier]);
    expect(s.stats).toMatchObject({ missions: 1, wins: 1 });
    expect(s.contracts.every((c) => c.id !== k.id)).toBe(true);
  });

  it('pays nothing for a loss and charges field services', () => {
    const s = newCareer('normal', 'normal');
    const k = openContract(s);
    expect(deploy(s, k.id, { ballistic: 0, missile: 0 })).not.toBeNull();
    const money = s.money;
    const o = outcome(s, false);
    o.fieldCosts = [{ label: 'Field repairs', amount: 1234 }];
    completeMission(s, k, o);
    expect(s.money).toBe(money - 1234);
    expect(s.reputation[k.employerFaction!]).toBe(REPUTATION.failed);
  });

  it('softens tanks, turrets and drones on low-risk work but not enemy mechs', () => {
    for (const tier of [1, 2, 3] as const) {
      const s = newCareer('normal', 'normal');
      const k = openContract(s);
      k.tier = tier;
      const cfg = deploy(s, k.id, { ballistic: 0, missile: 0 })!;
      expect(cfg.enemyDamage).toBe(1);
      expect(cfg.vehicleDamage).toBe(ECONOMY.tiers[tier].vehicleDamage);
    }
    expect(ECONOMY.tiers[1].vehicleDamage).toBeLessThan(ECONOMY.tiers[3].vehicleDamage);
  });

  it('refuses to deploy a mech over the contract tonnage', () => {
    const s = newCareer('normal', 'normal');
    s.money = 1e7;
    const roc = buyChassis(s, 'roc')!;
    s.activeMechId = roc.id;
    const k = s.contracts[0];
    k.maxTonnage = 40;
    expect(deploy(s, k.id, { ballistic: 0, missile: 0 })).toBeNull();
  });

  it('rolls valid boards repeatedly', () => {
    const s = newCareer('normal', 'normal');
    for (let i = 0; i < 50; i++) {
      refreshContracts(s);
      for (const k of s.contracts) {
        expect([1, 2, 3]).toContain(k.tier);
        expect(k.mission).not.toBe('tutorial');
        if (k.mission === 'hunt') expect(k.ace).toBeDefined();
      }
    }
  });
});

describe('shop', () => {
  it('gates faction items behind reputation and hostility', () => {
    const s = newCareer('normal', 'normal');
    for (const f of FACTION_ORDER) {
      for (const e of FACTIONS[f].shop) {
        s.reputation[f] = e.rep;
        expect(shopStatus(s, e.item).available, `${e.item} at ${e.rep}`).toBe(true);
        if (e.rep > 0) {
          s.reputation[f] = e.rep - 1;
          expect(shopStatus(s, e.item).available).toBe(false);
        }
        s.reputation[f] = REPUTATION.hostileAt;
        expect(shopStatus(s, e.item).available).toBe(false);
      }
      s.reputation[f] = 0;
    }
  });

  it('armor plating brings its armor for free and takes it back when removed', () => {
    const s = newCareer('normal', 'normal');
    const m = s.mechs[0];
    const before = { ...m.sections };
    s.inventory.push('armorPlating');
    expect(installEquipment(s, m, 'armorPlating')).toBe(true);
    const plate = EQUIPMENT.armorPlating.armor!;
    expect(m.sections.torso).toBe(before.torso + plate.torso);
    expect(totalRepairCost(s, m)).toBe(0);
    // Damaged: removing and refitting must not repair anything.
    m.sections.leftArm -= 40;
    const damaged = { ...m.sections };
    expect(removeEquipment(s, m, m.equipment.indexOf('armorPlating'))).toBe('');
    expect(installEquipment(s, m, 'armorPlating')).toBe(true);
    expect(m.sections).toEqual(damaged);
    // Nearly stripped section: removal is refused rather than destroying it.
    m.sections.rightArm = 5;
    expect(removeEquipment(s, m, m.equipment.indexOf('armorPlating'))).toMatch(/right arm/);
    expect(m.equipment).toContain('armorPlating');
    // Destroyed sections stay destroyed.
    m.sections.rightArm = 0;
    m.sections.torso = damaged.torso;
    expect(removeEquipment(s, m, m.equipment.indexOf('armorPlating'))).toBe('');
    expect(m.sections.rightArm).toBe(0);
  });

  it('installs only weapons that fit the mount', () => {
    const s = newCareer('normal', 'normal');
    const m = s.mechs[0];
    s.inventory.push('heavyCannon', 'smallLaser');
    expect(install(s, m, 'la-e', 'heavyCannon')).toBe(false);
    expect(install(s, m, 'la-e', 'smallLaser')).toBe(true);
  });

  it('sells every chassis somewhere', () => {
    for (const id of Object.keys(CHASSIS)) expect(itemSource(id), id).not.toBeNull();
  });
});
