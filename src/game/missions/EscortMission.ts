import { play } from '../../core/audio';
import type { Vec } from '../../core/math';
import { escortRequired } from '../../career/career';
import { ESCORT } from '../../data/missions';
import { hud } from '../hudState';
import { ConvoyTruck, type FriendlyUnit } from '../units/Friendly';
import { FriendlyMission } from './FriendlyMission';
import { nearest, pointAlong, road } from './Mission';

/** Escort: get enough of your trucks across the map. They only drive while you're close. */
export class EscortMission extends FriendlyMission {
  /** The player is near enough for the convoy to move (decided once per frame). */
  private go = false;

  setup(): void {
    const h = this.host;
    const convoy = h.map.convoy;
    const n = h.config.contract.targets;
    this.required = escortRequired(n);
    if (!convoy) return;
    const path = road(h.nav, convoy.start, convoy.end);
    const points = [convoy.start, ...path];
    const trucks: ConvoyTruck[] = [];
    for (let i = 0; i < n; i++) {
      const at = pointAlong(points, (n - 1 - i) * ESCORT.spacing);
      const t = new ConvoyTruck(h.scene, at.x, at.y, at.angle, ESCORT.truckHp, ESCORT.speed);
      t.path = path;
      t.spacing = ESCORT.spacing;
      t.ahead = trucks[i - 1] ?? null;
      trucks.push(t);
    }
    h.friendlies.push(...trucks);
  }

  start(): void {
    hud.objectiveLabel = 'Escort · trucks across';
    hud.objectiveTotal = this.required;
    hud.objectiveDone = 0;
    hud.briefing = `Escort the convoy: ${this.required} of ${this.host.friendlies.length} trucks must get across. They only move while you're close.`;
  }

  update(dt: number, time: number): void {
    const p = this.host.player;
    this.go = p.alive && this.host.friendlies.some((f) => f.alive && Math.hypot(f.x - p.x, f.y - p.y) < ESCORT.stayWithin);
    super.update(dt, time);
  }

  protected updateUnit(f: FriendlyUnit, dt: number): void {
    if (!(f instanceof ConvoyTruck)) return;
    const h = this.host;
    const was = f.arrived;
    f.update(dt, this.go, h.world, h.bodies);
    if (f.arrived && !was) {
      h.announce('A truck made it through.', 2.5);
      play('ui', 0.8);
      h.rebuildBodies();
    }
  }

  protected afterUpdate(): void {
    hud.objectiveLabel = 'Escort · trucks across';
    hud.objectiveDone = this.arrived();
    hud.objectiveTotal = this.required;
  }

  protected lossText(): string {
    return 'A convoy truck was destroyed!';
  }

  protected result(): 'won' | 'lost' | null {
    const alive = this.alive();
    const arrived = this.arrived(true);
    if (alive.length < this.required) return 'lost';
    if (arrived === alive.length && arrived >= this.required) return 'won';
    return null;
  }

  protected resultText(r: 'won' | 'lost'): string {
    return r === 'won' ? 'Convoy through. Contract complete.' : 'Too many trucks lost. Contract failed.';
  }

  /** The nearest truck still on the road, and where the road ends. */
  addTargets(out: Vec[], player: Vec): void {
    const t = nearest(this.host.friendlies, player, (f) => f.alive && !(f as ConvoyTruck).arrived);
    if (t) out.push(t);
    if (this.host.map.convoy) out.push(this.host.map.convoy.end);
  }

  tally(): { done: number; total: number } {
    return { done: this.arrived(), total: this.host.friendlies.length };
  }

  /** Trucks that made it across (`aliveOnly`: and are still standing). */
  private arrived(aliveOnly = false): number {
    return this.host.friendlies.filter((f) => (f.alive || !aliveOnly) && (f as ConvoyTruck).arrived).length;
  }
}
