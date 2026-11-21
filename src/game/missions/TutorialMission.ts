import Phaser from 'phaser';
import { play } from '../../core/audio';
import { actions } from '../../core/input';
import type { Vec } from '../../core/math';
import { settings } from '../../core/settings';
import { TUTORIAL } from '../../data/missions';
import { ART_SCALE } from '../art';
import { hud } from '../hudState';
import { createEnemy, type Enemy } from '../units/Enemies';
import { Mission } from './Mission';

/** Tutorial (milestone 11): six short steps on a small hand-laid map, then evac. */
export class TutorialMission extends Mission {
  /** Current step (0..5; -1 before the first). */
  step = -1;
  /** The practice target or tank for this step, and the spot to walk to. */
  target: Enemy | null = null;
  marker: Vec | null = null;
  private ring?: Phaser.GameObjects.Image;

  setup(): void {}

  start(): void {
    hud.objectiveLabel = 'Tutorial';
    hud.objectiveTotal = 0;
    hud.objectiveDone = 0;
    hud.briefing = '';
  }

  /** Advance when the step's goal is met; keep the prompt on screen. The last step opens evac. */
  progress(): null {
    const p = this.host.player;
    const T = TUTORIAL;
    let next = this.step < 0;
    switch (this.step) {
      case 0:
        next = Math.hypot(p.x - T.waypoint.x, p.y - T.waypoint.y) < 90;
        break;
      case 1:
      case 2:
      case 4:
        next = !this.target?.alive;
        break;
      case 3:
        next = !!this.host.stations[0]?.used;
        break;
    }
    if (next) {
      this.step++;
      this.enterStep();
    }
    this.host.announce(this.text(), 1);
    hud.objectiveLabel = `Tutorial · step ${Math.min(this.step + 1, 6)} of 6`;
    hud.objectiveTotal = 0;
    return null;
  }

  addTargets(out: Vec[]): void {
    if (this.marker) out.push(this.marker);
    else if (this.target?.alive) out.push(this.target);
  }

  private enterStep(): void {
    const h = this.host;
    const T = TUTORIAL;
    const spawn = (type: string, at: Vec, angle: number) => {
      const e = createEnemy(h.scene, type, at.x, at.y, angle);
      h.spawn(e);
      return e;
    };
    this.ring ??= h.scene.add.image(0, 0, 'intel-ping').setScale(1 / ART_SCALE).setDepth(2);
    this.ring.setVisible(false);
    this.marker = null;
    play('ui', 0.8);
    switch (this.step) {
      case 0:
        this.marker = T.waypoint;
        this.ring.setPosition(T.waypoint.x, T.waypoint.y).setVisible(true);
        break;
      case 1:
        this.target = spawn('dummy', T.targetA, 0);
        break;
      case 2:
        this.target = spawn('dummy', T.targetB, 0);
        break;
      case 3:
        // Some damage to fix at the repair pad.
        h.player.damageSection('leftArm', 70);
        h.player.damageSection('torso', 60);
        this.marker = T.station;
        break;
      case 4:
        this.target = spawn('lightTank', T.tank, Math.PI / 2);
        break;
      case 5:
        h.openEvac();
        break;
    }
  }

  /** The current step's instruction, worded for the device and control settings in use. */
  private text(): string {
    const touch = actions.device === 'touch';
    const tank = settings.scheme[actions.device] === 'tank';
    const fire = settings.touchFire;
    switch (this.step) {
      case 0:
        if (touch) return 'Walk to the marker with the left stick. The right stick turns your torso.';
        return tank ? 'Walk to the marker: W/S walk, A/D turn the legs, the mouse aims your torso.' : 'Walk to the marker: WASD walks that way, the mouse aims your torso.';
      case 1:
        return touch ? 'Destroy the target: push the right stick past its inner ring to fire.' : 'Destroy the target: aim with the mouse, left click fires group 1.';
      case 2:
        if (!touch) return 'Now right click: group 2 is your laser. Lasers run hot, so watch the heat bar.';
        if (fire === 'tiers') return 'Drag past the dashed outer ring to fire both groups. Watch the heat bar.';
        if (fire === 'swap') return 'Tap ⇄ to switch to group 2, then fire. Lasers run hot: watch the heat bar.';
        return 'Your stick fires every weapon at once. Lasers run hot: watch the heat bar.';
      case 3:
        return `You're damaged. Stand on the repair pad and ${touch ? 'tap USE' : 'press F'}. Free here, costly in contracts.`;
      case 4:
        return 'A tank ahead. You only see inside your vision cone; red arcs show hits from elsewhere.';
      default:
        return 'Done! Walk into the green evac zone to finish.';
    }
  }
}
