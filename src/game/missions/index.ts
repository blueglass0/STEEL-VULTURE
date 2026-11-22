import type { MissionType } from '../../data/missions';
import { ClearMission } from './ClearMission';
import { DefendMission } from './DefendMission';
import { DestroyMission } from './DestroyMission';
import { EscortMission } from './EscortMission';
import { HuntMission } from './HuntMission';
import type { Mission, MissionHost } from './Mission';
import { RaidMission } from './RaidMission';
import { TutorialMission } from './TutorialMission';

export type { Mission, MissionHost } from './Mission';

const MISSIONS: Record<MissionType, new (host: MissionHost) => Mission> = {
  destroy: DestroyMission,
  hunt: HuntMission,
  raid: RaidMission,
  defend: DefendMission,
  escort: EscortMission,
  clear: ClearMission,
  tutorial: TutorialMission,
};

/** The rules for a contract's mission type. */
export function createMission(type: MissionType, host: MissionHost): Mission {
  return new MISSIONS[type](host);
}
