import { play } from '../../core/audio';
import { Structure, Truck } from '../units/Enemies';
import { ConvoyTruck, type FriendlyUnit } from '../units/Friendly';
import { Mission } from './Mission';

/**
 * Missions about your own side's units (defend, escort): the enemy goes after them, losing
 * too many fails the contract, and the mission ends without an evac.
 */
export abstract class FriendlyMission extends Mission {
  private lost = new Set<FriendlyUnit>();
  private assignTimer = 0;

  /** Per unit, every frame: generators pulse, trucks drive. */
  protected abstract updateUnit(f: FriendlyUnit, dt: number, time: number): void;
  /** After units and enemy objectives are updated: waves, HUD counter. */
  protected abstract afterUpdate(dt: number): void;
  protected abstract lossText(f: FriendlyUnit): string;
  /** Won or lost yet (checked while the player is alive)? */
  protected abstract result(): 'won' | 'lost' | null;
  protected abstract resultText(result: 'won' | 'lost'): string;

  update(dt: number, time: number): void {
    const h = this.host;
    if (h.friendlies.length === 0) return;
    for (const f of h.friendlies) {
      this.updateUnit(f, dt, time);
      if (!f.alive && !this.lost.has(f)) {
        this.lost.add(f);
        f.destroy(h.fx);
        play('bigExplode', h.combat.volumeAt(f.x, f.y));
        h.announce(this.lossText(f), 3);
        h.rebuildBodies();
      }
    }
    // Enemies near a friendly unit (and every attack-wave unit) go after it.
    this.assignTimer -= dt;
    if (this.assignTimer <= 0) {
      this.assignTimer = 0.5;
      for (const e of h.enemies) {
        if (!e.alive || e instanceof Structure || e instanceof Truck) continue;
        let best: FriendlyUnit | null = null;
        let bestD = e.wave ? Infinity : e.def.detectRange;
        for (const f of h.friendlies) {
          if (!f.alive || (f instanceof ConvoyTruck && f.arrived)) continue;
          const d = Math.hypot(f.x - e.x, f.y - e.y);
          if (d < bestD) {
            bestD = d;
            best = f;
          }
        }
        e.objective = best;
      }
    }
    this.afterUpdate(dt);
  }

  progress(): 'won' | 'lost' | null {
    const r = this.result();
    if (r) {
      this.host.announce(this.resultText(r), 5);
      play('ui', 1);
    }
    return r;
  }

  /** The counter is kept up to date in `afterUpdate`. */
  trackProgress(): void {}

  devWin(): boolean {
    return true;
  }

  protected alive(): FriendlyUnit[] {
    return this.host.friendlies.filter((f) => f.alive);
  }
}
