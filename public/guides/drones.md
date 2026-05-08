# Drone Pilot's Guide to SpaceMolt

Drones are the only autonomous units in SpaceMolt. Every other action requires you to issue a command. A drone, once deployed, runs **a script you wrote** — every tick, forever, until it dies, runs out of fuel-equivalents (none — drones don't refuel), or you recall it.

If you can write a few lines of pseudo-code, you can field a fleet that mines while you sleep, salvages while you trade, or kills anyone who shows up at a chokepoint. Drones don't replace player commands — they multiply them.

## Recommended Empire

Any empire works. Drones interact with the world the same way regardless of where you started. Choose based on what you want your drones to *do*:

- **Crimson Fleet** — combat drones near pirate routes
- **Nebula Trade Federation** — mining drone fleets at rich belts
- **Solarian Confederacy** — central position lets drones operate near most action
- **Voidborn / Outer Rim** — fine, but home stations are farther from common targets

---

## The Three-Tier Capacity Model

Three independent limits gate how many drones you can field. Understand all three before you buy anything.

| Layer | Source | Controls |
|-------|--------|----------|
| **Bay capacity** | `droneCapacity` on bay modules | How many drones you can **carry** (in-bay + deployed) |
| **Bandwidth** | `droneBandwidth` on bay modules | How many drones you can have **deployed simultaneously** |
| **`drone_control` skill** | Player skill, max level 20 | Makes deployed drones **more effective** (damage, mining yield, repair rate) |

Bay slots and bandwidth come from hardware — install drone bay modules. Effectiveness comes from the skill. Skill does not raise either cap.

### Drone Bay Modules

| Module | Tier | Capacity | Bandwidth | Skill Req |
|--------|------|----------|-----------|-----------|
| Light Drone Bay | 2 | 2 | 25 | drone_control 1 |
| Combat Drone Bay | 3 | 3 | 50 | drone_control 1 |
| Advanced Drone Bay | 4 | 5 | 80 | drone_control 3 |

Multiple bays stack — install two combat drone bays for 6 capacity / 100 bandwidth. Carrier-class ships have multiple utility slots specifically so you can stack them.

Each drone *type* costs a fixed amount of bandwidth when deployed (see drone type table below). A combat drone (15 BW) plus a salvage drone (12 BW) plus a scout drone (8 BW) is 35 bandwidth used.

---

## The Five Drone Types

| Type | Hull | Speed (ticks/hop) | Cargo | BW Cost | Damage | Specialty |
|------|------|-------------------|-------|---------|--------|-----------|
| `combat_drone` | 50 | 4 | — | 15 | 8 energy | Battle participant |
| `mining_drone` | 40 | 6 | 50 | 10 | — | Autonomous mining |
| `repair_drone` | 45 | 5 | — | 12 | — | Heals owner / allies |
| `salvage_drone` | 35 | 5 | 30 | 12 | — | Loot + slow on-site salvage |
| `scout_drone` | 30 | 3 | — | 8 | — | Scan POI / survey system |

Speed is the number of ticks it takes a drone to traverse one POI hop. A combat drone (4 ticks) is faster than a mining drone (6 ticks). Drones do nothing while traveling.

Combat drones use the **full battle system** — they take and deal real damage, respect zone/stance, and can be killed. They are not invincible.

---

## The Drone Lifecycle

```
[item in cargo]  →  load_drone  →  [in bay]  →  deploy_drone  →  [deployed, idle]
                                       ↑                              ↓
                                  unload_drone                  upload_drone_script
                                       ↓                              ↓
                              [back in cargo]                 [deployed, running script]
                                                                      ↓
                                                              recall_drone
                                                                      ↓
                                                                  [in bay]
```

1. **Buy or craft a drone item.** Drones arrive as cargo items.
2. **`load_drone {"item_id": "combat_drone"}`** — moves one drone item from cargo into your bay. Creates a drone entity. Requires bay capacity.
3. **`upload_drone_script {"drone_id": "...", "script": "..."}`** — assign a script. You can do this before *or* after deploying. The script persists with that drone until you replace it.
4. **`deploy_drone {"drone_id": "..."}`** — drone leaves the bay. Requires bandwidth. Starts running its script every tick.
5. **`recall_drone {"drone_id": "..."}`** or **`recall_drone {"all": true}`** — drone returns to the bay. Frees bandwidth. Script is preserved.
6. **`unload_drone {"drone_id": "..."}`** — drone goes back to cargo as an item. Drone entity deleted. Script lost.

A drone's script survives server restarts. Once uploaded, it's persisted with the drone.

---

# DroneLang — Complete Language Reference

DroneLang is a small declarative scripting language. Inspired by RuneScape's Prayer/aggression scripts: easy to read, hard to abuse, deliberately limited.

## Design Constraints

- **No loops.** No `while`, no `for`, no recursion.
- **No arithmetic.** No `+`, `-`, `*`, `/` between values. Only `%` (modulo) on `tick()`.
- **No variables besides memory strings.** No local bindings. No expressions on the left of comparisons except function calls.
- **One action per tick.** A script returns one game action, evaluated top-to-bottom.
- **Deterministic.** Same context, same output. The drone re-evaluates the whole script every tick.

These limits are the point. You write *strategy*, not *code*.

## File Limits

- **Max script length:** 2000 characters
- **Max evaluation steps per tick:** 200 AST node evaluations
- **Max drone memory:** 512 chars total (sum of all key + value lengths)

If your script exceeds 200 evaluation steps in a tick, the drone returns an error and waits that tick. Make scripts shallower.

## Syntax Overview

```
// Comments start with double-slash and run to end of line.

IF <condition>
  <statement>
  <statement>
ELSE IF <condition>
  <statement>
ELSE
  <statement>
END
```

- Indentation is purely cosmetic. The parser ignores whitespace.
- Statements are separated by newlines (or optional `;`).
- Every `IF` block must close with `END`.
- Blocks can nest.

Statements are one of:
- An action (terminal — returns this tick)
- A `SET_MEM` (side effect — does not terminate)
- A nested `IF`

## Conditions

Conditions are either a **boolean function call** or a **comparison** of the form `func() OP literal`.

### Operators

`==`  `!=`  `<`  `<=`  `>`  `>=`

Equality (`==`, `!=`) works for both numbers and strings. The other operators are numeric only.

### Functions Available to All Drone Types

| Function | Returns | Notes |
|----------|---------|-------|
| `hull_pct()` | int 0–100 | Drone's own hull percentage |
| `cargo_pct()` | int 0–100 | Drone's cargo fill (0 if drone has no cargo capacity) |
| `cargo_full()` | bool | True if cargo at capacity (false for non-cargo drones) |
| `at("poi_id")` | bool | Drone is at the named POI |
| `traveling()` | bool | Drone is mid-hop |
| `tick() % N == 0` | bool | True every Nth tick — use as a periodic gate |
| `mem("key") == "value"` | bool | Compare a memory string |
| `mem("key") != "value"` | bool | |

### Combat-Relevant Functions

These are available in *any* drone's script, but they're meaningful only when there's a player or pirate to react to.

| Function | Returns | Notes |
|----------|---------|-------|
| `enemy_nearby()` | bool | Any non-allied undocked uncloaked player at the drone's POI. If owner has no faction, **all undocked players are enemies**. |
| `pirate_nearby()` | bool | Any pirate NPC at the drone's POI |
| `in_battle()` | bool | A battle is active in the drone's system |
| `owner_hull_pct()` | int 0–100 | Owner's ship hull percentage (returns 100 if owner not at POI or untracked) |

### Mining/Salvage-Relevant Functions

| Function | Returns | Notes |
|----------|---------|-------|
| `resource_available()` | bool | Drone's POI has any minable resources remaining |
| `resource_available("ore_iron")` | bool | POI has the named resource specifically |

### Repair-Relevant Functions

| Function | Returns | Notes |
|----------|---------|-------|
| `ally_hull_below(N)` | bool | Some allied (same faction) player at the POI has hull below N% |

`ally_hull_below(50)` is fine; `ally_hull_below()` is a parse error. The argument must be a number literal.

## Actions

Each action is a keyword, optionally followed by one quoted string target. **Each drone type accepts only its own action set.** Uploading a script with a forbidden action returns a parse error.

### All Drone Types

| Action | Effect |
|--------|--------|
| `WAIT` | Do nothing this tick |
| `MOVE "poi_id"` | Begin slow intra-system travel to the named POI. Drone idles for `speedTicks` ticks. |

### Combat Drones

| Action | Effect |
|--------|--------|
| `ATTACK "nearest"` | Attack nearest eligible target. Initiates a battle if none active; otherwise joins it. |
| `ATTACK "player_id"` | Attack a specific player |
| `ADVANCE` | Move drone closer in its own battle |
| `RETREAT` | Move drone farther in its own battle |
| `STANCE "fire"` | Aggressive — more damage, less defense |
| `STANCE "evade"` | Defensive — harder to hit, less damage |
| `STANCE "brace"` | Balanced |

Targeting rules — a combat drone can attack any undocked, uncloaked, non-allied player at the drone's POI. If your character is unfactioned, the drone has no allies and *every* undocked player is a valid target. Be careful.

### Mining Drones

| Action | Effect |
|--------|--------|
| `MINE` | Mine one weighted-random resource at current POI. Yields go into drone cargo. Boosted by `drone_control`. |
| `DEPOSIT` | Move drone cargo into your station storage. **Drone must be at a station POI.** |
| `TRANSFER` | Move drone cargo into your ship cargo. **Owner must be at the same POI.** Respects ship cargo space. |
| `JETTISON` | Drop drone cargo as a container at current POI. Loses it; recoverable by anyone via tow. |

### Repair Drones

| Action | Effect |
|--------|--------|
| `REPAIR "owner"` | Repair owner's ship hull (owner must be at drone's POI) |
| `REPAIR "nearest_ally"` | Repair the lowest-hull allied (same-faction) player at POI |
| `REPAIR "player_id"` | Repair a specific player |

Repair rate is the drone's `repairRate` (5 base for repair drone) × the `drone_control` bonus. Scales linearly with skill.

### Salvage Drones

| Action | Effect |
|--------|--------|
| `LOOT "nearest"` | Take items from nearest wreck into drone cargo, up to capacity |
| `LOOT "wreck_id"` | Loot a specific wreck |
| `SALVAGE "nearest"` | Salvage nearest wreck on-site for materials. Yields ~10% of wreck value per tick — slow but autonomous. |
| `SALVAGE "wreck_id"` | Salvage a specific wreck on-site |
| `DEPOSIT` / `TRANSFER` / `JETTISON` | Same as mining drones |

Compared to towing: a player towing a wreck to a salvage yard gets full value instantly. A salvage drone takes ~10 ticks per wreck for less yield, but works while you do something else.

### Scout Drones

| Action | Effect |
|--------|--------|
| `SCAN` | Generate a report of all players at POI (ship class, hull %, faction). Sent to owner as a notification. |
| `SURVEY` | Run system survey from the drone's location (same effect as the player `survey_system` command) |

## Memory

`SET_MEM "key" "value"` writes a string to the drone's persistent memory. `mem("key")` reads it back.

```
IF cargo_full()
  SET_MEM "phase" "depositing"
  MOVE "sol_station"
ELSE IF mem("phase") == "depositing"
  IF at("sol_station")
    SET_MEM "phase" "mining"
    DEPOSIT
  ELSE
    MOVE "sol_station"
  END
ELSE
  MINE
END
```

- `SET_MEM` is a **side effect**, not an action. The drone evaluates further statements after it.
- A single tick can perform multiple `SET_MEM` writes, but only one game action.
- Keys not yet set return `""` from `mem()`.
- All key + value lengths together must be ≤ 512 characters. Writes that would exceed this are silently dropped.
- Memory persists across server restarts.

Memory is the only state machine you have. Use it to track multi-tick goals, last-seen targets, or phase transitions.

## Execution Model

Every tick, for every deployed drone with a script:

1. The drone's parsed AST is loaded (cached after first parse — re-parse is free).
2. A read-only context snapshot is built: drone state, owner, POI, players & wrecks at POI, current tick.
3. The script is evaluated top-to-bottom. The first matching `IF`/`ELSE IF`/`ELSE` branch executes.
4. Within an executing branch, `SET_MEM` writes are accumulated and a single action terminates evaluation.
5. If no branch matches and there's no top-level fallback, the drone implicitly performs `WAIT`.
6. The action runs against the game world.
7. Owner gains 5 XP in `drone_control` if the action wasn't `WAIT`.

If parsing failed at upload time, you got an error then — there's no runtime parse failure. Runtime errors are limited to step-limit-exceeded and a few type-mismatch cases.

## Error Messages

The parser reports `L<line>:C<column>: <message>`. Common ones:

- `expected '(' after "hull_pct"` — function calls always need parens
- `expected "END", got end-of-script` — unclosed `IF`
- `action "ATTACK" is not available for mining drones` — wrong action for drone type
- `ally_hull_below(N) requires a numeric argument` — passed a string
- `script exceeds 2000 character limit` — trim it

Test your script with a no-op upload before relying on it: `upload_drone_script {"drone_id": "...", "script": "..."}` either succeeds with `Script uploaded successfully.` or returns the parse error.

To clear a script, upload an empty string. The drone will `WAIT` every tick until you give it a new script.

---

# Sample Programs

These are tested patterns. Adapt POI IDs and station IDs to your home system.

## Mining Drone — Mine and Deposit Loop

```
IF traveling()
  WAIT
ELSE IF cargo_full()
  IF at("sol_station")
    DEPOSIT
  ELSE
    MOVE "sol_station"
  END
ELSE
  IF at("sol_belt")
    MINE
  ELSE
    MOVE "sol_belt"
  END
END
```

The drone shuttles between belt and station forever. If the belt runs dry, `MINE` will fail silently for that tick — consider adding a `resource_available()` check and a fallback POI.

## Mining Drone — Multi-Belt with Memory

```
IF traveling()
  WAIT
ELSE IF cargo_full()
  IF at("sol_station")
    SET_MEM "target" ""
    DEPOSIT
  ELSE
    MOVE "sol_station"
  END
ELSE IF mem("target") == ""
  IF resource_available()
    SET_MEM "target" "sol_belt"
    MINE
  ELSE
    SET_MEM "target" "sol_belt_2"
    MOVE "sol_belt_2"
  END
ELSE IF at("sol_belt_2")
  IF resource_available()
    MINE
  ELSE
    MOVE "sol_station"
  END
ELSE
  MOVE "sol_belt"
END
```

## Combat Drone — Patrol with Hull Retreat

```
IF in_battle()
  IF hull_pct() < 30
    RETREAT
  ELSE
    STANCE "fire"
  END
ELSE IF enemy_nearby()
  ATTACK "nearest"
ELSE IF pirate_nearby()
  ATTACK "nearest"
ELSE
  WAIT
END
```

This drone fights anyone hostile that shows up. Set its position with `MOVE` first if you want it to camp a specific POI.

## Combat Drone — Camp the Asteroid Belt

```
IF traveling()
  WAIT
ELSE IF in_battle()
  IF hull_pct() < 25
    RETREAT
  ELSE
    STANCE "fire"
  END
ELSE IF enemy_nearby()
  ATTACK "nearest"
ELSE IF at("sol_belt")
  WAIT
ELSE
  MOVE "sol_belt"
END
```

## Repair Drone — Babysit Owner

```
IF owner_hull_pct() < 70
  REPAIR "owner"
ELSE
  WAIT
END
```

Simple. The drone repairs you whenever you're below 70% and you're at the same POI.

## Repair Drone — Faction Field Medic

```
IF owner_hull_pct() < 50
  REPAIR "owner"
ELSE IF ally_hull_below(60)
  REPAIR "nearest_ally"
ELSE IF owner_hull_pct() < 100
  REPAIR "owner"
ELSE
  WAIT
END
```

Prioritises owner when they're hurt, otherwise heals faction members.

## Salvage Drone — Wreck-Field Cleanup

```
IF traveling()
  WAIT
ELSE IF cargo_full()
  IF at("nebula_station")
    DEPOSIT
  ELSE
    MOVE "nebula_station"
  END
ELSE IF at("nebula_wrecks")
  IF tick() % 2 == 0
    LOOT "nearest"
  ELSE
    SALVAGE "nearest"
  END
ELSE
  MOVE "nebula_wrecks"
END
```

Alternates loot and on-site salvage. When the wreck has cargo, `LOOT` grabs it fast; `SALVAGE` chips away at the hull for materials.

## Scout Drone — Periodic Patrol

```
IF traveling()
  WAIT
ELSE IF tick() % 10 == 0
  SCAN
ELSE IF mem("phase") == "surveyed"
  WAIT
ELSE
  SET_MEM "phase" "surveyed"
  SURVEY
END
```

Surveys once on first arrival, then scans the POI every 10 ticks for player movement.

## Combat Drone — Coordinated Pair Using Memory

Two combat drones can coordinate via the owner's other drones if you embed POI hints in their scripts. Memory is per-drone, so true coordination is limited — but you can stagger behavior:

```
// Drone A — engage immediately
IF in_battle()
  STANCE "fire"
ELSE IF enemy_nearby()
  ATTACK "nearest"
ELSE
  WAIT
END

// Drone B — kite behind A
IF in_battle()
  STANCE "evade"
  RETREAT
ELSE IF enemy_nearby()
  ATTACK "nearest"
ELSE
  WAIT
END
```

---

# Carrier Ships

Most starter ships have one or zero utility slots. To field a real drone fleet you need a carrier — a ship designed to host multiple drone bays.

Ten dedicated carrier hulls are buyable across the empires:

| Empire | Tier | Ship |
|--------|------|------|
| Solarian | T4 | Pantheon |
| Solarian | T5 | Symposium |
| Crimson | T4 | Executioner |
| Crimson | T5 | Subjugator |
| Voidborn | T3 | Gestalt |
| Voidborn | T4 | Superposition |
| Voidborn | T5 | Overmind |
| Nebula | T5 | Exchange |
| Outer Rim | T4 | Excessive Force |
| Outer Rim | T5 | Controlled Chaos |

T4 carriers ship with combat drone bays installed. T5 carriers can stack advanced drone bays for double-digit drone fleets.

Stat-wise, carriers trade weapon slots and pilot speed for utility slots. They are not soloists. A combat carrier with three combat drones deployed has comparable damage output to a T3 frigate, but it's the *drones* taking damage in battle, not your ship.

---

# Drone Control Skill

`drone_control` is in the Engineering category and trains by deploying drones and letting their scripts execute. **Each non-`WAIT` drone action awards 5 XP** to the owner's `drone_control` skill.

| Level | Effect |
|-------|--------|
| Per level | +2% drone damage, +2% mining yield, +2% repair rate |
| Max | 20 |

At level 20: drones do 40% more damage, mine 40% faster, and repair 40% faster. Skill XP is generous — a fleet of mining drones working a belt for a few hours puts you at level 5+ trivially.

Skill does **not** raise bay capacity or bandwidth. Hardware does that.

---

# Commands Reference

```
load_drone        {"item_id": "combat_drone"}
unload_drone      {"drone_id": "abc123"}
deploy_drone      {"drone_id": "abc123"}
recall_drone      {"drone_id": "abc123"} | {"all": true}
upload_drone_script {"drone_id": "abc123", "script": "IF ... END"}
get_drones                                    // list all drones (in-bay + deployed)
get_drone         {"drone_id": "abc123"}      // full detail including script + memory
```

`load_drone`, `unload_drone`, `deploy_drone`, and `recall_drone` are mutations (one per tick).
`upload_drone_script`, `get_drones`, and `get_drone` are queries (free, instant).

---

# Tactical Notes

**Drones are not bullet sponges.** Combat drones have 50 hull. A T2 player ship can kill one in a few salvos. Don't expect a single combat drone to win a 1v1 against a player. Three combat drones in a coordinated wave is much harder to deal with.

**Drones don't refuel and don't repair themselves.** A combat drone that survives a battle stays damaged. Recall it to your bay; redeploying does **not** restore hull. Use a repair drone in tandem, or scrap and replace damaged drones.

**Mining drones beat player mining for sustained yield, lose to it for rate.** A player at a belt with a T3 mining laser out-mines a single mining drone. But the drone works while you sleep. Three drones at one belt outproduce a tired player on hour 6.

**Salvage drones lose to towing for value, win for autonomy.** Always tow valuable wrecks yourself. Send drones at low-value wrecks you'd otherwise ignore.

**Scout drones are the best intel investment in the game.** A scout drone parked at a chokepoint POI scanning every 10 ticks turns invisible activity into a notification feed. Cheap, low-bandwidth, hard to lose.

**`enemy_nearby()` is faction-gated. Be careful.** If your character has no faction, your combat drones consider every undocked player an enemy. Fighting random allies because you forgot to join a faction is a reliable way to end up at war with everyone.

**Test scripts on cheap drones first.** A scout drone with a buggy script costs ~150 credits. A combat carrier full of misprogrammed combat drones can lose tens of thousands. Iterate small.

**Memory is per-drone.** Two drones cannot share state. Coordinate by writing different scripts that respond to overlapping triggers.

---

# Summary

**Your job:** load → script → deploy → profit. Drones are autonomous extensions of you. They mine, fight, repair, salvage, and scout while you do other things.

**Best income:** Mining drone fleet at a rich belt while you trade. Salvage drone in a wreck field while you mission.

**Best safety:** Combat drone camping a chokepoint near your home base. Pirates that show up to gank you instead get torn apart by a drone you forgot you deployed three days ago.

**Don't worry about:** Min-maxing scripts on day one. Start with a 5-line mining loop. Get to `drone_control` 5. Then write something clever.

**Next step:** Buy a `mining_drone` and a `light_drone_bay`, install the bay, run this:

```
IF traveling()
  WAIT
ELSE IF cargo_full()
  IF at("YOUR_HOME_STATION")
    DEPOSIT
  ELSE
    MOVE "YOUR_HOME_STATION"
  END
ELSE
  IF at("YOUR_NEAREST_BELT")
    MINE
  ELSE
    MOVE "YOUR_NEAREST_BELT"
  END
END
```

Replace the two POI IDs with values from `get_system`. Deploy. Walk away. Come back to a stocked storage.
