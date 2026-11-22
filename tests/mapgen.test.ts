import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../src/core/collision';
import type { Vec } from '../src/core/math';
import { COMBAT_DIFFICULTY } from '../src/data/difficulty';
import type { MapSize, MissionType } from '../src/data/missions';
import { STATION_RADIUS, generateMap, type MissionMap } from '../src/game/world/mapgen';
import { NavGrid } from '../src/game/world/NavGrid';

const FORCES = { mechs: ['trooper', 'brawler'], droneFlights: 2, ace: 'brawler', escorts: 3 };
const SEEDS = 25;

function build(seed: number, mission: MissionType, size: MapSize): { m: MissionMap; world: CollisionWorld; nav: NavGrid } {
  const m = generateMap(seed, COMBAT_DIFFICULTY.normal, { mission, targets: 3, size, forces: FORCES });
  const world = new CollisionWorld(m.width, m.height, m.obstacles);
  // Tank clearance and crush tonnage, as in the map scene.
  const nav = new NavGrid(world, 34, 35);
  return { m, world, nav };
}

/** Reasons this map is broken (empty = fine). */
function problems(m: MissionMap, world: CollisionWorld, nav: NavGrid): string[] {
  const out: string[] = [];
  const path: Vec[] = [];
  const reach = (label: string, p: Vec, from: Vec = m.spawn) => {
    if (!nav.findPath(from.x, from.y, p.x, p.y, path)) out.push(`${label} unreachable at ${Math.round(p.x)},${Math.round(p.y)}`);
  };
  const inside = (label: string, p: Vec) => {
    if (p.x < 0 || p.y < 0 || p.x > m.width || p.y > m.height) out.push(`${label} off the map`);
  };
  if (world.circleBlocked(m.spawn.x, m.spawn.y, 40)) out.push('spawn blocked');
  for (const t of m.targets) reach('target', t);
  for (const t of m.tanks) reach('tank', t);
  for (const u of m.units) {
    inside(u.type, u);
    if (u.type !== 'drone') reach(u.type, u);
  }
  for (const st of m.stations) {
    if (world.circleBlocked(st.x, st.y, STATION_RADIUS)) out.push(`${st.type} station blocked`);
    reach(`${st.type} station`, st);
  }
  if (m.convoy) reach('convoy end', m.convoy.end, m.convoy.start);
  if (m.defense) {
    for (const g of m.defense.generators) {
      if (world.circleBlocked(g.x, g.y, 40)) out.push('generator blocked');
      reach('generator', g);
    }
    for (const w of m.defense.waveSpawns) reach('wave spawn → base', m.defense.center, w);
  }
  return out;
}

describe('map generation', () => {
  const missions: MissionType[] = ['destroy', 'hunt', 'raid', 'defend', 'escort', 'clear'];
  for (const mission of missions) {
    for (const size of ['standard', 'large'] as MapSize[]) {
      it(`${mission} / ${size}: everything reachable over ${SEEDS} seeds`, () => {
        const bad: string[] = [];
        for (let seed = 1; seed <= SEEDS; seed++) {
          const { m, world, nav } = build(seed * 7919, mission, size);
          expect(m.mission).toBe(mission);
          for (const p of problems(m, world, nav)) bad.push(`seed ${seed * 7919}: ${p}`);
        }
        expect(bad).toEqual([]);
      });
    }
  }

  it('places the mission objectives', () => {
    expect(build(11, 'destroy', 'standard').m.targets).toHaveLength(3);
    expect(build(11, 'hunt', 'standard').m.units.filter((u) => u.role === 'ace')).toHaveLength(1);
    expect(build(11, 'raid', 'standard').m.convoy).toBeDefined();
    const clear = build(11, 'clear', 'standard').m;
    expect(clear.targets).toHaveLength(0);
    expect(clear.sites).toHaveLength(3);
    expect(clear.turrets.length + clear.tanks.length).toBeGreaterThanOrEqual(10);
    expect(build(11, 'escort', 'standard').m.convoy).toBeDefined();
    const d = build(11, 'defend', 'standard').m.defense;
    expect(d?.generators.length).toBeGreaterThan(0);
    expect(d?.waveSpawns.length).toBeGreaterThan(0);
  });

  it('is deterministic for a seed', () => {
    const a = build(1234, 'destroy', 'large').m;
    const b = build(1234, 'destroy', 'large').m;
    expect(b).toEqual(a);
    expect(build(1235, 'destroy', 'large').m.obstacles).not.toEqual(a.obstacles);
  });

  it('makes large maps bigger', () => {
    const s = build(5, 'destroy', 'standard').m;
    const l = build(5, 'destroy', 'large').m;
    expect(l.width).toBeGreaterThan(s.width);
    expect(l.obstacles.length).toBeGreaterThan(s.obstacles.length);
  });

  it('builds the tutorial map with its practice targets and a station', () => {
    const { m, world, nav } = build(1, 'tutorial', 'standard');
    expect(m.mission).toBe('tutorial');
    expect(m.stations.length).toBeGreaterThan(0);
    expect(problems(m, world, nav)).toEqual([]);
  });
});
