# Steel Vulture — notes for Claude Code

Top-down real-time mech game. Full design and milestone plan: `docs/PLAN.md`. Read it first.

## Current milestone

**Milestone 13 (Salvage + balance report): built, awaiting the user's playtest.** M1–M11 played,
playtest follow-ups done. Next in `docs/PLAN.md`: 14 Artillery and support enemies (incl. player
artillery), 15 Chassis abilities, then maybe 16 Chassis expansion (notes in
`docs/MECH_LINEUP.md`). The user keeps a roadmap page (claude.ai artifact
https://claude.ai/artifact/9muLYNhBRhJK2xHiABzxMh, source in the session scratchpad); update it
when a milestone ships. Optional 12 (final mission) still "someday".
Deferred by the user: line-of-sight shadow rendering (logic already hides enemies behind
walls); revisit as a graphics option, likely in M11.
Tuning loop: the user tunes with the `?debug` Tune panel and pastes values back into `src/data/`.

## Decisions made after the plan

- **Phones are landscape-only.** Portrait shows a "rotate your phone" prompt and pauses the game.
- **Throttle is hold-to-move** (release W/S or the stick and the mech coasts to a stop), not a
  persistent MechWarrior-style throttle setting. Chosen because it maps onto the phone stick.
- **Phones see slightly less of the map** (640 vs 720 world units on the short side) so the mech
  isn't tiny. PC view size is approved as is.
- **Tonnage-limited contracts and field ammo/repair stations** were requested after M5; they
  belong with M7 (multiple chassis, interact action). See `docs/PLAN.md`.
- **One backup per mission** (user decision after M7 part 1): `ECONOMY.maxBackups = 1`; choosing
  another backup replaces the current one.
- **Field services are expensive on purpose** (after M7 part 2): ammo 3× hangar prices, repairs
  2× (lowered after M8: heavy mechs cost too much to patch), ¢16k swap fee, so spending
  mid-mission is a real trade-off against the payout. Tune from there.
- **Missiles buffed** (after M9): pack 11, rocket 12, rack 10 per missile; missile ammo ¢25 (was 40).
- **Less ballistic ammo** (after M8): chassis ballistic capacity cut ~15% (Vulture 1150) so heavy
  gun builds have a reason to fit ammo bins.
- **Map sizes** (requested after M7 part 2): 35% of contracts use a large map (1.375× per side,
  obstacles scale with area, +15% pay). Measured: 320 obstacles, generation ~6 ms, logic
  ~0.2 ms/frame.
- Weapons don't need to knock buildings down faster; heavier weapons (heavy cannon, plasma) do it.
- **Weapons keep fixed, parallel aim** (user decision after M8; no convergence). Instead: medium and
  heavy enemy mechs are a little bigger than the player's version (`EnemyMechDef.sizeScale`
  1.1–1.15, hardpoints scale too), Condor and Roc arm mounts were narrowed (Roc ±24–34, Condor
  ±21–27), and bigger tanks/turrets may come later. Players can put guns on one arm to control
  where shots come from.
- **Phone firing** (M11, answers the open question): default 'tiers' — the right stick aims inside
  its inner ring, fires group 1 past it, and fires both groups when the thumb goes past the dashed
  outer ring (`CONTROLS.bothGroupsAt` = 1.15 stick radii). 'swap' (old ⇄ button) and 'both' (every
  weapon past the ring) are options. The swap button only exists in swap mode.
- **Balance pass after the M11 playtest** (too hard early, especially on phones; enemy mechs are
  the fun fight, so they were left alone):
  - Phone firing tiers: group 1 from `fireThreshold` 0.7, both groups from 1.45 stick radii, with
    0.12 hysteresis (`bothGroupsHysteresis`); buttons moved out to a 128 px arc to clear the ring.
  - Missed cannon shells did nearly direct-hit damage as ground splash (to the legs), so moving
    barely helped. Vehicle cannon splash cut (tank 4 @45, heavy tank 7 @55, cannon turret 6 @55)
    and spread up about 1°. Simulated vs a Vulture strafing at full speed: about 25–40% of the
    standing-still damage (was 45–60%).
  - Technocrat lasers stay accurate (hitscan, tight spread) but hit softer: laser tank 8 (was 11),
    laser turret 11 (was 15). Machine-gun vehicles and drones +1–1.5° spread.
  - Contract tiers scale tank/turret/drone damage (`ECONOMY.tiers[n].vehicleDamage`: 0.8 / 0.9 / 1)
    via `MissionConfig.vehicleDamage`; enemy mechs use `enemyDamage` (combat difficulty only).
- **Armor plating brings its armor** (after the M11 playtest): installing it adds its armor to
  every section that isn't destroyed, free; removing it takes the armor back (damage stays the
  same, so remove + refit isn't a free repair) and is refused if a section has less armor left
  than the plating gives (`removeEquipment` returns the reason; `App.act` shows returned strings).
- **Chassis feel:** heavier chassis get lower turn rates and more momentum (lower accel/decel),
  lights turn and accelerate quicker. The movement numbers in `chassis.ts` are enough to make
  chassis feel distinct (user-approved, M2).

## Stack

- TypeScript (strict), Phaser 4, Vite 8. `npm run dev` (dev server, debug overlay on),
  `npm run build` (type-check + production build), `npm run preview`, `npm test` (Vitest unit tests).
- `.npmrc` sets `legacy-peer-deps=true`: npm 10's installer crashes on Vitest's optional peers without it.
- Deploy: `.github/workflows/deploy.yml` runs the tests, builds and publishes to GitHub Pages on every
  push to `main` (failing tests block the deploy). `.github/workflows/test.yml` type-checks and tests
  every other branch push and pull request.
  Pages source must be set to "GitHub Actions" in the repo settings. If it is "Deploy from a branch",
  Pages serves the raw source and the game never loads.
- Saves go in `localStorage` (`steel-vulture.career.v1`, see `src/career/career.ts`). The key stays;
  the format has a number (`SAVE_VERSION`). **Changing the save format: bump `SAVE_VERSION` and add
  a step to `MIGRATIONS`** (version n → n+1), plus a test in `tests/career.test.ts`. `repairCareer`
  runs on every load for things game data changes under a save (weapons that no longer fit go to
  storage with a `loadNotes` message, removed items dropped, armor/ammo clamped). Saves from a
  newer version are refused (`saveUnreadable`: the title screen warns and confirms before a
  new career replaces it).
- Settings (`steel-vulture.settings.v1`) pass through `sanitizeSettings` on load: bad values fall
  back to defaults, numbers clamp. New settings need a line there and in `tests/settings.test.ts`.
- `?quick` skips the career and starts a throwaway mission (dev); `?debug` shows the dev tools.
- **Installable offline app (PWA).** `public/manifest.webmanifest` (fullscreen, landscape, icons in
  `public/icons/`, regenerate with `node scripts/make-icons.cjs`). `pwaPlugin` in `vite.config.ts`
  writes `dist/sw.js` from `src/pwa/sw.js` with the build's file list (cache name = hash of files,
  public files and the template). The worker precaches everything, serves page loads network-first
  (3.5 s timeout, then cache) and assets cache-first (`ignoreVary`: servers send `Vary: Origin`),
  takes over at once and deletes older caches, so a deploy reaches players on their next online
  launch. Registered only in production builds (`src/pwa/pwa.ts`; test with `npm run build` +
  `npm run preview`). The title screen's "Install app" link uses the browser's install prompt
  (Chrome/Edge/Samsung) or shows Share → Add to Home Screen on iOS; installed apps ask for
  persistent storage. Nothing may load from other origins (no web fonts/CDNs) or offline breaks.
  iOS gives a home-screen app its own storage: a career started in Safari doesn't carry over.
- Type-checking: `tsconfig.json` (game + tests, browser types) and `tsconfig.node.json` (Vite and
  Vitest configs, Node types); `npm run typecheck` runs both.

## Layout

- `src/main.ts` — game config and boot.
- `src/config/` — engine and display settings (render budget, view size).
- `src/data/` — game content and balance numbers (mechs, weapons, economy, maps). No logic.
- `src/core/` — shared engine-level systems: viewport sizing, input layer (`core/input/`),
  collision (`CollisionWorld`: grid-bucketed obstacles, push-out, raycasts), seeded RNG,
  synthesized audio (`audio.ts`, Web Audio, no files), settings (localStorage), math, debug flag.
- `src/game/` — gameplay. Logic and rendering are split where it matters: `MechMotor` (pure
  movement logic, no Phaser) and `MechView` (sprites). `art.ts` bakes all vector art at boot.
  - `units/` — `Mech` (movement, weapons, heat, ammo, armor, equipment; the player's mech and,
    driven by an AI, enemy mechs), `Enemy` (base class, `Gunner`, `PathFollower`), `Enemies`
    (tank, turret, structure, `createEnemy`), `Drone`, `EnemyMech`.
  - `combat/` — `Combat` (pooled projectiles and beams, hit tests), `Effects` (pooled sparks,
    explosions, smoke, scorch), `types.ts` (`Unit`: anything shots can hit).
  - `world/` — `mapgen.ts` (seeded procedural maps), `NavGrid.ts` (A* for tanks), `TerrainLayer.ts`
    (ground + chunked obstacle drawing, redraw on damage stage, culling), `Fog.ts`, `terrainArt.ts`.
  - `missions/` — one controller per mission type (`DestroyMission`, `HuntMission`, `RaidMission`,
    `DefendMission`, `EscortMission` on `FriendlyMission`, `TutorialMission`), base class
    `Mission` with hooks the map scene calls (`createUnit`, `setup`, `start`, `update`,
    `enemyLeft`, `progress` → 'evac'/'won'/'lost', `trackProgress`, `marks`, `addTargets`,
    `tally`, `devWin`). They reach the scene only through `MissionHost` (a getter adapter, so
    MapScene's fields stay private). A new mission type = a new controller + `createMission`.
  - `hudState.ts` — plain data the map scene publishes and the HUD reads.
- `src/scenes/` — Phaser scenes. `Boot` (bakes art) → `Map` (world) + `Hud` (screen-space UI, laid out in CSS px).
  `MapScene` runs the shared battlefield (player, enemies, combat, stations, backups, fog, evac,
  HUD publishing); contract rules are in `game/missions/`. Test scripts reach mission state via
  `scene.mission` (e.g. `mission.step` in the tutorial, `mission.waveIndex` on defend).
- `tests/` — Vitest, Node environment, in-memory localStorage (`tests/setup.ts`). Covers the pure
  modules only: saves and migrations, career flow, settings, map reachability (every mission type
  and size, 25 seeds each), stock and enemy loadouts, `SectionDamage`, data integrity. Nothing
  that imports Phaser; gameplay is checked with Playwright scripts and playtests.
- `src/career/` — career rules and state (`career.ts`: money, upkeep, contracts, shop, loadout
  limits, loans, career over, save/load; `types.ts`). Pure logic, no DOM or Phaser.
- `src/ui/` — HTML/DOM UI over the canvas: `app.ts` (title, hangar tabs, deploy, debrief,
  career over, pause/withdraw; owns the career and starts missions), `dom.ts` (toolbar, tuning
  panel), `h.ts` (tiny DOM builder), `ui.css`. Menus belong in the DOM, not in Phaser: crisp,
  cheap, and touches on them never reach the sticks.
- Flow: `Boot` bakes art and emits `booted` → `App` shows title/hangar → deploy starts `Map` +
  `Hud` with a `MissionConfig` → `Map` emits `mission-end` with a `MissionOutcome` → `App`
  stops the scenes (deferred one tick) and shows the debrief.

## Working rules (from the plan)

- **Data-driven content.** Mechs, weapons, equipment, enemies, factions and every economy number
  live in `src/data/`, separate from logic, so balancing is editing numbers.
- **One input layer.** Game code reads abstract actions (move, aim, fire group 1/2, equipment,
  interact) from `actions` in `src/core/input/`. Keyboard+mouse and touch are sources feeding it;
  nothing else reads keys or touches. `actions.device` is the last-used device and picks the
  control scheme (tank/direction, per device, stored in settings) and whether touch sticks show.
- **Ship every milestone.** Each ends deployed to Pages with a short "what to test" note. The next
  milestone starts only after sign-off. Leave room for later systems but don't build them early.
- **Dev tools.** Debug overlay (fps, worst frame, renderer, resolution, map seed; later hit arcs)
  shows in dev or with `?debug` in the URL. The Tune panel (debug only) has movement sliders and
  dev buttons: win mission, spawn tank, invulnerable, repair + refill, hit a section, new map.
  Add money etc. with M5.
  `?seed=N` replays a specific map; the end screen shows each map's seed.
- **Update this file** when a milestone changes state.
- **Run `npm test` before pushing**; add tests for new pure logic (career rules, data, mapgen).

## Performance rules (the game must run on most hardware, including low-end PCs and phones)

- Target smooth 60 fps on a mid-range phone and on integrated laptop graphics.
- Render budget lives in `src/config/display.ts`: device pixel ratio capped at 2, canvas capped at
  ~1080p worth of pixels; bigger screens render lower and stretch. Don't bypass it.
- `Phaser.AUTO`: WebGL with Canvas 2D fallback. Keep everything working in Canvas mode
  (avoid WebGL-only filters/shaders for anything gameplay-critical).
- Pool bullets, effects and enemies; never create/destroy per shot. Cap particles. Pools are
  fixed-size (shots 240, beams 24, streams 12, sparks 64...); effect pools are round-robin (oldest reused).
- No tint: Canvas mode doesn't support it. Colour variants are separate baked textures
  (e.g. `px-*` swatches for bars, `*-wreck` textures for destroyed units).
- Obstacles are drawn once into per-chunk Graphics (800×800 world units); off-screen chunks are
  hidden each frame. Measured M3 game logic: ~0.1–0.25 ms/frame with 16 enemies and full fire.
- Bake static vector art into textures once (in `Boot`) instead of redrawing Graphics every frame.
  Static Graphics are fine for a few hundred simple shapes; per-frame `clear()`+redraw is not.
- Text re-renders a texture on every `setText`: update HUD text only when the value changes,
  and throttle fast-changing readouts.
- All movement and timers use frame `delta`, never per-frame constants, so the game behaves the
  same at 30, 60 or 144 fps. Phaser's `fps.smoothStep` is off on purpose: it clamps delta to
  1/60 s when the window is unfocused, which slows the whole game down. Scenes clamp dt to 100 ms.
- Keep the bundle lean: no heavy dependencies without a reason. Phaser is split into its own
  cached chunk.

## Gameplay notes (M3)

- Map generation keeps every obstacle `minGap` (100) from every other obstacle and the map edge,
  so all open ground is connected; validated over 300 seeds (all targets and tanks reachable).
- Weapons fire along the torso facing from their hardpoint position (no convergence on the
  cursor), so the slow torso matters. Laser is hitscan; ballistics are projectiles.
- Phone aim assist: stick aim bends halfway toward an enemy within 12° and 650 units.
- Phone weapon groups: right stick fires `actions.stickGroup`; the ⇄ button next to it toggles 1/2.
  Right stick aims only inside the inner ring (`CONTROLS.fireThreshold`) and fires past it.
- Planned additions (see `docs/PLAN.md`): fog of war + sensors with M6, destructible terrain
  as M6b, continuous-beam lasers with M8.
- Enemies alert neighbours within 650 units when shot. Tanks path with A* (repath ~1.5 s).
- Locational damage (M4): `SectionDamage` (pure logic, reusable for enemy mechs in M8) with
  rules in `src/data/damage.ts`. The point where a shot strikes the mech's outline, as an angle
  from the torso facing, picks the section: front ±25° torso, sides (incl. off-centre frontal
  hits) that arm, rear ±40° torso ×1.5. Legs take 15% of every hit plus splash: enemy cannon
  shells burst on the ground at their aim point if they miss (`WeaponDef.splash`), and splash
  hits mechs in the legs. Measured: ~28/25/32/15% torso/arms/legs standing still against
  frontal fire; legs ~35% when walking (near misses). Damage beyond
  an arm's armor (or to a missing arm) goes to the torso; torso at 0 = mech destroyed.
  Destroyed arm: its weapons stop, arm sprite becomes a stump. Leg damage below 60% slows
  speed/turning, down to 35%/55% when destroyed. Sections under 40% smoke.
- HUD: silhouette (per-section condition colours, flashes white when hit) and red hit-direction
  arcs around the mech for every hit (helps with shots from off-screen; fog of war will need it).
  Debug mode draws the hit arcs around the mech.

## Economy notes (M5)

- All numbers in `src/data/economy.ts` (× economy difficulty). Chassis price/tonnage/power in
  `chassis.ts`, weapon price/tonnage/power in `weapons.ts`.
- Fuel is per ton per deployment; ammo is paid for what you top up (leftover ammo stays loaded);
  repairs per armor point (destroyed sections ×1.5); rebuild = 35% of chassis + weapons.
- Damage carries between missions until repaired; you may deploy damaged.
- Loan installments are due after every mission; shortfalls auto-sell spare gear, then end the
  career (easy economy: bailout instead). Career also ends when the mech is destroyed or you
  can't afford fuel, selling spares can't cover it, and you already have a loan.
- Reloading mid-mission counts as a withdrawal (`activeContract` in the save).
- Bonus objectives: destroy all turrets / all tanks / finish within a time / lose no section.

## Loadout and missile notes (M6 part 1)

- `src/data/equipment.ts`: reactors (exactly one; power output + passive heat), heat sinks,
  armor plating, ammo bins, shield generator, flares, point defense. Shop items are weapons or
  equipment, ids unique across both (`src/data/items.ts`).
- `src/game/mechStats.ts` derives everything from a loadout (tonnage, slots, power, heat,
  section max armor, ammo capacity, equipment). Career, UI and `Mech` all use it.
- Save migration: careers saved before M6 get the starter reactor + heat sink on load.
- Equipment actions: Q / E on PC (`actions.equip1/2`), small buttons above the right stick on
  phones (only shown when fitted). Order: flares first, then shield (`EQUIPMENT_ACTION_ORDER`).
- Shield: absorbs up to its capacity for a few seconds, then cools down; adds heat when raised.
  Flares break most missile locks (85% each) and send them at a decoy. Point defense shoots the
  nearest hostile missile in range automatically while the mech is running.
- Missiles (`combat/Missiles.ts`): pooled objects with HP; any shot or beam can destroy them.
  Seeking missiles lock onto the enemy nearest the torso aim line (≤20°, in range), shown with
  a reticle; without a lock they fly straight. Rockets are unguided salvos with splash.
  Enemy missile carriers (`missileTank`) fire seeking missiles; HUD warns "MISSILE INCOMING".
- Vulture: base 30 t + equipment, 8 slots, torso missile hardpoint, base cooling 6/s.
- Shield (after M6 feedback): 7 s, 160 capacity, +3 heat/s while up, 16 s cooldown.
- After M6 part 2 feedback: Vulture vision cone 42° half-angle, close radius 160, torso turn
  90°/s (starter should feel deliberate; lights can turn faster). Sensors buffed (suite +200
  range/+20°, radar array +280/+28°, radar 620). Evac opens ≥650 units away (rings to 1250).

## Fog of war and evac notes (M6 part 2)

- Vision per chassis (`ChassisDef.vision`: cone half-angle, range, all-round radius) plus the
  best sensor fitted (`sensors` equipment: +range, +cone, radar). Derived in `mechStats().vision`.
- `MapScene.updateVision` (10 Hz): enemy visible if within the radius, or in the torso cone and
  range with line of sight; radar range shows a blip through walls; otherwise hidden with a
  last-seen marker (tanks fade after 6 s, turrets/targets stay). `Enemy.setDetection`.
- Missile locks, aim assist and threat arrows use only detected enemies. Hit arcs always show.
  Target arrows always show (mission intel). Wrecks are always visible.
- Overlay (`world/Fog.ts`): one 512² canvas texture baked per mission from the vision stats,
  drawn as one rotated sprite. Setting `settings.fog`: 'faded' (default, terrain dimly visible)
  or 'dark'; toggle in the pause menu. Dev: `?nofog` or the Tune panel's fog toggle.
  No occlusion shadows behind buildings (that's the expensive version; logic still uses LOS).
- Evac: when all targets are down, an evac zone opens 650–1250 units away (prefers spots far
  from living enemies); reaching it wins. Dying before evac fails the mission. Dev "Win
  mission": first press destroys targets, second finishes.

## Destructible terrain notes (M6b)

- Every obstacle has a `type` (`src/data/terrain.ts`): building, wall, rock (indestructible),
  barrier, shed, tree, fence. Each has HP, a crush tonnage, whether it blocks shots and sight,
  a splash multiplier (explosives wreck buildings), and a rubble style.
- `CollisionWorld` keeps HP/alive per obstacle; every query skips destroyed ones. `raycast` has
  modes ('shot' / 'sight'; fences and barriers don't block sight, fences don't block shots) and
  leaves the hit index in `lastHit`. `damage(i)`, `obstaclesNear()`, and `onChange` callback.
  `resolveCircle(..., crushTonnage)` destroys obstacles the unit can crush (`crushed` count).
- Crush tonnage: mechs use chassis tonnage (Vulture 50: trees, fences, sheds); tanks 35
  (`EnemyDef.crushTonnage`); barriers need 75 (heavies, M7). Crushing slows mechs slightly.
- Map gen: solids (buildings, walls, rocks, barriers) keep the min-gap rule; props (trees,
  fences, sheds) are crushable by every unit so they don't affect connectivity. NavGrid ignores
  terrain tanks can crush and `refresh()`es the area when solid terrain collapses.
- Drawing: `world/terrainArt.ts` draws by type and damage stage (intact, cracked, badly
  damaged, rubble); a chunk's Graphics is redrawn only when one of its obstacles changes stage.
  ~155 obstacles per map; measured map logic ~0.43 ms/frame.

## Hangar and backup notes (M7 part 1)

- Four chassis in `chassis.ts` (`CHASSIS_ORDER`): Kestrel light 30 t, Vulture medium 50 t,
  Condor heavy 70 t, Roc assault 90 t. Each has movement, armor, hardpoints, slots, vision and
  a `stock` loadout included in its price. Art scales by `radius / 30` (`MechView` size).
- Career: `mechs[]` (each `MechState` has an `id`), `activeMechId`, `backupIds` (≤
  `ECONOMY.maxBackups` = 2). Every mech function takes the mech it acts on. Old saves with a
  single `mech` migrate on load. Buying a chassis adds a mech; selling pays a share of its value
  minus repairs (destroyed: 25%); you can't sell your last mech.
- Deploy: active mech + backups (backups pay 30% fuel and get full ammo). `MissionConfig.backups`.
  In battle, when the mech dies, the next backup drops ~2.2 s later at a clear spot near the wreck,
  away from enemies (`MapScene.dropBackup`, `attachPlayer`). No backups left = mission failed.
  `MissionOutcome.mechs` returns every deployed mech's final state (unused backups unchanged).
- Contracts may have `maxTonnage` (35% chance; 40/55/75 t; +15% pay); every deployed mech must
  fit (`mechBlocker`).
- Career over now considers all mechs: no deployable mech you can fuel, no rebuild you can
  afford, even selling spares and reserve mechs, with a loan already taken.
- Terrain tweak (after 6b): light buildings (240 HP), sandbags (110 HP, crush 60), barriers
  crush 70; crushing slows by `0.3 × drag × 50/tonnage`.

## Field station notes (M7 part 2)

- Map gen places 1–2 stations per map (`MissionMap.stations`, `STATION_RADIUS` 70): ammo depot,
  repair bay, or swap station (35%). In the open, ≥700 from the drop point, ≥600 from bases,
  ≥900 apart; solids and props keep clear of them; validated reachable over 200 seeds.
- Interact: F on PC (`actions.interact`); on phones a USE button appears next to the right stick
  only while standing on a station (`touchButtons.interact.visible`). HUD prompt shows the offer
  and price; cyan edge arrows point to unused stations.
- Services are one use per station, priced at `ECONOMY.field.repairMarkup` (2×) / `ammoMarkup` (3×) hangar prices, paid
  from the money you had at deploy (`MissionConfig.funds`, `fieldPrices`); spending comes back in
  `MissionOutcome.fieldCosts` and shows as debrief lines. Ammo: full refill. Repair: restores
  every section that isn't destroyed. Swap (fee 16k): the current mech is airlifted home as it is
  (`Mech.airlift`) and the backup lands on the pad.

## Weapon notes (M8 part 1)

- Deliveries (`WeaponDef.delivery`): projectile, beam (instant pulse), stream (continuous beam
  while held: `damage` and `heat` are per second; `Combat.stream()` every frame), arc (lightning:
  nearest enemy in a cone with a clear line, then chains to unhit enemies nearby at
  `chainFalloff`), missile.
- New: Gatling (`spinUp`: starts at a quarter rate), heavy cannon (big shell with splash, good
  against buildings), pulse laser, large laser, beam laser, heavy beam laser, plasma launcher
  (slow bolt, `splashOnHit`), lightning projector. Assault reactor (31 power) for energy-heavy
  heavies. Stock loadouts unchanged.
- Stats: a stream counts a shot every half second held (and a hit if it lands then); lightning
  chains, splash and most stream frames don't count as hits (`onUnitHit(..., counts)`).
- Pools: beams 24 (pulses, arcs, PD tracers), streams 12 (shown only on frames they fire).
  Measured ~0.4–0.5 ms/frame logic with Gatling, heavy cannon, beam, lightning and plasma firing.
- Weapons still fire parallel from their hardpoints (kept on purpose, see decisions).

## Drone and enemy mech notes (M8 part 2)

- `PlayerMech` became `Mech` (`units/Mech.ts`) with `MechOptions` (team, skin, armorScale,
  damageMult, spreadMult, markers). `Mech.body` is the unit others see (an `EnemyMech` wraps its
  mech), used for collision self, flares (`breakLocks`) and point defense team.
- `EnemyMech` (`units/EnemyMech.ts`): an AI fills `PilotInput` each frame for a real `Mech`:
  A* to the last seen spot (`PathFollower`), circles at `preferredRange` (backs off when too
  close), aims so its best weapon's hardpoint line crosses the target (lead + wandering aim error),
  fires a group when the torso is on target and the volley won't push heat past 90%, flares when
  a missile homing on it is close, shield after taking ~35 damage quickly. Locational damage,
  arm loss, leg slowdown, smoke and section bars above it. Wreck = `-wreck` texture set.
- Enemy mech defs in `data/enemies.ts` (`kind: 'mech'`, `mech: EnemyMechDef`): raider (Kestrel),
  trooper (Vulture), brawler (Condor), juggernaut (Roc), each with `armorScale` (0.5–0.8),
  `damageScale` (0.33–0.4), `aimErrorDeg`, `strafe`, `reaction`. Measured duels vs the stock
  Vulture with perfect mouse tracking: 9–20 s, costing the player ~130–330 armor.
- `Drone` (`units/Drone.ts`): flies (`Enemy.flying`: not a body, ignores terrain), circles the
  player at `orbitRange`, 40 HP, `droneGun`. Shadow sprite; wreck falls where the shadow was.
  Last-seen markers for drones fade in 1.5 s.
- Contracts roll `enemyMechs` and `droneFlights` per tier (`DESTROY_TARGETS.forces`), shown on
  the board ("Expect: ...") and in the deploy panel; each mech adds 12% to the payout
  (`ECONOMY.enemyMechPayBonus`). Mapgen places mechs near bases (patrolling them) and drone
  flights (2–3 drones) between; `MissionMap.units`. Old boards are refreshed on load.
- Enemy beams/pulses/streams use red textures (`*-enemy`). Dev: Spawn drones, Spawn enemy mech
  (cycles types). Measured logic ~0.5–0.9 ms/frame with ~45 enemies (2 mechs, 11 drones) converging.

## Sized mount notes (after M8)

- Mounts (`MountDef`) have `kind` ('direct': arms/torso, guns and lasers; 'back': missiles, later
  artillery) and `size` (small/medium/large); a weapon fits if `slot` matches and its `size` is no
  bigger (`fitsMount` in `mechStats.ts`, `SIZE_RANK`). Weapon `family` only decides ammo, heat
  style and colours now. Mount ids are kept from the old layout so saves line up; on load, weapons
  that no longer fit go to inventory with a hangar note (`loadNotes`).
- Sizes: small MG, small laser, pulse laser, rocket pod (back); medium AC, Gatling, laser, beam,
  plasma, lightning, missile pack (back); large heavy cannon, large laser, heavy beam, missile rack
  (new, back, 8 seekers, range 800). Heavy weapons mostly sit on heavy frames.
- Power = `ChassisDef.power` (frame, 5–9; energy-leaning frames higher) + reactor output (light 7,
  standard 10, heavy 16, assault 23). The reactor has its own row in the loadout (`setReactor`,
  `reactorOf`), uses no internal slots, and is optional. Internal slots cut to match (Kestrel 4,
  Shrike 4, Vulture 6, Condor 8, Roc 9). Reactors are still stored in `MechState.equipment`.
- Shrike (light 35 t, ¢290k): one large torso mount on the centre line, nothing else; stock large
  laser. The user's "glass cannon" idea.

## Faction notes (M9)

- `src/data/factions.ts`: Royalists (red), Technocrats (blue), Freestars (dirt brown). Each has
  employers and enemy force names, a gated shop (`shop: { item, rep }`), optional open-market
  discounts (Freestars 10% at 20, 20% at 50), and an `army` style (count multiplier, tank and
  turret mix, enemy mech types per tier, extra mechs/drone flights, colour `skin`).
- `OPEN_MARKET` sells to anyone: a generalist mech per weight class (Kestrel, Vulture, Condor,
  Roc) and the common weapons (incl. Gatling, pulse/beam/large lasers). Factions sell specialised
  kit (after M9 feedback: too much was locked): Royalists heavy cannon 20, missile rack 35, Bastion
  (heavy cannon platform) 45; Technocrats plasma 25, Seraph (energy frame) 30, heavy beam 40,
  assault reactor 50, shield/sensors; Freestars Jackal (fast light, 4 small mounts) 5, Shrike 20,
  lightning 25, discounts. `shopStatus`/`itemShopPrice`/`itemSource` in career.ts.
- Army weapon themes (user request): Royalists lean on cannons (guardsman, brawler, castellan,
  juggernaut; cannon turrets), Freestars on machine guns (raider, harrier, Gatling skirmisher,
  technicals, gun turrets), Technocrats on lasers (lancer, arbiter, warden).
- Dev (Tune panel): Royalists/Technocrats/Freestars +20, all factions -20 (`App.devAddRep`).
- Reputation (`CareerState.reputation`, -100..100, `REPUTATION`): a win gives the employer
  +6/9/13 by tier; the faction you fought loses 4/6/9 win or lose; failing costs the employer 3.
  At -30 or below a faction won't hire you or sell to you. Levels: Hostile, Neutral (-29),
  Friendly (20), Trusted (50), Allied (80). Shown in the Factions tab, deploy panel (preview) and
  debrief. Old saves start neutral and get a fresh board.
- Contracts have `employerFaction` and `enemyFaction`; the enemy army decides tank/turret types
  (`MissionForces.tankTypes/turretTypes`), mech types (`rollForces`), count multiplier
  (`MissionConfig.enemyCount`) and unit colours (`createEnemy(..., skin)`; art bakes every enemy
  texture per skin in `ARMY_PALETTES`, mech parts per skin too).
- New units: heavy tank (Royalists, 280 HP, radius 34, big splash cannon), laser tank and laser
  turret (Technocrats, hitscan beams), technical (Freestars, fast pickup with a gun), and enemy
  mechs lancer (Vulture, lasers), warden (Condor, large laser + shield), skirmisher (Shrike,
  heavy cannon). `EnemyDef.art` names a unit's textures.

## Mission type notes (M10 part 1)

- `MISSION_TYPES` (data/missions.ts): destroy (uplinks), hunt, raid; contracts roll one by weight
  (`Contract.mission`, `mapSize`, `ace`, `aceName`; old contracts default to destroy/standard).
  `generateMap(seed, difficulty, { mission, targets, forces, size })` shares the terrain
  generator; `reserved` ground (sites, convoy entry/exit) stays clear. `generateDestroyTargets`
  is a wrapper kept for tests.
- Mech hunt (`HUNT`): an ace (one of the enemy army's tier-3 mechs ×1.6 armor, ×1.15 damage, ×0.7
  aim error, callsign) starts at the farthest outpost and roams between outposts (`EnemyMech.roam`);
  an intel ping marks its position every 20 s (HUD arrow + ring). Kill it, then evac.
- Convoy raid (`RAID`): trucks (`Truck`, 170 HP, 44 u/s) follow one A* road from one side of the
  map to the other after an 8 s delay, keeping 90 apart; escort tanks (`Tank.escortOf`) ride
  behind them until they spot you. Destroy 70% (rounded) to win; a truck reaching the end
  escapes (`vanish`, no wreck); too many escapes fails the contract. One HUD arrow points to the
  nearest truck. Road length ~2200 (standard) / ~3500 (large).
- MapScene: `objectives` (uplinks / ace / trucks), `required`, `escaped`; `setupObjectives`,
  `updateObjectives`, `objectivesDone`. Dev "Win mission" kills every objective.

## Salvage notes (M13)

- Numbers in `src/data/salvage.ts` (`SALVAGE`). Logic: `career/salvage.ts` (pure `rollSalvage`,
  `vehicleScrap`) and the salvage section of `career.ts` (`salvageExpected`, `contractPay`,
  `claimSalvage`, `assembleChassis`, `sellPart`, `partSellPrice`, `assemblyFee`,
  `salvageScrapValue`).
- Contract terms (`Contract.terms`, chosen in the deploy panel only when `salvageExpected`: enemy
  mechs on the contract or a hunt; otherwise forced to full pay): full pay ×1 / 0 picks, balanced
  ×0.8 / 2 picks, salvage rights ×0.55 / 4 picks. The bonus isn't reduced.
- `MapScene.onEnemyDestroyed` records `MissionOutcome.destroyed` (`DestroyedUnit`: enemy id, name,
  arms an enemy mech had lost, `ace` from `EnemyMech.isAce`). Escaped trucks aren't included.
- On a win (`completeMission`): vehicle scrap (tank 500, turret 400, drone 150, truck 300, × economy
  payouts) is paid as a debrief line on any terms. Enemy mech wrecks roll a pool with a seeded
  `Rng(contract.seed + missions × 7919)`: each weapon 55% (15% on a shot-off arm), equipment 40%,
  reactors 25%, one chassis part per mech (2 for the ace). Full pay: the employer keeps the pool.
  Otherwise `CareerState.pendingSalvage` holds it until picked (survives reloads; `showHangar`
  redirects to `App.showSalvage`). Unpicked items sell for 10% of their value (`scrapShare`).
  Failed or abandoned missions recover nothing.
- Parts (`CareerState.parts`): 3 of a chassis assemble into a mech (Shop tab, "Salvaged parts")
  for 30% of its price: the frame with its stock equipment, no weapons, no ammo. A part sells for
  8% of the chassis price and counts in `sellableValue`. Salvage ignores faction shop gates
  (that's the point); better gear comes from higher tiers because their enemy mechs are heavier.
- Save format 3 (`MIGRATIONS[2]`: `parts`, `pendingSalvage`); `repairCareer` drops parts and
  pending items whose data no longer exists.
- Measured in a test run: two enemy mechs (trooper + brawler) left 8–11 items.

## Balance report (M13)

- `src/game/balance.ts`: pure arithmetic from the data (every shot hits, no movement): weapon DPS,
  heat/s, ammo/s and ¢/s, DPS per ton, damage per heat, ¢ per DPS; stock mechs' sustained DPS
  (heat-limited), seconds to overheat, effective HP (torso ÷ 0.85); enemies' effective HP and DPS;
  a stock-mech-vs-enemy-mech table of seconds to kill / seconds to die. Outliers: more than 1.5×
  from the median of weapons with the same mount size and kind.
- `npm run balance` regenerates `docs/BALANCE.md` (vitest with `vitest.report.config.ts`, runner
  in `tests/report/`, type-checked by `tsconfig.node.json`). Not part of `npm test`;
  `tests/balance.test.ts` checks the numbers stay finite. Rerun after changing weapon or chassis data.

## Search & destroy notes (after the M11 playtest)

- `MissionType` 'clear' (`MISSION_TYPES.clear`, weight 3, pay ×1.05; `CLEAR` in data/missions):
  outposts like destroy missions (`Contract.targets` = outpost count by tier) but no uplinks,
  `CLEAR.extraRoamers` (2) more roaming tanks, plus the contract's mechs and drones.
  `ClearMission`: objectives = every enemy unit at the start except structures and trucks;
  destroy `CLEAR.required` (75%, rounded up) then evac. When no remaining objective is on your
  sensors (`detection !== 'hidden'`), one HUD arrow points at the nearest. Map gen consumes the
  RNG the same way for other mission types, so their seeds are unchanged.
- After the first playtest ("slightly too easy": with 75% you could pick off patrols and skip
  outposts): +1 flat turret per outpost (`CLEAR.extraTurrets`, after difficulty/army scaling, so
  turrets are 35–48% of the force) and an enemy response: at 35% and 70% of the quota the
  nearest 3 / 5 uncommitted tanks, mechs and drones within 2600 are alerted to your position
  (`ClearMission.update`, announced with a warning). Forces (standard map): tier 1 ~11–15 units,
  tier 2 ~20–25, tier 3 ~27–39 (Technocrats fewest, Royalists most); 75% required.

## Defend and escort notes (M10 part 2)

- Enemy AI is foe-generic: `Enemy.foe` (the player, or `Enemy.objective`, a friendly `Foe` =
  `Unit & {vx, vy}`). `sense()` prefers the player whenever it can see them, else goes for its
  objective (always known, always engaged). Gunner, Tank, Drone and EnemyMech aim at `foe`.
  `MapScene.updateFriendlies` re-assigns objectives every 0.5 s: wave units → nearest living
  friendly anywhere; everyone else → nearest friendly within its detect range (so ambushers and
  turrets fire on a passing convoy).
- `units/Friendly.ts`: `FriendlyUnit` (team 'player', hp bar, always visible, in `units` and
  `bodies`), `Generator` (700 HP), `ConvoyTruck` (260 HP, 48 u/s, drives the road only while the
  player is within 550 of a truck, keeps 95 spacing, `arrived` at the end). Art: `generator`,
  `truck-ally` (`-ally` palette = the player's colours).
- Defend (`DEFEND`): 3 generators 430 above the drop point; 3/4/5 waves by tier from the north,
  west and east edges (`MissionMap.defense`); first after 18 s, then every 45 s or 8 s after a
  wave is wiped out. Wave n has (3 + n) × enemy count ground units from the army mix; the
  contract's mechs join the last waves, drone flights the middle ones. Win: every wave beaten
  with ≥1 generator standing (no evac). Bonus options: no section lost, or lose no generators.
- Escort (`ESCORT`): 3/4/5 trucks start beside the drop point and drive an A* road to the far
  edge past 3 ambush sites (turrets, guards, the contract's mechs and drones). Win when every
  surviving truck has arrived and at least 60% (rounded) made it. Bonus: every truck arrives.
- Validated 240 maps (defend/escort × standard/large): generators, wave paths and roads all
  reachable. Logic 0.1–0.35 ms/frame in tests.

## Settings notes (M11 part 1)

- `core/settings.ts`: scheme per device, muted, fog look, `volume` (0..1), `quality` ('high' |
  'low'), `shake`, `showFps`, `touchFire` ('tiers' | 'swap' | 'both'), `buttonScale` (0.8..1.3).
- Settings screen (`App.settingsPanel`): from the ⚙ toolbar button, the title screen, and the pause
  menu (in a mission it replaces the pause panel; closing it re-lays-out touch controls). Sections:
  difficulty for the current career (`setDifficulty`: combat from the next deploy, economy at
  once), sound, display, controls.
- Low quality: pixel ratio capped at 1 and ~720p of pixels (`DISPLAY.lowRenderPixels`,
  `computeViewport`, `refreshViewport()` re-measures immediately); about half the sparks, smoke
  and missile trails (`Effects.low`). Camera shake goes through `MapScene.shake()`.
- Phone buttons sit on an arc around the right stick (`CONTROLS.buttonArc`, `buttonSlots`,
  `interactSlot`), scaled by `buttonScale`; swap first in swap mode, then flares, shield; USE
  lower-left. HUD draws the dashed outer ring in tiers mode and an fps readout when enabled.

## Tutorial and sound notes (M11 part 2)

- Tutorial (`MissionType` 'tutorial', weight 0 so contracts never roll it; `TUTORIAL` in
  data/missions.ts): a hand-laid 2000² map (`tutorialMap` in mapgen) and six steps driven by
  `TutorialMission` (game/missions): walk to a marker, destroy a practice target
  (`dummy`) with group 1, another with group 2 (heat), repair at a free pad after scripted damage,
  kill one light tank (enemy damage ×0.3), evac. `tutorialText()` words each prompt for the
  device, movement scheme and phone firing mode. Launched only from the title screen ("Tutorial
  (2 min)"; the contract-board card was removed after the M11 playtest as nagging)
  (`App.startTutorial`): a loaner Vulture, zero field prices, nothing touches the career; the
  end screen returns to the hangar or title.
- Station prompts now decide "nothing to do" from need, not cost (free pads say "free").
- Sound (`core/audio.ts`): `play(id, volume, rate)`; `VARIED` sounds get random pitch.
  New: footsteps for the player and enemy mechs (`playStep(tonnage, volume)`: heavier = lower,
  longer and louder, a Kestrel ~60% of a Roc),
  `hurt` when the player takes damage, `powerDown`/`powerUp` on overheat shutdown and restart,
  `repair` at a repair pad, `win`/`lose` stings, and a quiet low-passed noise ambience during
  missions (`startAmbience`/`stopAmbience`).
- Sound pass after the M11 playtest: phone speakers play little below ~300 Hz, and the old step
  (220 Hz thud) and ambience (160 Hz rumble) were inaudible on phones (−60 to −68 dB above
  300 Hz). Footsteps (second try, after the user found the metal clank too "steel drum"): a
  deep thud via `thud()`: a sine falling 95→42 Hz (× `stepPitch`) through an asymmetric tanh
  soft-clipper (`shaperCurve`, even + odd harmonics) so phone speakers imply the missing low
  fundamental, high-passed at 45 Hz (DC, sub boom) and low-passed at 900 Hz (no ringing), plus a
  dull low-passed noise knock and quiet debris. Spectral centroid 85–145 Hz. Ambience adds an engine drone (two detuned 46 Hz saws through a
  low-pass) that opens up with walking speed and dies down during heat shutdown
  (`setEngineLoad(load, tonnage, running)`, called every frame from MapScene; only real changes
  touch the audio graph). Measured offline (`__setContextForTest`, dev only): steps −41/−38/−33
  dB (light/medium/assault; cannon shot −32) at the old player volume 0.6; lowered to 0.45
  (about −2.5 dB; enemy mechs 0.4 × distance) after the user found them a bit loud. Idle engine
  −47 dB, walking −43 dB.
- Test scripts may still click `.card:not(.tutorial)`; harmless now that the card is gone.

## Conventions

- Units: world units are pixels at zoom 1; angles in radians internally (data files use degrees
  for readability); time in ms from Phaser, convert to seconds for physics.
- Angle 0 = facing right (+x); positive is clockwise on screen. Mech art faces right.
- Target browsers: ES2020 (iOS 14+ Safari). Avoid newer APIs like `structuredClone` without a fallback.
- Colours as `0xRRGGBB` numbers in data/config files.
- Don't put model or tool identifiers in commits or code.
