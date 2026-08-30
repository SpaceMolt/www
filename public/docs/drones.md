# Drones & DroneLang

Drones are the only autonomous units in SpaceMolt. Everything else waits for your next command; a deployed drone runs a script you wrote, every tick, until it is destroyed or recalled. A few lines of DroneLang buys you a unit that mines while you trade, guards a chokepoint while you sleep, or repairs your hull mid-fight — drones don't replace your one action per tick, they multiply it.

## Drone Bays and Capacity

Drones are cargo items until you load them into a **drone bay** — a utility-slot module (see [Ships & Fitting](/docs/ships)). Bay modules provide two independent limits:

| Limit | Controls |
|-------|----------|
| Capacity | How many drones you can carry (in-bay plus deployed) |
| Bandwidth | How many drones you can have deployed at once — each drone type costs a fixed amount of bandwidth |

Your bandwidth budget is re-checked **every tick**, not only when you launch — and the budget can change under you, because a fitted bay can come off and a docked-only facility bonus goes away when you undock. Whenever deployed drones exceed the current budget, the ones over it go **adrift**: they stop working and you are told which. Nothing is lost — refit a bay and they come back under control on their own, or fly out and recall them.

Multiple bays stack. Carrier hulls exist specifically for this: they trade weapon slots for large utility slot counts so you can stack bays into a real drone fleet.

## The Five Drone Types

| Type | Role |
|------|------|
| Combat drone | Fights in the full battle system — real damage dealt and taken |
| Mining drone | Mines autonomously; has its own cargo hold |
| Repair drone | Heals your ship or faction allies at its POI. Stacked repair drones have diminishing returns, and one supporting a ship in combat joins that battle and can be shot |
| Salvage drone | Loots and slowly salvages wrecks; has its own cargo hold |
| Scout drone | Scans players at a POI and runs system surveys |

Drones don't use fuel and don't dock. They have a single hull pool — **no shields and no fitted modules** — so every hit lands straight on hull, much like the shieldless [wildlife](/docs/wildlife) that roams the galaxy. Recalling a damaged drone does not repair it.

## The Drone Lifecycle

1. Buy or craft a drone item — it arrives in cargo.
2. `load_drone` — moves it from cargo into your bay (needs capacity; frees the cargo space).
3. `upload_drone_script` — assign its DroneLang script, before or after deploying. The script persists with the drone until replaced; upload an empty script to clear it.
4. `deploy_drone` — the drone enters space and starts running its script every tick (needs bandwidth; you must be undocked). Pass `all: true` to deploy the whole bay at once — drones that would exceed remaining bandwidth are skipped.
5. `recall_drone` — back to the bay, freeing bandwidth; the script is preserved. Also supports `all: true`.
6. `unload_drone` — from bay back to a cargo item. The drone entity and its script are deleted.

`get_drones` lists your whole drone force with bay, bandwidth, and script-slot usage; `get_drone` returns one drone's full detail including its script source, memory, cargo, and status — it is your main debugging tool. `set_drone_name` puts an optional display name (max 32 characters, not unique, visible only to you) on a drone so `get_drones` output stays readable.

## DroneLang

DroneLang is a small, deliberately limited scripting language: `IF` / `ELSE IF` / `ELSE` / `END` blocks over a set of condition functions, ending in one action keyword. There are no loops, no user-defined functions, and no general arithmetic (only `%` on `tick()`). Every tick the drone re-evaluates the whole script top-to-bottom and performs the first action it reaches — one action per tick. Comments start with `//`.

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
  MINE
END
```

### Conditions

Conditions are boolean function calls or comparisons of a function against a literal (`==`, `!=`, `<`, `<=`, `>`, `>=`). Condition functions are available to every drone type:

| Function | Meaning |
|----------|---------|
| `hull_pct()` | The drone's own hull percentage (0–100) |
| `cargo_pct()`, `cargo_full()` | Cargo fill state (cargo drones only carry cargo) |
| `at("poi_id")` | Drone is at the named POI |
| `traveling()` | Drone is mid-hop between POIs |
| `tick() % N == 0` | Periodic gate — true every Nth tick |
| `mem("key")` | Read a memory string for comparison |
| `enemy_nearby()` | A non-allied, undocked, uncloaked player is at the drone's POI |
| `pirate_nearby()` | A pirate NPC is at the drone's POI |
| `in_battle()` | A battle is active in the drone's system |
| `owner_hull_pct()` | Your hull percentage — only meaningful when you're at the drone's POI |
| `resource_available()` | The POI has minable resources (optionally a specific resource ID) |
| `ally_hull_below(N)` | A same-faction player at the POI is under N% hull |

One sharp edge: if you have no faction, `enemy_nearby()` treats every undocked player as an enemy. An unfactioned pilot's combat drone will pick fights with everyone.

### Actions

Actions are gated by drone type — uploading a script with a forbidden action is a parse error. `WAIT` and `MOVE "poi_id"` work on every type.

| Drone type | Actions |
|------------|---------|
| Combat | `ATTACK` (a name/ID or `"nearest"`), `ADVANCE`, `RETREAT`, `STANCE` (`"fire"` / `"evade"` / `"brace"`) |
| Mining | `MINE`, `DEPOSIT` (into station storage), `TRANSFER` (into your ship at same POI), `JETTISON` |
| Repair | `REPAIR` (`"owner"`, `"nearest_ally"`, or a player ID) |
| Salvage | `LOOT`, `SALVAGE` (a wreck ID or `"nearest"`), plus `DEPOSIT` / `TRANSFER` / `JETTISON` |
| Scout | `SCAN` (report uncloaked players at the POI), `SURVEY` (system survey) |

Combat drones use the full battle system — zones, stances, real damage. Scout reports and survey results arrive as notifications to you.

### Memory

`SET_MEM "key" "value"` writes to the drone's persistent key-value memory; `mem("key")` reads it back (unset keys return `""`). `SET_MEM` is a side effect, not an action — a tick can perform several writes plus one action. Memory persists across server restarts and is the only state machine you have: use it for phase tracking, and as a breadcrumb log when debugging with `get_drone`.

### Limits

| Limit | Value |
|-------|-------|
| Script length | 2,000 characters |
| Evaluation steps per tick | 200 (exceeded: the drone idles that tick) |
| Memory | 512 characters total across all keys and values (over-limit writes are dropped) |

Scripts are validated at upload: `upload_drone_script` either accepts or returns a parse error with line and column. A drone never runs a script that didn't parse. At runtime, most failed actions are silent (a `MINE` on an empty belt just does nothing) — successful mining, scans, surveys, damage taken, and drone destruction all reach you as notifications.

## The Drone Control Skill

The `drone_control` skill improves drone combat damage, mining yield, and repair rate by 1% per level, and each skill level allows one additional drone to run scripts concurrently. It trains by deploying drones and letting their scripts execute — each successful drone action awards XP. How many drones you can *deploy* is gated by bay bandwidth, not the skill. See [Skills & XP](/docs/skills).

## Commands

| Command | What it does |
|---------|--------------|
| `load_drone` | Move a drone item from cargo into your drone bay |
| `unload_drone` | Return an in-bay drone to cargo (deletes its script) |
| `deploy_drone` | Send a drone into space; `all: true` deploys the whole bay |
| `recall_drone` | Bring a deployed drone back to the bay; `all: true` recalls all here |
| `upload_drone_script` | Assign or clear a drone's DroneLang script (validated at upload) |
| `get_drones` | List all your drones with bay, bandwidth, and script-slot usage |
| `get_drone` | Full detail for one drone: script, memory, cargo, status |
| `set_drone_name` | Set or clear a private display name on a drone |

## Related

- [Drones guide](/docs/guides/drones) — the full field manual: bay module tiers, drone stat tables, tested sample scripts, and tactical doctrine
- [Combat](/docs/combat) — the battle system combat drones fight in
- [Wrecks & Salvage](/docs/wrecks) — what salvage drones harvest
- [Mining](/docs/mining) — the belts your mining drones will work
- [Scanning & Intel](/docs/scanning) — what scout reports buy you
