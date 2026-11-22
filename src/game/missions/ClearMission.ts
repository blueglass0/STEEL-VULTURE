import { play } from '../../core/audio';
import type { Vec } from '../../core/math';
import { CLEAR } from '../../data/missions';
import { hud } from '../hudState';
import { Mission, nearest } from './Mission';

/**
 * Search & destroy: every enemy unit on the map counts (turrets, tanks, mechs, drones; not
 * buildings). Destroy enough of them, then evac. When none of the remaining ones is on your
 * sensors, intel points at the nearest so the last few don't turn into a blind search.
 * As the force shrinks the enemy responds, sending its surviving mobile units at you.
 */
export class ClearMission extends Mission {
  readonly evacBriefing = 'Enemy force broken. Get to the evac zone.';
  /** Enemy responses sent so far (index into `CLEAR.responseAt`). */
  private responses = 0;

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

  /** At each response threshold, mobile units near the player head for where they are. */
  update(): void {
    const h = this.host;
    const next = CLEAR.responseAt[this.responses];
    if (next === undefined || h.evac || !h.player.alive) return;
    if (this.objectivesDone() < Math.ceil(this.required * next)) return;
    const size = CLEAR.responseSize[this.responses] ?? 3;
    this.responses++;
    const p = h.player;
    const d = (e: { x: number; y: number }) => Math.hypot(e.x - p.x, e.y - p.y);
    const free = this.objectives.filter((e) => e.alive && e.def.kind !== 'turret' && !e.engaged && d(e) <= CLEAR.responseRadius);
    free.sort((a, b) => d(a) - d(b));
    const sent = Math.min(size, free.length);
    for (const e of free.slice(0, sent)) e.alert(p);
    if (sent > 0) {
      h.announce(`Enemy command is sending ${sent === 1 ? 'a unit' : `${sent} units`} to your position.`, 3.5);
      play('warn', 0.9);
    }
  }

  addTargets(out: Vec[], player: Vec): void {
    if (this.objectives.some((e) => e.alive && e.detection !== 'hidden')) return;
    const t = nearest(this.objectives, player, (e) => e.alive);
    if (t) out.push(t);
  }
}
