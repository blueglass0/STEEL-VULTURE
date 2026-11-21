import { play } from '../../core/audio';
import type { Vec } from '../../core/math';
import { FACTIONS } from '../../data/factions';
import { DEFEND, DESTROY_TARGETS } from '../../data/missions';
import { hud } from '../hudState';
import { createEnemy } from '../units/Enemies';
import { Generator, type FriendlyUnit } from '../units/Friendly';
import { FriendlyMission } from './FriendlyMission';

/** Defend: hold the generators through every attack wave. */
export class DefendMission extends FriendlyMission {
  wavesTotal = 0;
  /** Waves sent so far. */
  waveIndex = 0;
  /** Seconds until the next wave. */
  waveTimer = 0;
  private pendingMechs: string[] = [];
  private pendingDroneFlights = 0;

  setup(): void {
    const h = this.host;
    const d = h.map.defense;
    if (d) for (const g of d.generators) h.friendlies.push(new Generator(h.scene, g.x, g.y, DEFEND.generatorHp));
    const k = h.config.contract;
    this.required = DEFEND.required;
    this.wavesTotal = DEFEND.waves[k.tier];
    this.waveTimer = DEFEND.firstWave;
    this.pendingMechs = [...(k.enemyMechs ?? [])];
    this.pendingDroneFlights = k.droneFlights ?? 0;
  }

  start(): void {
    const n = this.host.friendlies.length;
    hud.objectiveLabel = 'Defend · generators';
    hud.objectiveTotal = n;
    hud.objectiveDone = n;
    hud.briefing = `Defend the generators: ${this.wavesTotal} attack waves inbound. First in ${DEFEND.firstWave}s.`;
  }

  protected updateUnit(f: FriendlyUnit, _dt: number, time: number): void {
    if (f instanceof Generator) f.pulse(time);
  }

  protected afterUpdate(dt: number): void {
    this.updateWaves(dt);
    hud.objectiveLabel =
      this.waveIndex < this.wavesTotal ? `Defend · wave ${this.waveIndex}/${this.wavesTotal} next in ${Math.ceil(this.waveTimer)}s · generators` : `Defend · final wave · generators`;
    hud.objectiveDone = this.alive().length;
    hud.objectiveTotal = this.host.friendlies.length;
  }

  protected lossText(): string {
    return 'A generator is down!';
  }

  protected result(): 'won' | 'lost' | null {
    if (this.alive().length < this.required) return 'lost';
    if (this.waveIndex >= this.wavesTotal && !this.host.enemies.some((e) => e.wave && e.alive)) return 'won';
    return null;
  }

  protected resultText(r: 'won' | 'lost'): string {
    return r === 'won' ? 'Attack repelled. Contract complete.' : 'The generators are lost. Contract failed.';
  }

  addTargets(out: Vec[]): void {
    for (const g of this.host.friendlies) if (g.alive) out.push(g);
  }

  tally(): { done: number; total: number } {
    return { done: this.alive().length, total: this.host.friendlies.length };
  }

  /** Send in the next wave when its timer runs out (or soon after the last one is beaten). */
  private updateWaves(dt: number): void {
    const h = this.host;
    if (this.waveIndex >= this.wavesTotal) return;
    this.waveTimer -= dt;
    const waveAlive = h.enemies.some((e) => e.wave && e.alive);
    if (!waveAlive && this.waveIndex > 0) this.waveTimer = Math.min(this.waveTimer, DEFEND.breather);
    if (this.waveTimer > 0) return;
    const i = this.waveIndex++;
    this.waveTimer = DEFEND.interval;
    const d = h.map.defense!;
    const from = d.waveSpawns[i % d.waveSpawns.length];
    const k = h.config.contract;
    const army = k.enemyFaction ? FACTIONS[k.enemyFaction].army : null;
    const tankTypes = army?.tankTypes ?? DESTROY_TARGETS.tankTypes;
    const count = Math.max(2, Math.round((DEFEND.waveBase + DEFEND.perWave * i) * h.config.enemyCount));
    const types: string[] = [];
    for (let n = 0; n < count; n++) types.push(pickByWeight(tankTypes));
    // Enemy mechs join the last waves, drone flights the middle ones.
    if (this.pendingMechs.length && i >= this.wavesTotal - this.pendingMechs.length) types.push(this.pendingMechs.shift()!);
    if (this.pendingDroneFlights > 0 && i >= 1) {
      this.pendingDroneFlights--;
      for (let n = 0; n < 2 + Math.floor(Math.random() * 2); n++) types.push(DESTROY_TARGETS.droneType);
    }
    types.forEach((type, n) => {
      let x = from.x;
      let y = from.y;
      for (let tries = 0; tries < 12; tries++) {
        const a = Math.random() * Math.PI * 2;
        const r = 40 + n * 18 + tries * 20;
        x = Math.max(60, Math.min(h.map.width - 60, from.x + Math.cos(a) * r));
        y = Math.max(60, Math.min(h.map.height - 60, from.y + Math.sin(a) * r));
        if (!h.world.circleBlocked(x, y, 45)) break;
      }
      const e = createEnemy(h.scene, type, x, y, Math.atan2(d.center.y - y, d.center.x - x), { x: d.center.x, y: d.center.y }, h.armySkin);
      e.wave = true;
      e.engaged = true;
      h.spawn(e);
    });
    const side = from.y < h.map.height * 0.1 ? 'north' : from.x < h.map.width / 2 ? 'west' : 'east';
    h.announce(`Wave ${i + 1} of ${this.wavesTotal} incoming from the ${side}.`, 3.5);
    play('warn', 1);
  }
}

/** Pick a type from a weighted list (Math.random: waves don't need to be replayable). */
function pickByWeight(items: readonly { type: string; weight: number }[]): string {
  let r = Math.random() * items.reduce((t, i) => t + i.weight, 0);
  for (const i of items) if ((r -= i.weight) <= 0) return i.type;
  return items[0].type;
}
