# Mech lineup: notes and ideas

Written after the M11 playtest, when the user asked whether the chassis lineup has room for more
extreme mechs. This is the thinking behind milestone 16 (Chassis expansion) in `docs/PLAN.md`.
Numbers are from `src/data/chassis.ts` at the time; proposed values are starting points to tune.

## The current lineup

| Chassis | Tons | Speed | Torso turn °/s | Torso armor | Mounts | Source |
|---|---:|---:|---:|---:|---|---|
| Jackal | 25 | 240 | 160 | 190 | 4 small, 1 small back | Freestars |
| Kestrel | 30 | 215 | 150 | 230 | 1 medium, 2 small | Open market |
| Shrike | 35 | 195 | 125 | 260 | 1 large | Freestars |
| Vulture | 50 | 150 | 90 | 380 | 2 medium, 2 small, 1 medium back | Open market (starter) |
| Seraph | 55 | 145 | 105 | 360 | 1 large, 3 medium | Technocrats |
| Condor | 70 | 118 | 70 | 520 | 1 large, 3 medium, 2 medium back | Open market |
| Bastion | 80 | 105 | 62 | 640 | 2 large, 2 medium, 1 medium back | Royalists |
| Roc | 90 | 92 | 55 | 700 | 2 large, 3 medium, 1 small, large + medium back | Open market |

## What the data says

- **One straight line.** Speed, turning and armor all scale almost linearly with tonnage, so every
  chassis is "the one before it, a bit heavier". The ends of the line (25 t and 90 t) are not
  very extreme: speed only spans 2.6× (92–240).
- **A gap in the middle.** Speed drops from 195 (Shrike, 35 t) to 150 (Vulture, 50 t), the
  biggest step in the lineup. Nothing sits at 40–45 t.
- **One role.** Every chassis is a direct-fire platform; they differ in mount count, mount size and
  frame power. Nothing is built around back mounts (support, artillery), sensors (scout), or
  close-in brawling. The Shrike (one large gun) and the Seraph (energy frame) are the only
  chassis with a strong identity, and they're the ones players notice.
- **Abilities and artillery are what make extremes play differently.** A faster light is just a
  faster light until it can jump; a heavier assault is just tougher until it can brace or
  bombard. So the expansion comes after milestones 14 (artillery) and 15 (abilities).

## Candidates

### Ultralight (about 20 t)
- Speed 270+, torso turn about 180°/s, very thin armor (torso about 150), 2–3 small mounts,
  jump jets as its ability.
- Plays as a raider and harasser: raids, hunts, picking off artillery spotters.
- Balance notes: vehicle guns lead targets by half their speed (`aimLead` 0.3–0.6), so at 270+
  it's close to untouchable on the move. It must die quickly when caught: low armor, small
  vision radius, little heat capacity. On phones it will often run into enemies before seeing
  them (640 units of view on the short side); a wider vision cone may be needed.
- Fits every tonnage-limited contract (40 t is the lowest limit).

### Fast medium (about 45 t)
- Speed about 180, torso turn about 120°/s, torso armor about 320, 2 medium and 1 small mount,
  overdrive as its ability.
- Fills the gap between the Shrike and the Vulture; the "striker" a player graduates to from
  lights without becoming slow.
- Fits the 55 t contract limit, which the Seraph (55 t) barely does.

### Super-heavy (about 110 t)
- Speed about 70, torso turn about 42°/s, torso armor about 900, two large back mounts plus heavy
  direct mounts, bulwark as its ability.
- Plays as a siege platform: defend and Search & destroy, with player artillery.
- Constraints:
  - Collision radius at most about 47. Maps keep a 100-unit gap between solid obstacles
    (`minGap`), so a bigger mech could get stuck. The Roc is 42.
  - Crush tonnage 110 knocks over barriers and sandbags (crush 70 and 60); buildings and walls
    still block it, which is good: it shouldn't flatten towns.
  - It fails every tonnage-limited contract (75 t is the highest limit). That's a real cost and
    keeps a varied hangar useful.
  - Large maps (4400 units across) take about a minute to cross at 70. Raid trucks drive at 44,
    so it can still catch a convoy, barely.
  - Footsteps scale with weight (`stepPitch`, `playStep`), so it will sound like it should.

### Support frame (about 60–65 t)
- Built around two large back mounts and a sensor bonus (wider cone, radar), with light direct
  mounts. Medium speed (about 125).
- Only worth adding once player artillery exists (milestone 14): it's the mech that makes
  indirect fire a whole playstyle rather than a side weapon.

### Other directions (not planned)
- **Sniper:** long vision range, narrow cone, slow torso, large direct mounts. Could be a variant
  of an existing frame rather than a new chassis.
- **Brawler:** a fast heavy (about 65 t at 135) with charge and armor biased to the front.
- **Faction signatures:** each faction's shop could carry one extreme chassis (Freestars the
  ultralight, Royalists the super-heavy, Technocrats the support frame), which also gives
  reputation a long-term goal.

## Order

1. Milestone 15 (abilities) first, so the new chassis get abilities that suit them.
2. Then the fast medium (lowest risk, fills a real gap) and the ultralight.
3. The super-heavy and the support frame once artillery (milestone 14) has been played.
