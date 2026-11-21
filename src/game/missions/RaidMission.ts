import { play } from '../../core/audio';
import type { Vec } from '../../core/math';
import { raidRequired } from '../../career/career';
import { RAID } from '../../data/missions';
import { hud } from '../hudState';
import { Truck, createEnemy, type Enemy, type Tank } from '../units/Enemies';
import { Mission, nearest, pointAlong, road } from './Mission';

/** Convoy raid: trucks drive one road across the map; destroy enough before they escape. */
export class RaidMission extends Mission {
  readonly evacBriefing = 'Convoy broken. Get to the evac zone.';
  /** Trucks that reached the end of the road. */
  escaped = 0;
  private started = false;

  setup(escorts: Tank[]): void {
    const h = this.host;
    const convoy = h.map.convoy;
    if (!convoy) return this.targetStructures();
    // The road: one A* path from entry to exit; trucks line up along its start.
    const path = road(h.nav, convoy.start, convoy.end);
    const points = [convoy.start, ...path];
    const n = h.config.contract.targets;
    const trucks: Truck[] = [];
    for (let i = 0; i < n; i++) {
      // Lead truck furthest along the road, the rest behind it.
      const at = pointAlong(points, (n - 1 - i) * RAID.spacing);
      const t = createEnemy(h.scene, RAID.truckType, at.x, at.y, at.angle, undefined, h.armySkin) as Truck;
      t.path = path;
      t.spacing = RAID.spacing;
      t.ahead = trucks[i - 1] ?? null;
      trucks.push(t);
      h.enemies.push(t);
    }
    escorts.forEach((e, i) => (e.escortOf = trucks[Math.min(trucks.length - 1, i % trucks.length)]));
    this.objectives = trucks;
    this.required = raidRequired(n);
  }

  start(): void {
    hud.objectiveLabel = 'Destroy convoy trucks';
    hud.objectiveTotal = this.required;
    hud.objectiveDone = 0;
    hud.briefing = `Stop the convoy: destroy ${this.required} of ${this.objectives.length} trucks.`;
  }

  /** The convoy sets off after a short delay. */
  update(): void {
    if (this.started || this.host.elapsed <= RAID.startDelay) return;
    this.started = true;
    for (const o of this.objectives) if (o instanceof Truck) o.started = true;
  }

  enemyLeft(e: Enemy): boolean {
    if (!(e instanceof Truck && e.escaped)) return false;
    e.vanish();
    this.escaped++;
    this.host.announce(`A truck got away (${this.escaped} escaped).`, 3);
    play('warn', 0.8);
    return true;
  }

  progress(): 'evac' | 'lost' | null {
    if (this.objectivesDone() >= this.required) return 'evac';
    if (this.objectives.length - this.escaped < this.required) {
      this.host.announce('Too many trucks got away. Contract failed.', 5);
      return 'lost';
    }
    return null;
  }

  /** One arrow, to the nearest truck. */
  addTargets(out: Vec[], player: Vec): void {
    const t = nearest(this.objectives, player, (o) => o.alive);
    if (t) out.push(t);
  }
}
