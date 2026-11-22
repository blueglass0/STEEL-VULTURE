import { CHASSIS, type Section } from '../data/chassis';
import { ENEMIES } from '../data/enemies';
import { EQUIPMENT } from '../data/equipment';
import { SALVAGE } from '../data/salvage';
import type { Rng } from '../core/rng';
import type { DestroyedUnit, SalvageItem } from './types';

/**
 * What the wrecks of a won mission leave behind (milestone 13). Pure: give it a seeded RNG
 * and the same wrecks give the same pool. Only enemy mechs leave items; vehicles are scrap.
 */
export function rollSalvage(destroyed: readonly DestroyedUnit[], rng: Rng): SalvageItem[] {
  const pool: SalvageItem[] = [];
  for (const d of destroyed) {
    const def = ENEMIES[d.type];
    const m = def?.mech;
    if (!m || !CHASSIS[m.chassis]) continue;
    const from = d.name ?? def.name;
    const mounts = CHASSIS[m.chassis].mounts;
    for (const w of m.weapons) {
      const section: Section | undefined = mounts.find((x) => x.id === w.mount)?.section;
      const lost = section !== undefined && (d.lost ?? []).includes(section);
      if (rng.next() < (lost ? SALVAGE.lostArmWeaponChance : SALVAGE.weaponChance)) pool.push({ kind: 'weapon', id: w.weapon, from });
    }
    for (const id of m.equipment) {
      const e = EQUIPMENT[id];
      if (!e) continue;
      if (rng.next() < (e.kind === 'reactor' ? SALVAGE.reactorChance : SALVAGE.equipmentChance)) pool.push({ kind: 'equipment', id, from });
    }
    for (let i = 0; i < (d.ace ? SALVAGE.partsPerAce : SALVAGE.partsPerMech); i++) pool.push({ kind: 'part', id: m.chassis, from });
  }
  return pool;
}

/** Scrap money for the vehicles destroyed (before economy difficulty). */
export function vehicleScrap(destroyed: readonly DestroyedUnit[]): number {
  return destroyed.reduce((t, d) => t + (SALVAGE.scrap[ENEMIES[d.type]?.kind ?? ''] ?? 0), 0);
}
