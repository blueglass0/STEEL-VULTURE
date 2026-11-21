import type Phaser from 'phaser';
import type { MissionConfig } from '../../career/types';
import type { Circle, CollisionWorld } from '../../core/collision';
import type { Vec } from '../../core/math';
import type { Combat } from '../combat/Combat';
import type { Effects } from '../combat/Effects';
import { hud } from '../hudState';
import type { Mech } from '../units/Mech';
import { Truck, type Enemy, type Structure, type Tank } from '../units/Enemies';
import type { FriendlyUnit } from '../units/Friendly';
import type { NavGrid } from '../world/NavGrid';
import type { MissionMap, Placement } from '../world/mapgen';

/**
 * What a mission controller may see and do in the map scene. The scene owns the battlefield
 * (units, terrain, combat, the player, evac); controllers own the contract's rules.
 */
export interface MissionHost {
  readonly scene: Phaser.Scene;
  readonly config: MissionConfig;
  readonly map: MissionMap;
  readonly world: CollisionWorld;
  readonly nav: NavGrid;
  readonly fx: Effects;
  /** Created after `setup`: use it from `update` on, not before. */
  readonly combat: Combat;
  /** The mech in the field (changes when a backup drops in). */
  readonly player: Mech;
  readonly enemies: Enemy[];
  readonly structures: Structure[];
  /** Your side's units on defend/escort missions; controllers fill it in `setup`. */
  readonly friendlies: FriendlyUnit[];
  readonly bodies: readonly Circle[];
  readonly stations: readonly { used: boolean }[];
  /** The enemy army's colours (texture suffix). */
  readonly armySkin: string;
  /** Mission time, seconds. */
  readonly elapsed: number;
  readonly evac: Vec | null;
  /** Add an enemy mid-mission (to units, bodies and, for structures, the structure list). */
  spawn(e: Enemy): void;
  rebuildBodies(): void;
  /** Show a briefing line for a few seconds. */
  announce(text: string, seconds: number): void;
  openEvac(): void;
}

/**
 * A mission type's rules: what's on the map besides the generated units, what counts toward
 * the contract, when it's won or lost, and what the HUD points at. The map scene calls these
 * hooks; everything else (combat, the player, backups, stations, fog, evac) is shared.
 *
 * The default rules are the objective missions' (destroy, hunt, raid): objectives fall, then
 * an evac zone opens.
 */
export abstract class Mission {
  /** Enemies the contract is about (uplinks, the ace, convoy trucks) and how many must fall. */
  objectives: Enemy[] = [];
  required = 0;
  /** Briefing when the evac zone opens. */
  readonly evacBriefing: string = 'Uplinks down. Get to the evac zone.';

  constructor(protected host: MissionHost) {}

  /** Create the unit for a map placement the mission handles itself (the hunted ace), or null. */
  createUnit(_p: Placement): Enemy | null {
    return null;
  }

  /** After the map's units exist: objectives, convoys, generators. `escorts`: convoy escort tanks. */
  abstract setup(escorts: Tank[]): void;

  /** Mission start: objective label, counter and opening briefing on the HUD. */
  abstract start(): void;

  /** Every frame, after the enemies move. */
  update(_dt: number, _time: number): void {}

  /** An enemy left the battlefield without being destroyed (a truck escaping): true if handled. */
  enemyLeft(_e: Enemy): boolean {
    return false;
  }

  /**
   * While the mission is active, the player alive and evac not open: decided yet?
   * 'evac' opens the evac zone; 'won' / 'lost' end the mission.
   */
  progress(): 'won' | 'lost' | 'evac' | null {
    return this.objectivesDone() >= this.required ? 'evac' : null;
  }

  /** While active: the HUD's objective counter. */
  trackProgress(): void {
    hud.objectiveDone = this.objectivesDone();
  }

  onEvacOpened(): void {}

  /** Enemies with their own HUD arrow (the rest get threat arrows once engaged). */
  marks(_e: Enemy): boolean {
    return false;
  }

  /** Extra HUD arrows (intel, convoys, generators, tutorial markers) until evac opens. */
  addTargets(_out: Vec[], _player: Vec): void {}

  /** Debrief numbers: objectives achieved, out of how many. */
  tally(): { done: number; total: number } {
    return { done: this.objectivesDone(), total: this.objectives.length };
  }

  /** Dev "win mission": true = won now; false = destroyed the objectives (evac follows). */
  devWin(): boolean {
    for (const o of this.objectives) o.takeDamage(1e6, o.x, o.y);
    return false;
  }

  protected objectivesDone(): number {
    let n = 0;
    for (const o of this.objectives) if (!o.alive && !(o instanceof Truck && o.escaped)) n++;
    return n;
  }

  /** Fallback when the map lacks what the mission needs: treat its structures as the targets. */
  protected targetStructures(): void {
    this.objectives = this.host.structures;
    this.required = this.host.structures.length;
  }
}

/** A point `d` units along a polyline (clamped to its ends), with the direction of travel there. */
export function pointAlong(points: Vec[], d: number): { x: number; y: number; angle: number } {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    if (d <= len || i === points.length - 1) {
      const k = len > 0 ? Math.min(1, d / len) : 0;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle };
    }
    d -= len;
  }
  return { x: points[0].x, y: points[0].y, angle: 0 };
}

/** The nearest of `items` to `p` that passes `ok`, or null. */
export function nearest<T extends Vec>(items: readonly T[], p: Vec, ok: (t: T) => boolean): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const t of items) {
    if (!ok(t)) continue;
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

/** A road from `start` to `end` along the tank nav grid (straight to the end if there's no path). */
export function road(nav: NavGrid, start: Vec, end: Vec): Vec[] {
  const path: Vec[] = [];
  if (!nav.findPath(start.x, start.y, end.x, end.y, path)) path.push({ ...end });
  return path;
}
