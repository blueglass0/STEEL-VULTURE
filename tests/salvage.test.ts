import { beforeEach, describe, expect, it } from 'vitest';
import {
  SAVE_VERSION,
  assembleChassis,
  assemblyFee,
  claimSalvage,
  completeMission,
  contractPay,
  deploy,
  loadNotes,
  newCareer,
  salvageExpected,
  sellPart,
  upgradeSave,
} from '../src/career/career';
import { rollSalvage, vehicleScrap } from '../src/career/salvage';
import type { CareerState, Contract, DestroyedUnit, MissionOutcome } from '../src/career/types';
import { Rng } from '../src/core/rng';
import { CHASSIS } from '../src/data/chassis';
import { ENEMIES } from '../src/data/enemies';
import { SALVAGE } from '../src/data/salvage';

beforeEach(() => {
  loadNotes.length = 0;
});

const trooper = ENEMIES.trooper.mech!;

function outcome(s: CareerState, won: boolean, destroyed: DestroyedUnit[]): MissionOutcome {
  return {
    won,
    withdrew: false,
    bonusAchieved: false,
    time: 100,
    kills: destroyed.length,
    targetsDestroyed: 3,
    targetsTotal: 3,
    damageDealt: 500,
    damageTaken: 0,
    shots: 1,
    hits: 1,
    ammoUsed: 0,
    mechs: [JSON.parse(JSON.stringify(s.mechs[0]))],
    backupsUsed: 0,
    fieldCosts: [],
    destroyed,
  };
}

/** A contract with an enemy mech, deployable by the starter mech. */
function mechContract(s: CareerState): Contract {
  const k = s.contracts[0];
  delete k.maxTonnage;
  k.enemyMechs = ['trooper'];
  return k;
}

describe('rolling salvage', () => {
  it('gives each enemy mech its chassis part and some of its gear, deterministically', () => {
    const wrecks: DestroyedUnit[] = [{ type: 'trooper' }, { type: 'lightTank' }];
    const a = rollSalvage(wrecks, new Rng(42));
    const b = rollSalvage(wrecks, new Rng(42));
    expect(a).toEqual(b);
    expect(a.filter((it) => it.kind === 'part')).toEqual([{ kind: 'part', id: trooper.chassis, from: ENEMIES.trooper.name }]);
    const gear = new Set([...trooper.weapons.map((w) => w.weapon), ...trooper.equipment]);
    for (const it of a.filter((x) => x.kind !== 'part')) expect(gear.has(it.id)).toBe(true);
  });

  it('roughly matches the survival chances, lower for weapons on a lost arm', () => {
    const mounts = CHASSIS[trooper.chassis].mounts;
    const armWeapons = trooper.weapons.filter((w) => mounts.find((m) => m.id === w.mount)?.section === 'leftArm').length;
    expect(armWeapons).toBeGreaterThan(0);
    const rng = new Rng(7);
    let intact = 0;
    let lost = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      intact += rollSalvage([{ type: 'trooper' }], rng).filter((it) => it.kind === 'weapon').length;
      lost += rollSalvage([{ type: 'trooper', lost: ['leftArm'] }], rng).filter((it) => it.kind === 'weapon').length;
    }
    expect(intact / n / trooper.weapons.length).toBeCloseTo(SALVAGE.weaponChance, 1);
    expect(lost).toBeLessThan(intact);
  });

  it('gives an ace more parts and vehicles only scrap', () => {
    const pool = rollSalvage([{ type: 'brawler', ace: true }, { type: 'gunTurret' }, { type: 'drone' }], new Rng(1));
    expect(pool.filter((it) => it.kind === 'part')).toHaveLength(SALVAGE.partsPerAce);
    expect(vehicleScrap([{ type: 'lightTank' }, { type: 'gunTurret' }, { type: 'trooper' }, { type: 'uplink' }])).toBe(SALVAGE.scrap.tank + SALVAGE.scrap.turret);
  });
});

describe('contract terms', () => {
  it('only offers terms when enemy mechs are expected', () => {
    const s = newCareer('normal', 'normal');
    const k = s.contracts[0];
    delete k.maxTonnage;
    k.enemyMechs = [];
    k.mission = 'destroy';
    expect(salvageExpected(k)).toBe(false);
    deploy(s, k.id, { ballistic: 0, missile: 0 }, 'salvage');
    expect(k.terms).toBe('pay');
  });

  it('pays less for salvage rights and leaves the picks for after the win', () => {
    const s = newCareer('normal', 'normal');
    const k = mechContract(s);
    expect(deploy(s, k.id, { ballistic: 0, missile: 0 }, 'salvage')).not.toBeNull();
    const before = s.money;
    const d = completeMission(s, k, outcome(s, true, [{ type: 'trooper' }, { type: 'lightTank' }]));
    expect(d.lines[0].amount).toBe(contractPay(k, 'salvage'));
    expect(contractPay(k, 'salvage')).toBeLessThan(k.payout);
    expect(d.lines.some((l) => l.label.startsWith('Scrap'))).toBe(true);
    expect(s.money).toBeGreaterThan(before);
    expect(d.salvage).not.toBeNull();
    expect(s.pendingSalvage?.picks).toBe(SALVAGE.terms.salvage.picks);
    expect(s.pendingSalvage?.pool.some((it) => it.kind === 'part')).toBe(true);
  });

  it('leaves the mech salvage with the employer on full pay', () => {
    const s = newCareer('normal', 'normal');
    const k = mechContract(s);
    deploy(s, k.id, { ballistic: 0, missile: 0 }, 'pay');
    const d = completeMission(s, k, outcome(s, true, [{ type: 'trooper' }]));
    expect(d.lines[0].amount).toBe(k.payout);
    expect(d.salvage).toBeNull();
    expect(s.pendingSalvage).toBeNull();
  });

  it('recovers nothing from a failed mission', () => {
    const s = newCareer('normal', 'normal');
    const k = mechContract(s);
    deploy(s, k.id, { ballistic: 0, missile: 0 }, 'salvage');
    const d = completeMission(s, k, outcome(s, false, [{ type: 'trooper' }, { type: 'lightTank' }]));
    expect(d.salvage).toBeNull();
    expect(d.lines.some((l) => l.label.startsWith('Scrap'))).toBe(false);
  });
});

describe('claiming salvage and parts', () => {
  function withPending(): CareerState {
    const s = newCareer('normal', 'normal');
    s.pendingSalvage = {
      employer: 'Test',
      picks: 2,
      pool: [
        { kind: 'weapon', id: 'autocannon', from: 'Trooper' },
        { kind: 'equipment', id: 'heatSink', from: 'Trooper' },
        { kind: 'part', id: 'condor', from: 'Brawler' },
      ],
    };
    return s;
  }

  it('takes up to the allowed picks and scraps the rest', () => {
    const s = withPending();
    expect(claimSalvage(s, [0, 1, 2])).toBeNull();
    const money = s.money;
    const r = claimSalvage(s, [0, 2])!;
    expect(r.taken.map((it) => it.id)).toEqual(['autocannon', 'condor']);
    expect(s.inventory).toContain('autocannon');
    expect(s.inventory).not.toContain('heatSink');
    expect(s.parts.condor).toBe(1);
    expect(r.scrap).toBeGreaterThan(0);
    expect(s.money).toBe(money + r.scrap);
    expect(s.pendingSalvage).toBeNull();
  });

  it('assembles a bare mech from three parts for a fee', () => {
    const s = newCareer('normal', 'normal');
    s.money = 1e7;
    s.parts.condor = 2;
    expect(assembleChassis(s, 'condor')).toBeNull();
    s.parts.condor = 3;
    const fee = assemblyFee(s, 'condor');
    const money = s.money;
    const m = assembleChassis(s, 'condor')!;
    expect(m.chassis).toBe('condor');
    expect(m.weapons).toEqual([]);
    expect(m.equipment).toEqual(CHASSIS.condor.stock.equipment);
    expect(s.money).toBe(money - fee);
    expect(s.parts.condor).toBeUndefined();
    expect(s.mechs).toHaveLength(2);
  });

  it('sells parts', () => {
    const s = newCareer('normal', 'normal');
    s.parts.roc = 1;
    const money = s.money;
    expect(sellPart(s, 'roc')).toBe(true);
    expect(s.money).toBeGreaterThan(money);
    expect(sellPart(s, 'roc')).toBe(false);
  });
});

describe('save upgrade to version 3', () => {
  it('adds the parts bin and keeps pending salvage across a reload', () => {
    const s = JSON.parse(JSON.stringify(newCareer('normal', 'normal'))) as Record<string, unknown>;
    delete s.parts;
    delete s.pendingSalvage;
    s.version = 2;
    const up = upgradeSave(s) as CareerState;
    expect(up.version).toBe(SAVE_VERSION);
    expect(up.parts).toEqual({});
    expect(up.pendingSalvage).toBeNull();

    const p = JSON.parse(JSON.stringify(newCareer('normal', 'normal'))) as CareerState;
    p.pendingSalvage = { employer: 'X', picks: 2, pool: [{ kind: 'weapon', id: 'laser', from: 'Y' }, { kind: 'weapon', id: 'removedGun', from: 'Y' }] };
    p.parts = { condor: 2, gone: 1 };
    const again = upgradeSave(p) as CareerState;
    expect(again.pendingSalvage?.pool.map((it) => it.id)).toEqual(['laser']);
    expect(again.parts).toEqual({ condor: 2 });
  });
});
