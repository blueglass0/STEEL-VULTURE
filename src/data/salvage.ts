/**
 * Salvage (milestone 13): what destroyed enemy mechs leave behind, contract terms, chassis
 * parts and scrap. Money values are before economy difficulty.
 */
export type ContractTerms = 'pay' | 'balanced' | 'salvage';

export const SALVAGE = {
  /** Contract terms, picked before deploying: share of the payment kept, and salvage picks after a win. */
  terms: {
    pay: { label: 'Full pay', pay: 1, picks: 0 },
    balanced: { label: 'Balanced', pay: 0.8, picks: 2 },
    salvage: { label: 'Salvage rights', pay: 0.55, picks: 4 },
  } as Record<ContractTerms, { label: string; pay: number; picks: number }>,
  /** Chance each weapon on a destroyed enemy mech survives; much lower on an arm that was shot off. */
  weaponChance: 0.55,
  lostArmWeaponChance: 0.15,
  /** Chance each piece of internal equipment survives (reactors rarely do). */
  equipmentChance: 0.4,
  reactorChance: 0.25,
  /** Chassis parts recovered from each destroyed enemy mech (a hunted ace gives more). */
  partsPerMech: 1,
  partsPerAce: 2,
  /** Parts of one chassis needed to assemble a mech, and the fee as a share of its shop price. */
  partsToAssemble: 3,
  assemblyFee: 0.3,
  /** A part's value as a share of its chassis's price (what selling one pays, before difficulty). */
  partValue: 0.08,
  /**
   * Salvage you don't pick is sold for this share of its value. Kept low: two enemy mechs can
   * leave ten or more items, and the picks are meant to be the prize.
   */
  scrapShare: 0.1,
  /** Scrap money per destroyed vehicle, by enemy kind (paid on a win, whatever the terms). */
  scrap: { tank: 500, turret: 400, drone: 150, truck: 300, mech: 0, structure: 0 } as Record<string, number>,
};
