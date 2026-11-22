import type { Section } from '../data/chassis';
import type { Loadout } from '../data/loadouts';
import type { FactionId } from '../data/factions';
import type { MapSize, MissionType } from '../data/missions';
import type { ContractTerms } from '../data/salvage';

export type CombatLevel = 'easy' | 'normal' | 'hard';

/** A mech the player owns, between missions. */
export interface MechState {
  /** Unique within the career (hangar slot id). */
  id: number;
  chassis: string;
  weapons: Loadout['weapons'];
  /** Internal equipment ids, including the reactor. */
  equipment: string[];
  /** Armor left per section. */
  sections: Record<Section, number>;
  ammo: { ballistic: number; missile: number };
  /** Destroyed in battle: must be rebuilt before it can deploy. */
  destroyed: boolean;
}

export type BonusKind = 'turrets' | 'tanks' | 'fast' | 'intact' | 'allSaved';

export interface BonusObjective {
  kind: BonusKind;
  label: string;
  /** 'fast' only: time limit in seconds. */
  seconds?: number;
}

export interface Contract {
  id: number;
  seed: number;
  tier: 1 | 2 | 3;
  /** Who hires you, and who you fight (milestone 9). Missing on older contracts. */
  employerFaction?: FactionId;
  enemyFaction?: FactionId;
  employer: string;
  enemy: string;
  flavor: string;
  /** Mission type and map size (milestone 10); missing = destroy targets on a standard map. */
  mission?: MissionType;
  mapSize?: MapSize;
  /** Mech hunt: the ace's mech type and callsign. */
  ace?: string;
  aceName?: string;
  /** Destroy: uplinks. Mech hunt: 1. Convoy raid: trucks in the convoy. */
  targets: number;
  payout: number;
  bonus: BonusObjective;
  /** Every deployed mech must weigh at most this (loaded), if set. */
  maxTonnage?: number;
  /** Enemy mechs on the map (EnemyDef ids) and drone flights. Missing on contracts from before milestone 8. */
  enemyMechs?: string[];
  droneFlights?: number;
  /** Pay or salvage, chosen when deploying (milestone 13; missing = full pay). */
  terms?: ContractTerms;
}

/** An enemy unit destroyed in a mission, for scrap and salvage (milestone 13). */
export interface DestroyedUnit {
  /** EnemyDef id. */
  type: string;
  /** Display name (the hunted ace's includes its callsign). */
  name?: string;
  /** Enemy mechs: arms that had been shot off (their weapons rarely survive). */
  lost?: Section[];
  /** The hunted ace: more parts. */
  ace?: boolean;
}

/** One recovered item: a weapon, equipment, or a chassis part (id = chassis id). */
export interface SalvageItem {
  kind: 'weapon' | 'equipment' | 'part';
  id: string;
  /** Which enemy it came from. */
  from: string;
}

/** Salvage waiting to be picked after a win (kept in the save until the player chooses). */
export interface PendingSalvage {
  /** Who the contract was for, for the screen's heading. */
  employer: string;
  pool: SalvageItem[];
  picks: number;
}

export interface LoanState {
  principal: number;
  /** Still owed, including interest. */
  remaining: number;
  installment: number;
  paymentsLeft: number;
}

export interface CareerState {
  /** Save format version (`SAVE_VERSION` in career.ts); older saves are upgraded step by step on load. */
  version: number;
  money: number;
  loan: LoanState | null;
  /** The hangar: every mech the player owns. */
  mechs: MechState[];
  /** The mech deployed first. */
  activeMechId: number;
  /** Mechs carried as backups (in drop order). */
  backupIds: number[];
  nextMechId: number;
  /** Weapon and equipment ids owned but not installed. */
  inventory: string[];
  contracts: Contract[];
  /** Standing with each faction, -100..100 (milestone 9). */
  reputation: Record<FactionId, number>;
  /** Salvaged chassis parts by chassis id (milestone 13). */
  parts: Record<string, number>;
  /** Salvage from the last win, until it's been picked. */
  pendingSalvage: PendingSalvage | null;
  difficulty: { combat: CombatLevel; economy: CombatLevel };
  stats: { missions: number; wins: number; earned: number; spent: number };
  nextContractId: number;
  /** Set while a mission is in progress, so a reload mid-mission counts as a withdrawal. */
  activeContract: number | null;
  over: boolean;
  overReason?: string;
}

/** What the map scene needs to run a contract. */
export interface MissionConfig {
  contract: Contract;
  mech: MechState;
  /** Dropped in, in order, when the mech in the field is destroyed. */
  backups: MechState[];
  /** Money available for field services (after deployment costs). */
  funds: number;
  /** Field service prices, markup and difficulty already applied. */
  fieldPrices: { repairPerArmor: number; ammoBallistic: number; ammoMissile: number; swapFee: number };
  /** Combat difficulty multipliers (career setting × contract tier). */
  enemyCount: number;
  enemySpread: number;
  /** Enemy mechs' damage (combat difficulty). */
  enemyDamage: number;
  /** Tanks, turrets and drones: combat difficulty × the contract tier's `vehicleDamage`. */
  vehicleDamage: number;
}

/** What the map scene reports when the mission ends. */
export interface MissionOutcome {
  won: boolean;
  withdrew: boolean;
  bonusAchieved: boolean;
  time: number;
  kills: number;
  targetsDestroyed: number;
  targetsTotal: number;
  damageDealt: number;
  damageTaken: number;
  shots: number;
  hits: number;
  ammoUsed: number;
  /** Final state of every deployed mech (armor, ammo, destroyed), active first. */
  mechs: MechState[];
  /** Backups that dropped in (or were swapped in) during the mission. */
  backupsUsed: number;
  /** Money spent at field stations during the mission. */
  fieldCosts: { label: string; amount: number }[];
  /** Every enemy unit destroyed (escaped trucks aren't), for scrap and salvage. */
  destroyed?: DestroyedUnit[];
}

export interface DebriefLine {
  label: string;
  amount: number;
}

export interface Debrief {
  outcome: MissionOutcome;
  contract: Contract;
  lines: DebriefLine[];
  /** Reputation changes from this contract. */
  reputation: { faction: FactionId; delta: number; after: number }[];
  net: number;
  moneyAfter: number;
  notes: string[];
  /** Salvage to pick from, if any (also kept in `CareerState.pendingSalvage`). */
  salvage: PendingSalvage | null;
}
