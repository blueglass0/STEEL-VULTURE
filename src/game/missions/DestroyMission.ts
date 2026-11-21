import { DESTROY_TARGETS } from '../../data/missions';
import { hud } from '../hudState';
import type { Enemy } from '../units/Enemies';
import { Mission } from './Mission';

/** Destroy targets: knock out every uplink, then evac. */
export class DestroyMission extends Mission {
  setup(): void {
    this.targetStructures();
  }

  start(): void {
    hud.objectiveLabel = 'Destroy uplinks';
    hud.objectiveTotal = this.required;
    hud.objectiveDone = 0;
    hud.briefing = DESTROY_TARGETS.briefing(this.required);
  }

  marks(e: Enemy): boolean {
    return this.objectives.includes(e);
  }
}
