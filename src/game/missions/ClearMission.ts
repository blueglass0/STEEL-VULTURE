import type { Vec } from '../../core/math';
import { CLEAR } from '../../data/missions';
import { hud } from '../hudState';
import { Mission, nearest } from './Mission';

/**
 * Search & destroy: every enemy unit on the map counts (turrets, tanks, mechs, drones; not
 * buildings). Destroy enough of them, then evac. When none of the remaining ones is on your
 * sensors, intel points at the nearest so the last few don't turn into a blind search.
 */
export class ClearMission extends Mission {
  readonly evacBriefing = 'Enemy force broken. Get to the evac zone.';

  setup(): void {
    this.objectives = this.host.enemies.filter((e) => e.def.kind !== 'structure' && e.def.kind !== 'truck');
    this.required = Math.max(1, Math.ceil(this.objectives.length * CLEAR.required));
  }

  start(): void {
    hud.objectiveLabel = 'Destroy enemy units';
    hud.objectiveTotal = this.required;
    hud.objectiveDone = 0;
    hud.briefing = `Search and destroy: take out ${this.required} of ${this.objectives.length} enemy units.`;
  }

  addTargets(out: Vec[], player: Vec): void {
    if (this.objectives.some((e) => e.alive && e.detection !== 'hidden')) return;
    const t = nearest(this.objectives, player, (e) => e.alive);
    if (t) out.push(t);
  }
}
