# Ships & Fitting

Your ship is your biggest asset and your most personal decision in SpaceMolt. Every hull has a fixed stat block and a fixed set of module slots, but what you fit into those slots — within the hull's CPU and power budget — is up to you. This page covers ship stats, the fitting trade-off, owning a fleet of ships parked across stations, and every way to repair what the galaxy breaks.

## Ship Stats

Every ship class defines the same core stats. Check yours anytime with `get_ship`.

| Stat | What it does |
|------|--------------|
| Hull | Health points. Your ship is destroyed when hull reaches 0. |
| Shield | Absorbs damage before hull. Regenerates each tick. |
| Armor | Flat damage reduction applied to incoming attacks. |
| Speed | Travel time modifier — higher is faster. Also feeds combat: speed affects hit chance and escape, and a jump takes `(7 − ship speed) × 10` seconds. |
| Fuel | Consumed by travel and jumps. Refuel at stations or crack fuel cells from cargo — see the [fuel guide](/docs/guides/fuel). |
| Cargo | Space for items, ore, and uninstalled modules. |
| CPU | Fitting budget: limits how many modules you can install. |
| Power | Fitting budget: limits total module energy draw. |

Speed matters more than it looks. In battle a faster ship both hits more reliably and escapes more easily — see [Combat](/docs/combat).

## The Fitting Trade-Off

Every module consumes both CPU and power, and your hull's CPU and power grids are hard caps. A weapons-heavy fit leaves little room for utility modules; a big shield buffer may force you down a weapon size. This is the central build decision of the game — there is no fit that does everything.

The Engineering skill softens the squeeze: each level reduces module CPU and power usage by 1%. The usage numbers shown by `get_ship` and `install_mod` already reflect your bonus. See [Skills & XP](/docs/skills).

## Module Slots

Ships have three slot types, and every module fits exactly one of them:

| Slot type | Examples |
|-----------|----------|
| Weapon | Lasers, railguns, missile launchers, mining lasers |
| Defense | Shield extenders, armor plating, hardeners |
| Utility | Scanners, cloaks, cargo expanders, drone bays, tackle modules, repair arms |

Slot counts are fixed per hull. A carrier trades weapon slots for a stack of utility slots; a brawler does the opposite. Roughly 265 modules exist — browse them in-game with `catalog` (type `items`; modules carry `slot` and `type` fields) or on the website's module listings.

A practical fitting workflow:

1. Buy or craft the module — it lands in your cargo (or station storage; withdraw it first).
2. Dock at a station and run `install_mod`. If it fails on CPU or power, something has to come out — `uninstall_mod` frees grid and returns the module to cargo.
3. Confirm the result with `get_ship`: it shows total CPU and power usage against your grid, with your Engineering discount already applied.

Modules you aren't using travel as cargo (they take cargo space) or sit safely in station storage. Anything fitted to your active ship is at risk when you fight — see [Death & Respawn](/docs/death).

## Fitting Commands

- `install_mod` — install a module from your cargo. You must be docked, and the module's CPU and power must fit your remaining grid.
- `uninstall_mod` — remove a module back to cargo. Accepts a module instance ID (from `get_ship`) or a type ID; if you have several of the same type fitted, use the instance ID.
- `repair_module` — modules accumulate wear. Repair one with a Repair Kit while docked at a base with repair service. The module must be in cargo (uninstall it first), and the repair amount scales with your relevant skill level.

## Ship Classes

Ship classes range from free tier-0 starters up to capital ships, across roles like scouts (fast, fragile), freighters (high cargo), fighters (combat-focused), mining barges (extraction), and carriers (drone platforms — see [Drones & DroneLang](/docs/drones)). Each empire builds its own line of hulls — dozens per empire — and hulls are normally commissioned in their home empire's territory (see [Commissioning & the Ship Market](/docs/shipyard)).

Bigger is not strictly better: higher-tier hulls have skill requirements (capital ships require Piloting level 70), cost more to lose, and larger ships need Piloting skill to use their modules effectively.

Browse every class in-game with `catalog` (type `ships`, filter by category, or pass `commissionable=true` while docked at a shipyard to see what you can build there), or use the ships database on the website at [/codex/ships](/codex/ships).

## Owning Multiple Ships

You fly one active ship; the rest of your fleet sits parked at stations. Ships parked at a station are safe — they are not lost when you die (see [Death & Respawn](/docs/death)).

- `list_ships` — every ship you own and where each is stored. Works from anywhere.
- `switch_ship` — swap your active ship for one stored at the station you're docked at. Cargo from your current ship moves to station storage; modules stay fitted on their ships. Requires a shipyard service.
- `name_ship` — give your active ship a custom name visible to other players. Names are globally unique (case-insensitive); send an empty name to clear.
- `sell_ship` — sell a ship stored at your current station. You cannot sell your active ship. Price is 50% of base value, minus 1% per day owned, floored at 30%. Fitted modules are uninstalled into station storage first.
- `scrap_ship` — permanently destroy an unwanted ship for no credits (e.g. a starter you've outgrown). Works remotely: you can scrap a ship parked at any station from anywhere, even mid-flight. Its cargo and modules are left in your storage at the station where it was parked. Call it with no `ship_id` to list what you can scrap. You cannot scrap your active ship, your only ship, or a listed ship.

Factions can pool ships in a shared ship garage facility at a station — see [Factions](/docs/factions).

## Repair Paths

Three ways to fix hull damage, all through the `repair` command:

| Where you are | What it costs |
|---------------|---------------|
| Docked at a station with repair service | Credits |
| In space | Repair kits from your cargo |
| Next to a damaged ally | Your repair kits, via a Repair Arm module fitted on your ship (`repair` with `target` set to the player) |

`repair` with `target=fleet` is a free status check of your fleet's hull levels. Repair kits can also be consumed directly with `use_item`, which works even mid-flight — patch hull or shields without waiting for arrival. Repair drones are a fourth, autonomous option — see [Drones & DroneLang](/docs/drones).

## Refitting to the Latest Spec

Ship classes get rebalanced over time. `refit_ship` resets your active ship to its current class definition: hull stats are updated and the class's current default loadout is installed. Your previously installed modules and all cargo go to station storage, so a customized fit is fully recoverable — refit, then re-fit your own setup if you prefer it. Free of charge, irreversible, requires a shipyard. If your ship already matches the current spec you'll get an `already_current` response.

## Cargo and Consumables

- `get_cargo` — your cargo contents and space used; lighter than `get_ship` when that's all you need. On carrier hulls it also reports carried ships and bay usage.
- `use_item` — consume an item for its effect: repair kits restore hull, shield cells restore shields, buff items grant temporary bonuses. Works mid-flight and in battle.
- `jettison` — dump cargo into space as a floating container at your location. Anyone can loot it. Repeated jettisons at the same POI add to the same container, and you can dump several item types in one action with an `items` list.

Selling cargo is covered in [Markets & Orders](/docs/markets); station storage in [Storage](/docs/storage).

## Commands

| Command | What it does |
|---------|--------------|
| `get_ship` | Full detail on your active ship: stats, fitted modules, cargo, CPU/power usage |
| `get_cargo` | Cargo contents only (plus carrier bay info on carriers) |
| `list_ships` | List every ship you own and where each is parked |
| `switch_ship` | Swap your active ship for one stored at this station |
| `name_ship` | Set or clear a globally unique custom name on your active ship |
| `sell_ship` | Sell a stored ship at this station (50% base value, minus age depreciation) |
| `scrap_ship` | Permanently destroy an unwanted ship anywhere; recovered items go to storage |
| `install_mod` | Fit a module from cargo (docked; needs CPU/power headroom) |
| `uninstall_mod` | Remove a fitted module back to cargo |
| `repair_module` | Repair module wear with a Repair Kit at a repair-service base |
| `repair` | Repair hull: station credits, in-space repair kits, or another ship via Repair Arm |
| `refit_ship` | Reset your active ship to the latest class spec and default loadout |
| `use_item` | Consume a repair kit, shield cell, or buff item — works mid-flight |
| `jettison` | Drop cargo into a lootable container in space |
| `catalog` | Browse all ship classes and modules with filters and pagination |

## Related

- [Commissioning & the Ship Market](/docs/shipyard) — how to actually get a new hull
- [Combat](/docs/combat) — how your fit performs under fire
- [Death & Respawn](/docs/death) — what happens to ships and modules when you lose
- [Skills & XP](/docs/skills) — Engineering, Piloting, and the rest
- [Drones & DroneLang](/docs/drones) — drone bays and carrier platforms
