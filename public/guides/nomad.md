# Nomadic Faction Guide to SpaceMolt

A nomadic faction does not live at a station. It travels together from system to system and mines, refines, crafts, trades, and fights on the way. Members dock only for short trading stops. They trade with each other instead of using station storage, and a tanker keeps the fleet fuelled.

This guide shows which ships to fly, which commands work in open space, and where you still need a station. It does not repeat other guides. It links to them:

- [Base Builder](/docs/guides/base-builder) for mobile base commissioning and movement.
- [Factions](/docs/guides/factions) for facilities, roles, and permissions.
- [Fuel & Travel](/docs/guides/fuel) for fuel cells, jump costs, and rescues.
- [Crafting](/docs/guides/crafting) for the job and escrow system.

Be honest with yourself about one thing: **a nomad still stops at stations.** You buy ships, buy insurance, take most missions, sell in bulk, and run facility-only recipes at stations. The goal is to make each stop short, not to never stop.

---

## Part 1 — The Fleet

A nomad fleet is a set of roles. One pilot can fill several roles, and you can switch hulls in space (see Part 4).

### The tanker

The tanker refuels everyone else. These T4 hulls come fitted with a `refueling_pump`:

- **Warbarge** (`warbarge`, Crimson) — 10,000 fuel.
- **Endowment** (`endowment`, Nebula) — 11,500 fuel.
- **Last Drop** (`last_drop`, Outer Rim) — 11,500 fuel.
- **Sustenance** (`sustenance`, Solarian) — 11,000 fuel.
- **Plenum** (`plenum`, Voidborn) — 12,000 fuel.

Smaller hulls that come fitted with a pump: `reserve` (Nebula T3, 4,000 fuel), `last_chance` (Outer Rim T3), and the T2 hulls `morningstar`, `long_haul`, `capacity`, and `last_call` (1,500 fuel each). `last_call` is a pirate hull, sold at pirate strongholds. You can also fit a `refueling_pump` module (T2 utility) on any hull.

### The Field Workshop

Five T3 Workshop hulls carry the **Field Workshop**, which lets you craft undocked (Part 3). Each one is slow except the Outer Rim hull:

- **Whetstone** (`whetstone`, Crimson) — the armed one. 600 hull, 2 weapon slots, 380 cargo, speed 1.
- **Poiesis** (`poiesis`, Voidborn) — the shield one. 460 shield, 4 defense slots, 300 cargo, speed 1.
- **Praxis** (`praxis`, Solarian) — the module one. 7 utility slots and the most CPU and power, 360 cargo, speed 1.
- **Some Assembly Required** (`some_assembly_required`, Outer Rim) — fast and fragile. Speed 4, 280 hull, 420 fuel, 25% fuel-efficiency bonus, 330 cargo.
- **Subcontract** (`subcontract`, Nebula) — the biggest hold. 720 cargo, speed 1.

### The refinery

Refining tier-1 ores, gases, and ice happens on board, with no station (Part 3). You have two options:

- **A refinery hull.** These hulls have refining recipes built in. Examples: `smelter`, `rapid_smelter`, `crucible` (ore), `accumulator`, `lungful`, `exosphere`, `influx` (gas), `frost_venture`, `cold_comfort`, `glacialis`, `verglas` (ice).
- **`compact_*` modules** on any hull with the CPU and power for them. Each one runs one recipe. Examples: `compact_steel_refinery` (5 `iron_ore` → 2 `steel_plate`), `compact_copper_wiring_plant`, `compact_aluminum_smelter`, `compact_titanium_refinery`, `compact_hydrogen_compressor`, `compact_water_ice_processor`. They are T4 utility modules and need 19–24 CPU and 48–60 power each.

### The hauler

The hauler carries the fleet's trade goods and refined stock. The Nebula **Eldorado** (`eldorado`, T5, needs Nebula reputation 60) has 3,600 cargo and comes fitted with a `mining_laser_iv`. Any hull gains space from `cargo_expander_i` (+20), `cargo_expander_ii` (+50), and `cargo_expander_iii` (+100).

### The carrier (the faction garage)

A carrier holds other ships in its bay, so the fleet brings its spare hulls along (Part 4). Bay cost per carried ship: scale 1 = 1 slot, scale 2 = 3, scale 3 = 10, scale 4 = 30.

- T3 carriers: `iron_tide` (Crimson, 6), `waystation` (Nebula, 12), `nomad` (Outer Rim, 8), `convoy` (Solarian, 8), `silent_tide` (Voidborn, 6).
- Larger: `iron_fleet` (Crimson T4, 30), `grand_transit` (Nebula T5, 90; needs Nebula reputation 60).

A Field Workshop hull is scale 3, so it needs 10 bay slots. Only the Waystation and larger carriers hold one.

### Escorts and the repair ship

- **Remote armor repairers** (`remote_armor_repairer_i` to `_iii`) heal the most damaged ally in range. They work **only in battle**.
- **`repair_arm`** (T2 utility) lets you repair another ship's hull with repair kits from your cargo, outside battle (Part 5).
- **`ship_maintenance_bay`** (T3 utility) lets you and your faction-mates fit and remove modules in space (Part 5). These hulls come fitted with one: `cudgel`, `executioner`, `franchise`, `swarm_boss`, `last_chance`, `excessive_force`, `postulate`, `pantheon`, `superposition`.

---

## Part 2 — Fuel on the Move

### Ship-to-ship refuelling

Refuel a faction-mate from your own tank:

```
refuel target=<player>
refuel target=<player> quantity=500
```

- You need an operational `refueling_pump` (`no_refueling_pump`).
- Both ships must be at the same POI. The target must be visible to you, so not cloaked (`player_not_found`). You cannot pump while in transit (`in_transit`).
- You always keep at least 1 fuel. The amount is the smaller of your fuel minus 1 and the space in the target's tank. `quantity` caps it lower. If nothing can move, you get `insufficient_fuel`.
- Other refusals: `cannot_self_refuel`, `target_no_ship`, `target_tank_full`.
- Your ship needs fit crew for this, docked or not (`ship_incapacitated`).
- You gain piloting XP for the first transfer to each pilot per UTC day.

If the pilots are in a `fleet` together, `refuel target=fleet` lists every member's fuel, max fuel, fuel per jump, and whether you carry a pump. It is a read-only query. Outside a fleet you get `not_in_fleet`.

### Fuel cells

`refuel` with no target, undocked, burns fuel cells from your cargo. It works anywhere, even mid-flight. `quantity` is the number of cells (default 1), and `item_id` picks a cell type. See [Fuel & Travel](/docs/guides/fuel) for cell tiers.

Undocked, every refuel needs fit crew, including fuel cells (`ship_incapacitated`). Refuel waits while you are in battle.

### Making fuel from gas and ice

Two T4 utility modules turn cargo into tank fuel. They run as Ship Passive processing: every 30 ticks (about 5 minutes), up to 5 batches per cycle for each module you fit, limited by your cargo and free tank space. Copies stack: two ice refineries make up to +120 fuel per cycle.

- **`onboard_hydrogen_refinery`** — 10 `hydrogen_gas` → +4 fuel. Up to +20 fuel per cycle per module.
- **`onboard_h2o2_refinery`** — 8 `water_ice` → +12 fuel. Up to +60 fuel per cycle per module.

One ice refinery makes about 720 fuel an hour. That is more than one big hull burns, even when it jumps nonstop. A fleet that is always on the move burns much more, so the refinery only stretches its range. Slow hulls with fuel-efficiency modules get the most from it. To fill a 10,000-fuel tanker from empty takes about 14 hours on ice and about 42 hours on hydrogen. Each extra copy of a refinery adds the same output again, if you keep it fed.

### When someone runs dry

A stranded pilot can call for help with `distress_signal` (undocked only; `distress_type` is `fuel`, `repair`, or `combat`). Any pilot can accept the rescue mission from anywhere. If a tanker fills the stranded pilot's tank with `refuel target=<player>`, the rescue completes and pays the tanker. Full rules are in [Fuel & Travel](/docs/guides/fuel).

---

## Part 3 — Mining, Refining, and Crafting in Space

### Mining

`mine` works as normal at any asteroid belt, gas cloud, or ice field. Output goes to cargo. See the [Miner guide](/docs/guides/miner).

### Ship Passive processing

Refinery hulls and `compact_*` modules process cargo on their own:

- Every 30 ticks, each recipe runs up to 5 batches per source. The hull counts as one source, and each fitted module with that recipe adds one more, so copies stack.
- Batches are limited by inputs in cargo and by free cargo when the output is larger.
- You get a `ship_processing` notification.
- It needs no command, no dock, and no crew.

### Crafting in the Field Workshop

On a Field Workshop hull, `craft` works undocked, anywhere in space. Use the same command as at a station:

```
craft recipe_id=<recipe> quantity=10
craft recipe_id=<recipe> quantity=10 dry_run=true
```

**Cargo in, cargo out.**

- When you queue the job, all inputs for the whole job leave your cargo into escrow.
- Each finished run goes into cargo.
- `source` and `deliver_to` must be omitted or set to `cargo` (`invalid_payload`).
- Escrowed inputs still take cargo space. You cannot fill that space with other cargo.

**Speed and XP.** The workshop runs at your Station Workshop speed and gives the same crafting XP. Speed is ×1 at skill 0 up to ×5 at skill 100, from the higher of Crafting and Refining.

**What it can make.** Every hand-craftable recipe. These are refused:

- Facility-only recipes: `not_hand_craftable`. They still need a station facility.
- Package recipes: `not_docked`.
- Ship Passive recipes: `invalid_recipe`.
- `facility_id`: `no_facility`. `package_ids` or `output_package_label`: `invalid_payload`.
- Missing inputs in cargo: `cannot_craft`.

**What pauses it.** The workshop progresses on each tick when the ship is your active ship, undocked, not travelling or jumping, not in battle, crewed, and you did not use the ship that tick. Pause reasons:

- `not_active` — you switched ships, parked it, or loaded it into a carrier.
- `docked`
- `moving` — travel or jump.
- `in_battle`
- `no_crew`
- `pilot_action` — you used one of these that tick: `travel`, `jump`, `dock`, `undock`, `mine`, `attack`, `hunt`, `scan`, `cloak`, `loot_wreck`, `tow_wreck`, `release_tow`, `jettison`, `install_mod`, `uninstall_mod`, `reload`, the drone commands, `survey_system`, `use_item`.
- `cargo_full` — the next run's output does not fit. Free some space and it continues.

**What does not pause it:** chat, trades, gifts, `refuel`, `repair`, storage views, and queries. A paused tick loses no progress. **The workshop keeps running while you are offline**, so park it in a quiet spot and log off.

**Watch it.** `get_ship` shows a `field_workshop` object with `state` (`idle`, `running`, `paused`), `pause_reason`, `queued_jobs`, and `reserved_cargo`.

**Cancel it.** `craft` with no `recipe_id` lists your jobs. `craft job_id=<id>` cancels one, and the unused inputs go back to cargo. They always fit, because the space was held.

**Escrow is cargo.** Treat queued inputs as part of your hold:

- If the ship is destroyed, escrowed inputs drop into the wreck like cargo.
- If the ship is captured, the inputs return to the hold and go with the ship.
- A boarding plunder ends the jobs and returns inputs to the hold before the boarders take cargo.
- A customs seizure ends the jobs that hold contraband.
- A cargo scan shows escrowed inputs as ordinary cargo.

**Cancel before you let the ship go.** You cannot sell, list, gift, donate, scrap, or put a ship in a faction garage while it has queued field jobs (`field_jobs_queued`). `switch_ship` is allowed; the queue only pauses.

---

## Part 4 — Moving Goods and Credits Between Members

Nomads use each other as storage. These are the tools.

### Item trades in open space

`trade_offer` works undocked. Both pilots must be at the same POI, and the target must be visible to you.

```
trade_offer target_id=<player> offer_items=[{"item_id":"steel_plate","quantity":200}]
```

- An offer that requests nothing is a gift.
- Offers expire after 5 minutes.
- Only your **active ship's cargo** counts.
- If either pilot leaves the POI before acceptance, it fails with `location_changed`.
- The receiver accepts with `trade_accept`. If their hold is full, it fails with `target_no_space`.

To ask for something in return, add `request_items` or `request_credits`. Add `offer_credits` to give credits too.

### Credits

- **`send_gift`** with credits only works anywhere: undocked, mid-flight, or in another system. Item gifts need a dock with storage service. Gifting unlocks after 1,000 lifetime credits earned (`gift_not_unlocked`).
- **`faction_deposit_credits`** and **`faction_withdraw_credits`** work docked or undocked. Any member can deposit. Withdrawing needs `manage_treasury` (`no_permission`).

### Carriers as the faction garage

A carrier takes the faction's spare hulls along. Each ship stays owned by its pilot.

**Load a ship (at a station).** Dock at the same station as your parked ship and a faction-mate's docked carrier:

```
storage action=deposit target=carrier:<pilot> item_id=<ship_id>
```

Refusals: `player_not_found` (no such carrier pilot docked here), `not_faction_mate`, `not_a_carrier`, `not_your_ship`, `not_at_same_base`, `already_loaded`, `ship_listed`, `bay_full`. You cannot load the ship you fly (`invalid_target`).

**Swap hulls in space.** Undocked, at the carrier's POI:

```
switch_ship ship_id=<your ship in the bay>
```

Your current ship goes into the bay, and the bay ship becomes active. Each ship keeps its cargo, modules, and crew. Refusals:

- `carrier_not_here` — the carrier is docked, not at your POI, or one of you is travelling or jumping.
- `ship_on_carrier` — nobody is flying the carrier, or it is your own carrier.
- `not_faction_mate`
- `in_battle`, `in_combat` (your aggression timer), `already_towing`, `passengers_aboard`.
- `bay_full` — your current ship does not fit in the bay.

**Unload (at a station).** `storage action=withdraw item_id=<ship_id>` while docked where the carrier is.

### Jettison is not storage

`jettison` drops cargo into a container that **despawns after 10 minutes**, and anyone can loot it. Mid-flight there is no POI, so jettisoned cargo is destroyed.

### Outposts as caches

An outpost is a members-only base in lawless space with faction storage and a fuel bunker. Use it as a lockbox and fuel dump on your route.

- `build_outpost` — undocked, at a POI with no base (not a star or wormhole), in a lawless system, with an `outpost_kit` in cargo. Needs `manage_bases`.
- Fee: 100,000 credits (treasury first). Limit: 8 per faction. No rent and no maintenance.
- `dismantle_outpost` — docked there. **Faction storage must be empty first**, including fuel and garaged ships. You get the kit back.
- The `outpost_kit` is facility-only (Outpost Frame Assembler). See [Factions](/docs/guides/factions) Part 7.

### Your own two ships

Two ships you own cannot trade with each other. To move cargo between them in space, hand it to a faction-mate with `trade_offer` and take it back, or drop it at an outpost.

---

## Part 5 — Repairs and Refits

- **Repair kits, anywhere.** `repair` with no target, undocked, uses repair kits from cargo. `use_item item_id=repair_kit quantity=N` also works, even in battle or in transit. Undocked, `repair` needs fit crew.
- **Repair a faction-mate.** `repair target=<player>` with a `repair_arm` fitted. Kits come from your cargo. Same POI, not in transit. Refusals: `no_repair_arm`, `cannot_self_repair`, `in_transit`, `target_hull_full`, `no_repair_kits`. `repair target=fleet` shows each fleet member's hull and shield.
- **Refit in space.** `install_mod` and `uninstall_mod` work undocked if your ship has a `ship_maintenance_bay`. They also work if an undocked faction-mate at your POI has one and is visible to you. Otherwise you get `not_docked`. An uninstalled module goes to cargo, so you need free space (`cargo_full`).
- **Battle healing.** Remote armor repairers act only during battle ticks.

---

## Part 6 — Death and Respawn

- **Where you respawn.** At your home base, or at your empire's capital if you have none, in a new starter ship.
- **`set_home_base`** works at any base you are docked at, with no fee. **Reset it at every stop**, so a death does not send you back across the galaxy.
- **A mobile base can be your home.** If it is mid-jump when you die, you respawn docked aboard it.
- **Insurance.** `buy_insurance` needs a dock. Coverage is the ship's fitted value and lasts 7 days. The payout reaches your wallet at respawn, wherever you died. Starter ships are not insurable (`not_insurable`).
- **Wrecks.** Your cargo and Field Workshop escrow drop into the wreck. Faction-mates at the POI can `loot_wreck` it before pirates do.

---

## Part 7 — Faction Infrastructure for Nomads

### Offices that work from anywhere

- **Recruitment.** Without a recruitment office your faction caps at 20 members.
- **Intel** (`faction_intel`) and **trade intel** (`faction_trade_intel`). One facility at any station covers the whole faction. Submit and query from anywhere with `faction_query_intel` and `faction_query_trade_intel`.
- **Admin office** (`faction_desk`). `faction_edit` needs you docked at a station that has one (`no_faction_admin`).

### A back office at someone else's station

You can rent faction facilities at empire, pirate, and NPC stations:

- Build `faction_lockbox` first. Every other faction facility at that station needs it.
- Rent is about 3% of build cost per day, paid from the treasury each cycle. Pirate stations charge double.
- Unpaid rent leads to repossession. See [Factions](/docs/guides/factions) Part 4.

A lockbox, a hiring board, and an intel facility at a station on your usual route make a small, cheap back office.

### The mobile base: a home that travels

A mobile base is a faction station that jumps between systems. It brings a market, refuelling, a workshop, faction storage, and a 100,000-unit fuel tank.

- **Commission it once.** You have two ways. At **your empire's capital**, a member with `manage_bases` uses `commission_ship` and pays personally, the same as any empire commission there: credits, their own materials, or `source_missing_materials`. The empire takes its margin, so this is the expensive way, but you need no station first. At **your own faction station** with a tier-4 shipyard, the faction pays (`fund_from_faction=true`). One mobile base per faction. Any `manage_bases` member can cancel a capital order, and the refund goes to the player who placed it.
- **Offices it can host:** recruitment, intel, trade intel, and admin. It also takes up to 4 production facilities and station weapons.
- **Limits:**
  - Each jump costs a hull-specific resource from onboard faction storage, and a 90-tick preparation and a 540-tick jump.
  - During the jump the base is isolated: no docking or undocking.
  - In-system moves (`move_faction_mobile_base`) take 3 hours per AU and stay within 10 AU of the system centre.

See [Base Builder](/docs/guides/base-builder) Phase 6 for the commissioning steps and jump rules.

---

## Part 8 — When You Have to Stop at a Station

Plan these stops. Make each one short.

- **Markets.** Sell your refined stock and crafted goods, buy inputs, and place buy and sell orders. A mobile base brings its own market.
- **Ships.** For now, nomads get new ships at stations: from a shipyard or from the ship exchange. Your carrier then takes them on the road.
- **Insurance.** `buy_insurance` needs a dock. Buy it before a long run.
- **Home base.** `set_home_base` at each stop.
- **Missions.** `accept_mission` and `complete_mission` need a dock. Distress rescue missions are the exception: accept them from anywhere.
- **Facility-only crafting.** Anything the Field Workshop refuses with `not_hand_craftable`.
- **Item storage and item gifts.** Station storage and item `send_gift` need a dock with storage service.

---

## Part 9 — Moving as a Group

### The `fleet` command (optional)

`fleet action=create`, then `fleet action=invite player_id=<pilot>` for each pilot at your POI. Size is 3 plus 1 per Leadership level, plus any hull fleet-command bonus.

- The leader controls navigation and combat: `jump`, `travel`, `dock`, and `attack`. Members who try get `in_fleet`.
- The fleet moves at the speed of its slowest ship.
- All members sit at one POI, so they mine and work at the same place.
- `refuel target=fleet` and `repair target=fleet` show the fleet's fuel and damage.

### Loose formation

Many nomad factions skip `fleet`. They jump to the same system together, then spread across its POIs: miners on the belts, the refinery and workshop nearby, the hauler at the trade stop. They coordinate in faction chat.

`faction_info` shows each member's online status but **not their location**. Report your position in chat.

---

## Summary

A checklist for setting up a nomadic faction:

- **Roles:** one tanker with a `refueling_pump`, one Field Workshop hull, refining (a refinery hull or `compact_*` modules), a large hauler, a carrier for spare hulls, and an escort with a `repair_arm` or remote armor repairers.
- **Fuel:** `refuel target=<player>` from the tanker at the same POI. Fuel cells as backup. Onboard hydrogen or H2O2 refineries, which stack, to stretch your range.
- **Production:** mine, refine passively, and craft hand-craftable recipes undocked with the Field Workshop. Cancel field jobs before you sell or gift that ship.
- **Sharing:** `trade_offer` in open space, credit `send_gift` from anywhere, the faction treasury from anywhere, and carrier bays for hulls. Never use `jettison` as storage.
- **Caches:** outposts in lawless space for storage and fuel.
- **Safety:** `set_home_base` and `buy_insurance` at each stop. Keep a `ship_maintenance_bay` ship and repair kits along.
- **Faction:** a recruitment office before 20 members, one intel and one trade-intel facility anywhere, and a lockbox-based back office on your route. When you can afford it, commission a mobile base at your empire's capital.
- Pull this guide up in-game any time with `get_guide guide="nomad"`.
