import Phaser from 'phaser';
import { play } from '../../core/audio';
import type { Vec } from '../../core/math';
import { ENEMIES } from '../../data/enemies';
import { HUNT } from '../../data/missions';
import { ART_SCALE } from '../art';
import { hud } from '../hudState';
import { EnemyMech, type Enemy } from '../units/Enemies';
import type { Placement } from '../world/mapgen';
import { Mission } from './Mission';

/** Mech hunt: find and kill an ace that roams between outposts; intel pings its position. */
export class HuntMission extends Mission {
  readonly evacBriefing = 'Target destroyed. Get to the evac zone.';
  ace: EnemyMech | null = null;
  /** Where the last intel ping saw the ace. */
  aceIntel: Vec | null = null;
  private pingTimer = 0;
  private pingImg?: Phaser.GameObjects.Image;

  /** The hunted ace: a tougher, sharper version of one of the army's mechs. */
  createUnit(p: Placement): Enemy | null {
    if (p.role !== 'ace') return null;
    const h = this.host;
    const def = ENEMIES[p.type];
    const m = def.mech!;
    const aceDef = {
      ...def,
      name: `"${h.config.contract.aceName ?? 'Ace'}" ${def.name}`,
      detectRange: def.detectRange * 1.1,
      mech: { ...m, armorScale: m.armorScale * HUNT.armorMult, damageScale: m.damageScale * HUNT.damageMult, aimErrorDeg: m.aimErrorDeg * HUNT.aimMult },
    };
    const ace = new EnemyMech(h.scene, aceDef, p.x, p.y, p.angle, { x: p.x, y: p.y }, h.armySkin);
    ace.roam = h.map.sites;
    this.ace = ace;
    return ace;
  }

  setup(): void {
    if (this.ace) {
      this.objectives = [this.ace];
      this.required = 1;
    } else this.targetStructures();
  }

  start(): void {
    const name = this.host.config.contract.aceName;
    hud.objectiveLabel = `Hunt "${name}"`;
    hud.objectiveTotal = this.required;
    hud.objectiveDone = 0;
    hud.briefing = `Find and destroy "${name}". Intel pings its position.`;
  }

  /** Ping the ace's position now and then. */
  update(dt: number): void {
    const h = this.host;
    if (!this.ace?.alive || h.evac) return;
    this.pingTimer -= dt;
    if (this.pingTimer <= 0) {
      this.pingTimer = HUNT.pingEvery;
      this.aceIntel = { x: this.ace.x, y: this.ace.y };
      this.pingImg ??= h.scene.add.image(0, 0, 'intel-ping').setScale(1 / ART_SCALE).setDepth(14);
      this.pingImg.setPosition(this.aceIntel.x, this.aceIntel.y).setVisible(true).setAlpha(1);
      if (h.elapsed > 1) h.announce('Intel: target position updated.', 2.5);
      play('lock', 0.8);
    }
    this.pingImg?.setAlpha(0.35 + 0.65 * (this.pingTimer / HUNT.pingEvery));
  }

  onEvacOpened(): void {
    this.pingImg?.setVisible(false);
  }

  addTargets(out: Vec[]): void {
    if (this.aceIntel) out.push(this.aceIntel);
  }
}
