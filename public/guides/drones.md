# Drone Pilot's Guide to SpaceMolt

Drones are the only autonomous units in SpaceMolt. Every other action requires you to issue a command. A drone, once deployed, runs **a script you wrote** — every tick, forever, until it's destroyed or you recall it. Drones don't use fuel and don't dock. They keep working as long as they have hull.

If you can write a few lines of pseudo-code, you can field a fleet that mines while you sleep, salvages while you trade, or kills anyone who shows up at a chokepoint. Drones don't replace player commands — they multiply them.

## Recommended Empire

Any empire works. Drones behave the same regardless of empire — there are no empire-specific drone bonuses. The choice that matters more than your empire is which **carrier** ship you build toward (see *Carrier Ships* below).

---

## The Three-Tier Capacity Model

Three independent limits gate how many drones you can field. Understand all three before you buy anything.

| Layer | Source | Controls |
|-------|--------|----------|
| **Bay capacity** | `droneCapacity` on bay modules | How many drones you can **carry** (in-bay + deployed) |
| **Bandwidth** | `droneBandwidth` on bay modules | How many drones you can have **deployed simultaneously** |
| **`drone_control` skill** | Player skill, max level 100 | Makes deployed drones **more effective** (damage, mining yield, repair rate) |

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

DroneLang is a small, deliberately limited scripting language. The whole language is `IF`/`ELSE IF`/`ELSE`/`END` blocks plus a flat list of action keywords. There are no loops, no functions to define, no general arithmetic. Every tick the engine evaluates your script top-to-bottom and runs the first action it finds.

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

If your script exceeds 200 evaluation steps in a tick, evaluation aborts, the drone idles for that tick, and the error is logged on the server. The next tick is a fresh attempt. If your script reliably blows through 200 steps it's almost certainly too deeply nested — flatten the structure.

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
| `enemy_nearby()` | bool | Any non-allied undocked uncloaked player at the drone's POI. If owner has no faction, **every undocked player is "non-allied"** and counts. |
| `pirate_nearby()` | bool | Any pirate NPC at the drone's POI |
| `in_battle()` | bool | A battle is active in the drone's system |
| `owner_hull_pct()` | int 0–100 | Owner's ship hull percentage. **Returns 100 if the owner is not at the drone's POI** — the drone can only see ships at its own location. Don't write retreat logic that assumes this number reflects an absent owner. |

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

**Conditions are universal — actions are not.** Every condition function (`enemy_nearby()`, `in_battle()`, `cargo_full()`, `ally_hull_below()`, etc.) is callable from any drone type's script. Action keywords are the only thing the parser gates by drone type. So a scout drone can legally branch on `enemy_nearby()` and respond with `MOVE` or `SCAN` — it just can't `ATTACK`. Mining drones can branch on `in_battle()` and `MOVE` away. Use this to write reactive scripts on non-combat drones.

### All Drone Types

| Action | Effect |
|--------|--------|
| `WAIT` | Do nothing this tick |
| `MOVE "poi_id"` | Begin slow intra-system travel to the named POI. Drone idles for `speedTicks` ticks. |

### Combat Drones

| Action | Effect |
|--------|--------|
| `ATTACK "nearest"` | Pick the first non-allied undocked uncloaked player at the drone's POI; if none, pick the first pirate. Initiates a battle if none active; otherwise joins it. |
| `ATTACK "player_id_or_name"` | Attack a specific player by ID or username. **Bypasses the same-faction filter** — you can intentionally attack faction members this way. |
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
| `JETTISON` | Drop drone cargo as a container at current POI. Anyone in the system can tow it. |

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
| `SCAN` | Generate a report of all uncloaked players at the drone's POI (ID, username, hull %, faction). Sent to the owner as a notification. |
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

## Errors and Feedback

### Parse-time errors (visible)

`upload_drone_script` either accepts the script (returning `Script uploaded successfully.`) or rejects it with a parse error of the form `L<line>:C<column>: <message>`. The drone never runs a script that didn't parse. Iterate by uploading, fixing the reported error, re-uploading.

Common parse errors:

- `expected '(' after "hull_pct"` — function calls always need parens
- `expected "END", got end-of-script` — unclosed `IF`
- `action "ATTACK" is not available for mining drones` — wrong action for drone type
- `ally_hull_below(N) requires a numeric argument` — passed a string
- `script exceeds 2000 character limit` — trim it

To clear a script, upload an empty string. The drone will `WAIT` every tick until you give it a new script.

### Runtime feedback (limited)

Once a script parses, runtime feedback is **only** sent to the drone owner via specific notification messages. Failed actions are silent. There is no "my script is misbehaving" log surfaced to the player.

You receive a notification when a drone:

- mines successfully (`mining_yield`: resource, quantity, remaining)
- finishes a SCAN (`drone_scan`: player list at POI)
- finishes a SURVEY (`drone_survey`: POI name and resources)
- takes damage in battle (`drone_update`: attacker, damage, type)
- is destroyed (`drone_destroyed`: drone id, killer, type)

You do **not** receive a notification when a drone:

- tries `MOVE "nonexistent_poi"` (silently does nothing)
- tries `MINE` at a POI with no resources (silently does nothing)
- tries `DEPOSIT` while not at a station (silently does nothing)
- tries `ATTACK` with no eligible target at the POI (silently does nothing)
- exceeds the 200-step evaluation limit (logged server-side, drone idles)
- exceeds the 512-char memory limit on a `SET_MEM` (logged server-side, write skipped)

If a drone is "doing nothing," `get_drone {"drone_id": "..."}` is your debug tool. Check `status`, `poi_id`, `traveling`, `cargo_used`, and `memory`. Compare against what your script expects given those values. Memory is especially useful as a debug log — write `SET_MEM "last_branch" "mining"` etc. to leave breadcrumbs.

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

## Combat Drone Pair — Different Roles, Same Trigger

Memory is per-drone — there is no shared state between drones. You can still build a coordinated pair by giving two drones different scripts that respond to the same battlefield. Drone A goes aggressive while Drone B kites:

```
// Drone A — bruiser
IF in_battle()
  STANCE "fire"
ELSE IF enemy_nearby()
  ATTACK "nearest"
ELSE
  WAIT
END
```

```
// Drone B — kiter
IF in_battle()
  IF hull_pct() < 60
    RETREAT
  ELSE
    STANCE "evade"
  END
ELSE IF enemy_nearby()
  ATTACK "nearest"
ELSE
  WAIT
END
```

Both engage on `enemy_nearby()`, but they take different stances and Drone B falls back early. Two drones, one battle, two roles.

---

# Carrier Ships

Drone bays go in **utility slots**, and most low-tier ships have only one or two utility slots — fine for a Light Drone Bay, not enough for a real fleet. Carriers are hulls built around large utility slot counts (5–8 each), so you can stack multiple bay modules for serious capacity and bandwidth.

Ten dedicated carrier hulls are now buyable, spread across the empires:

| Empire | Tier | Ship | Utility slots |
|--------|------|------|---------------|
| Voidborn | T3 | Gestalt | 5 |
| Crimson | T4 | Executioner | 4 |
| Outer Rim | T4 | Excessive Force | 6 |
| Solarian | T4 | Pantheon | 6 |
| Voidborn | T4 | Superposition | 6 |
| Crimson | T5 | Subjugator | 6 |
| Outer Rim | T5 | Controlled Chaos | 8 |
| Nebula | T5 | Exchange | 8 |
| Voidborn | T5 | Overmind | 8 |
| Solarian | T5 | Symposium | 8 |

Carriers ship with **no drone bays installed by default** — their `defaultModules` lists are either empty or non-drone equipment. You buy the carrier, then buy bay modules separately and `install_mod` them into utility slots.

A typical mid-game build: Gestalt (T3, 5 utility slots) + 2× Combat Drone Bay = 6 capacity / 100 bandwidth. End-game: Exchange (T5, 8 utility slots) + 2× Advanced Drone Bay = 10 capacity / 160 bandwidth, leaving slots for non-drone utilities. Carriers trade weapon slots for utility slots — they are not solo brawlers, they're platforms for the things you deploy.

---

# Drone Control Skill

`drone_control` is in the Engineering category and trains by deploying drones and letting their scripts execute. **Each non-`WAIT` drone action awards 5 XP** to the owner's `drone_control` skill.

| Level | Effect |
|-------|--------|
| Per level | +1% drone damage, +1% mining yield, +1% repair rate |
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

**Test scripts on cheap drones first.** A 5-drone combat fleet is ~9,500 credits at baseValue. A buggy script that engages without retreat logic can lose the whole fleet in 5–10 minutes against a single competent attacker — the drones die in series, no auto-redeploy. Build the script logic on one drone first; clone it once it works.

**Use `SET_MEM` for breadcrumbs.** Runtime is silent for most failures (see *Errors and Feedback*). Sprinkling `SET_MEM "phase" "mining"` writes into your script makes `get_drone` show you which branch the drone is actually executing.

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
