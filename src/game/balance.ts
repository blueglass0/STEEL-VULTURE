import { CHASSIS, CHASSIS_ORDER, type MountSize } from '../data/chassis';
import { ECONOMY } from '../data/economy';
import { ENEMIES, type EnemyDef } from '../data/enemies';
import { WEAPONS, type WeaponDef } from '../data/weapons';
import { DAMAGE_RULES } from '../data/damage';
import type { Loadout } from '../data/loadouts';
import { mechStats } from './mechStats';

/**
 * Balance numbers derived from the data files (milestone 13): no simulation, just arithmetic,
 * so it runs anywhere and every number can be checked by hand. `npm run balance` writes them
 * to docs/BALANCE.md with outliers flagged. Assumes every shot hits; real fights are lower.
 */

export interface WeaponNumbers {
  id: string;
  name: string;
  size: MountSize;
  slot: WeaponDef['slot'];
  /** Damage per second at full rate (salvos count every missile; lightning only its first target). */
  dps: number;
  heatPerSec: number;
  /** Ammo units per second (0 = energy). */
  ammoPerSec: number;
  /** Credits of ammo per second of fire (hangar price). */
  ammoCostPerSec: number;
  dpsPerTon: number;
  /** Damage per point of heat (∞ for weapons that make none). */
  damagePerHeat: number;
  /** Shop price per point of dps. */
  pricePerDps: number;
  range: number;
  tonnage: number;
  power: number;
  price: number;
}

export function weaponNumbers(w: WeaponDef): WeaponNumbers {
  const stream = w.delivery === 'stream';
  const perShot = w.damage * (w.missile?.salvo ?? 1);
  const dps = stream ? w.damage : perShot * w.fireRate;
  const heatPerSec = stream ? w.heat : w.heat * w.fireRate;
  const ammoPerSec = stream ? 0 : w.ammoPerShot * w.fireRate;
  const ammoPrice = w.family === 'missile' ? ECONOMY.ammoPrice.missile : ECONOMY.ammoPrice.ballistic;
  return {
    id: w.id,
    name: w.name,
    size: w.size,
    slot: w.slot,
    dps,
    heatPerSec,
    ammoPerSec,
    ammoCostPerSec: ammoPerSec * ammoPrice,
    dpsPerTon: w.tonnage > 0 ? dps / w.tonnage : Infinity,
    damagePerHeat: heatPerSec > 0 ? dps / heatPerSec : Infinity,
    pricePerDps: dps > 0 ? w.price / dps : Infinity,
    range: w.range,
    tonnage: w.tonnage,
    power: w.power,
    price: w.price,
  };
}

/** Weapons a player can own (enemy-only weapons have no price). */
export function playerWeapons(): WeaponDef[] {
  return Object.values(WEAPONS).filter((w) => w.price > 0);
}

export interface LoadoutNumbers {
  dps: number;
  heatPerSec: number;
  /** Heat shed per second, after the reactor's own heat. */
  netCooling: number;
  /** Share of full fire the mech can keep up without heat building (≤ 1). */
  sustained: number;
  sustainedDps: number;
  /** Seconds of full fire from cold before overheating (∞ if it never does). */
  secondsToOverheat: number;
  ammoPerSec: number;
  /** Torso armor divided by the share of damage that lands on it: a rough "hit points" figure. */
  effectiveHp: number;
  speed: number;
}

/** Share of a hit that reaches the torso when shot from the front (legs take their share first). */
const TORSO_SHARE = 1 - DAMAGE_RULES.legShare;

export function loadoutNumbers(l: Pick<Loadout, 'chassis' | 'weapons' | 'equipment'>, armorScale = 1): LoadoutNumbers {
  const st = mechStats(l);
  const ws = l.weapons.map((w) => weaponNumbers(WEAPONS[w.weapon]));
  const dps = ws.reduce((t, w) => t + w.dps, 0);
  const heatPerSec = ws.reduce((t, w) => t + w.heatPerSec, 0);
  const netCooling = st.dissipation - st.passiveHeat;
  const sustained = heatPerSec <= 0 ? 1 : Math.max(0, Math.min(1, netCooling / heatPerSec));
  const surplus = heatPerSec - netCooling;
  return {
    dps,
    heatPerSec,
    netCooling,
    sustained,
    sustainedDps: dps * sustained,
    secondsToOverheat: surplus > 0 ? st.heatCapacity / surplus : Infinity,
    ammoPerSec: ws.reduce((t, w) => t + w.ammoPerSec, 0),
    effectiveHp: (st.sections.torso * armorScale) / TORSO_SHARE,
    speed: CHASSIS[l.chassis].movement.maxSpeed,
  };
}

/** An enemy's toughness and firepower (mechs from their loadout; vehicles from their one weapon). */
export function enemyNumbers(e: EnemyDef, vehicleDamage = 1): { hp: number; dps: number } {
  if (e.mech) {
    const n = loadoutNumbers({ chassis: e.mech.chassis, weapons: e.mech.weapons, equipment: e.mech.equipment }, e.mech.armorScale);
    return { hp: n.effectiveHp, dps: n.sustainedDps * e.mech.damageScale };
  }
  const w = e.weapon ? weaponNumbers(WEAPONS[e.weapon]) : null;
  return { hp: e.hp, dps: (w?.dps ?? 0) * vehicleDamage };
}

/** Values more than `factor` times the median of their group (or less than 1/factor). */
export function outliers<T>(items: T[], key: (t: T) => number, group: (t: T) => string, factor = 1.5): Map<T, 'high' | 'low'> {
  const out = new Map<T, 'high' | 'low'>();
  const groups = new Map<string, T[]>();
  for (const it of items) groups.set(group(it), [...(groups.get(group(it)) ?? []), it]);
  for (const list of groups.values()) {
    const vals = list.map(key).filter(Number.isFinite).sort((a, b) => a - b);
    if (vals.length < 3) continue;
    const median = vals[Math.floor(vals.length / 2)];
    for (const it of list) {
      const v = key(it);
      if (!Number.isFinite(v)) continue;
      if (v > median * factor) out.set(it, 'high');
      else if (v < median / factor) out.set(it, 'low');
    }
  }
  return out;
}

const f = (n: number, digits = 1) => (Number.isFinite(n) ? n.toFixed(digits) : '∞');
const flag = (m: Map<unknown, 'high' | 'low'>, it: unknown) => (m.get(it) === 'high' ? ' ⚠️↑' : m.get(it) === 'low' ? ' ⚠️↓' : '');

/** The whole report as Markdown. */
export function balanceReport(): string {
  const lines: string[] = [];
  lines.push('# Balance report', '');
  lines.push('Generated by `npm run balance` from the data files. Pure arithmetic: every shot hits, no movement, no splash on misses. Use it to spot outliers, then playtest.', '');
  lines.push('⚠️↑ / ⚠️↓: more than 1.5× above or below the median of weapons of the same size and mount kind.', '');

  // Weapons
  const ws = playerWeapons().map(weaponNumbers);
  const group = (w: WeaponNumbers) => `${w.slot}-${w.size}`;
  const perTon = outliers(ws, (w) => w.dpsPerTon, group);
  const perHeat = outliers(ws, (w) => w.damagePerHeat, group);
  const perCredit = outliers(ws, (w) => -w.pricePerDps, group);
  lines.push('## Weapons', '');
  lines.push('| Weapon | Mount | Tons | Power | DPS | Heat/s | Ammo/s | Ammo ¢/s | DPS/ton | Dmg/heat | ¢ per DPS | Range |');
  lines.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  const order: MountSize[] = ['small', 'medium', 'large'];
  ws.sort((a, b) => a.slot.localeCompare(b.slot) || order.indexOf(a.size) - order.indexOf(b.size) || a.dps - b.dps);
  for (const w of ws) {
    lines.push(
      `| ${w.name} | ${w.size}${w.slot === 'back' ? ' back' : ''} | ${w.tonnage} | ${w.power} | ${f(w.dps)} | ${f(w.heatPerSec)} | ${f(w.ammoPerSec)} | ${f(w.ammoCostPerSec, 0)} | ${f(w.dpsPerTon, 2)}${flag(perTon, w)} | ${f(w.damagePerHeat, 2)}${flag(perHeat, w)} | ${f(w.pricePerDps, 0)}${flag(perCredit, w) === ' ⚠️↑' ? ' ⚠️ cheap' : flag(perCredit, w) === ' ⚠️↓' ? ' ⚠️ pricey' : ''} | ${w.range} |`,
    );
  }
  lines.push('');

  // Chassis with stock loadouts
  lines.push('## Stock mechs', '');
  lines.push('Each chassis with the loadout it comes with. "Sustained" is the share of full fire it can keep up without heat building.', '');
  lines.push('| Chassis | Tons | Speed | DPS | Heat/s | Cooling/s | Sustained | Sustained DPS | Overheat after | Effective HP |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  const stock = CHASSIS_ORDER.map((id) => ({ id, n: loadoutNumbers({ chassis: id, ...CHASSIS[id].stock }) }));
  for (const { id, n } of stock) {
    const c = CHASSIS[id];
    lines.push(
      `| ${c.name} | ${c.tonnage} | ${n.speed} | ${f(n.dps)} | ${f(n.heatPerSec)} | ${f(n.netCooling)} | ${Math.round(n.sustained * 100)}% | ${f(n.sustainedDps)} | ${Number.isFinite(n.secondsToOverheat) ? `${f(n.secondsToOverheat, 0)} s` : 'never'} | ${f(n.effectiveHp, 0)} |`,
    );
  }
  lines.push('');

  // Enemies
  lines.push('## Enemies', '');
  lines.push('Vehicles at full damage (high-risk contracts; low risk is ×0.8, standard ×0.9). Enemy mechs with their armor and damage scales.', '');
  lines.push('| Enemy | Kind | Effective HP | DPS vs you |');
  lines.push('|---|---|---:|---:|');
  const enemies = Object.values(ENEMIES).filter((e) => e.kind !== 'structure' && e.kind !== 'truck');
  for (const e of enemies) {
    const n = enemyNumbers(e);
    lines.push(`| ${e.name} | ${e.kind} | ${f(n.hp, 0)} | ${f(n.dps)} |`);
  }
  lines.push('');

  // Duels
  const mechs = enemies.filter((e) => e.kind === 'mech');
  lines.push('## Stock mech vs enemy mech', '');
  lines.push('Seconds for the stock mech to destroy the enemy (sustained fire, every shot hitting) / seconds for the enemy to destroy it. Lower first number and higher second number is better for you.', '');
  lines.push(`| Chassis | ${mechs.map((e) => e.name).join(' | ')} |`);
  lines.push(`|---|${mechs.map(() => '---:').join('|')}|`);
  for (const { id, n } of stock) {
    const cells = mechs.map((e) => {
      const en = enemyNumbers(e);
      const kill = n.sustainedDps > 0 ? en.hp / n.sustainedDps : Infinity;
      const die = en.dps > 0 ? n.effectiveHp / en.dps : Infinity;
      return `${f(kill, 0)} / ${f(die, 0)}`;
    });
    lines.push(`| ${CHASSIS[id].name} | ${cells.join(' | ')} |`);
  }
  lines.push('');
  return lines.join('\n');
}
