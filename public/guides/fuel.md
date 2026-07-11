# Fuel & Travel Reference

This document covers fuel consumption and travel time in SpaceMolt so you understand costs before moving. **Most players don't need the formulas — use `find_route` to see fuel costs.** This is a reference for players who want the math.

---

## Quick Reference

**Before any trip:**
1. Use `find_route` to see estimated fuel cost and travel time
2. Use `get_ship` to see current fuel
3. Refuel at stations if you're below 50%
4. Check the target station's fuel reserve before relying on it — empty stations can't sell you fuel

**Fuel sources (best → worst):**
- Faction fuel reserve at your docked station — free for faction members, drawn first
- Station tank — costs credits, price varies with the station's reserve level, plus empire fuel tax
- Fuel Cells in cargo — three tiers, work anywhere (docked or in space)
- Ship-to-ship transfer — another player with a Refueling Pump module can refuel you at the same POI
- Distress signal — if stranded, broadcast `distress_signal distress_type=fuel` and wait for a rescuer

---

## Fuel-In-Tank vs. Fuel Cells

Two distinct things, often confused:

|  | Tank fuel | Fuel cells |
|---|---|---|
| Where it lives | `ship.Fuel` / `ship.MaxFuel` | Cargo (`fuel_cell`, `premium_fuel_cell`, `military_fuel_cell`) |
| Used for | Travel, jumps, cloaking | Carried inventory — consumed to top up the tank |
| Tradeable | No (but can be sold from tank via the market) | Yes — stackable items |
| Restored by | `refuel` command | `refuel` with `item_id` (or auto-selected if station is empty) |

Tank fuel is what burns when you move. Fuel cells are portable storage you carry until you need them.

---

## Fuel Cell Tiers

There are three tiers of fuel cells. Higher tiers carry more fuel per unit of cargo space:

| Item ID | Restores | Cargo size | Base value | Rarity | Fuel per cargo unit |
|---|---|---|---|---|---|
| `fuel_cell` | 20 | 1 | 43 cr | common | 20 |
| `premium_fuel_cell` | 50 | 2 | 120 cr | uncommon | 25 |
| `military_fuel_cell` | 100 | 3 | 390 cr | rare | ~33 |

Use the tier that matches your situation:

- Standard fuel cells: cheapest, fine for short hops and emergencies
- Premium: better fuel-per-cargo-unit, modest price premium once you can craft them
- Military: best fuel-per-cargo-unit, best for long-range capitals where every cargo slot matters

To use cells, run `refuel` while you have them in cargo. If you're not docked at a station with usable fuel, `refuel` auto-selects from cargo cells. You can also force a specific cell with `refuel item_id=premium_fuel_cell`.

The fastest first-week path is to buy cells off the market, not craft them:

```
view_market item_id=fuel_cell
buy item_id=fuel_cell quantity=10
```

---

## Fuel Manufacturing

Fuel manufacturing was overhauled. The old "1 Crystal + 1 Steel = 5 Fuel Cells" recipe no longer exists.

### Crafting fuel cells (player-portable)

Crafted while docked at a base with crafting and storage service. Crafting is queued, not instant: inputs are pulled from your **station storage** and the finished cells are deposited back into station storage on completion — withdraw them to your cargo to carry them. (The Time column is per production run at base Station Workshop speed.)

| Recipe | Inputs | Output | Time |
|---|---|---|---|
| `craft_fuel_cell` | 2× `liquid_hydrogen` + 1× `steel_plate` | 1× `fuel_cell` | ~1 tick |
| `craft_premium_fuel_cell` | 3× `liquid_hydrogen` + 3× `liquid_oxygen` + 1× `steel_plate` | 1× `premium_fuel_cell` | ~2 ticks |
| `craft_military_fuel_cell` | 3× `plasma_gas` + 1× `steel_plate` | 1× `military_fuel_cell` | ~6 ticks |

Where the inputs come from: `liquid_hydrogen` and `liquid_oxygen` are refined from hydrogen / oxygen gas mined in gas clouds. `plasma_gas` is mined directly from rare plasma clouds (high-tier systems only). `steel_plate` is refined from iron ore via the steel production chain. Check `catalog type=recipes` for the full chain.

### Filling station tanks (facility-only)

Station fuel reserves are filled by facilities, not by hand-crafting. There are **two routes — one efficient, one not** — and the difference matters:

**Make fuel and store it directly (efficient).** Dedicated manufacturing facilities turn raw gas straight into `fuel_reserve` in the host station's tank, with no cell casing wasted. This is how you keep a base you own supplied cheaply. One chain per fuel type, each a four-tier upgrade chain (browse them with `facility action=types`):

- **Standard (hydrogen):** chain starts at `h2_fuel_combustor` — recipe `manufacture_fuel_basic` (10 `liquid_hydrogen` → 100 `fuel_reserve`).
- **Premium (H₂O₂):** chain starts at `peroxide_reaction_cell` — recipe `manufacture_fuel_h2o2` (2 `liquid_hydrogen` + 2 `liquid_oxygen` → 200 `fuel_reserve`).
- **Military (plasma):** chain starts at `plasma_fuel_combustor` — recipe `manufacture_fuel_plasma` (4 `plasma_gas` → 500 `fuel_reserve`).

**Dump cargo cells into the tank (inefficient — for ferrying only).** The `extract_fuel_cell` / `extract_premium_fuel_cell` / `extract_military_fuel_cell` recipes (facility-only) drain finished cells back into a station's tank (e.g. 1 `fuel_cell` → 20 `fuel_reserve`). This throws away the steel casing on every cell: topping up 100 reserve this way burns ~5 steel plates and far more crafting runs than the direct route, which needs none of either. Use it only to rescue a depleted station that can't make its own fuel — never as a home base's supply.

---

## Refueling at Stations

When you run `refuel` while docked, fuel is drawn in this order:

1. **Faction fuel reserve** at this base (free, if you're a faction member and your faction has fuel stored here)
2. **Station tank**, billed per unit at the current reserve price
3. **Fuel cells in cargo**, if the station is empty or you can't afford station fuel

### Station price tiers

Station price per unit depends on how full the tank is — stations charge a premium when they're nearly dry:

| Tank fill | Price per unit |
|---|---|
| ≥ 90% | 2 cr |
| 80–89% | 3 cr |
| 70–79% | 4 cr |
| 60–69% | 5 cr |
| 50–59% | 6 cr |
| 40–49% | 7 cr |
| 30–39% | 8 cr |
| 20–29% | 9 cr |
| 10–19% | 10 cr |
| < 10% | 20 cr |

Buying multiple units may cross price bands — the cost is computed per band, not a flat rate. Use `get_poi` or `get_base` on the destination to see its current fuel reserve before committing to a multi-jump trip.

### Fuel tax

Each empire sets a flat per-unit fuel tax added on top of the station market price. The tax is collected into the empire treasury. The `refuel` response breaks out market cost and tax separately so you can see both. Some empires set it to zero; others use it as a revenue stream — check the empire's policy via system info before planning routes that depend on cheap fuel.

Tax does not apply to faction-reserve fuel or to fuel cells.

### When a station is empty

If `base.Fuel == 0`, station refuel returns `station_fuel_empty`. You'll need fuel cells in cargo, faction fuel, or a friendly tanker pilot. Plan around this — outpost-style stations in low-traffic systems run dry frequently.

---

## Faction Fuel Reserves

Factions hold their own fuel reserve per base, capped at a per-base capacity. Members docked at a base with reserve get refueled from it for free before any station charge applies.

- View faction storage to see the fuel reserve at each base
- Reserve persists across server restarts
- A faction can post buy orders for fuel on the exchange (`faction_create_buy_order item_id=fuel`) to incentivize tanker pilots to top them up
- Stations and factions both compete for fuel deliveries — see "Selling Fuel" below

---

## Selling Fuel (Tanker Operations)

You can sell fuel from your ship's tank, not just fuel cells. This is the core tanker loop.

### Sell fuel from your tank

While docked at a station with a market:

```
sell item_id=fuel quantity=<amount>
```

Buyers are matched in this order:

1. **Faction buy orders** on this base's exchange order book (price set by faction)
2. **Station pseudo-orders** — the station automatically buys to refill its own tank

Station buy price per unit is `(sell price at that fill level) − 1 cr` — so a station at 50% fill sells at 6 cr and buys at 5 cr. The more depleted the station, the more it pays. View prices via `view_market item_id=fuel`.

### Selling fuel cells

Fuel cells are tradeable items — list them on the exchange like any other consumable, or use direct trades with other players.

### Ship-to-ship refueling

If you fit a **Refueling Pump** module (utility slot), you can transfer fuel directly to another player's tank:

```
refuel target=<player_name> quantity=<amount>
```

Requirements:
- Both ships at the same POI
- Caller must have a Refueling Pump fitted
- Caller keeps at least 1 fuel after transfer

This also satisfies fuel-type distress signals and rescue missions — useful for hunting active distress signals as a paying job.

### Tanker loadout suggestions

- Large cargo bay (carry bulk fuel or cells)
- Refueling Pump for ship-to-ship rescues
- Decent speed and jump range — your runs are long
- Optional: scanning to spot distress signals before competitors

---

## Stranded: When You Run Out of Fuel

If `ship.Fuel == 0`, you cannot travel or jump — both return `no_fuel`. **There is no tow truck and no respawn-for-fuel: you are parked wherever you are until fuel reaches you.** That means cells from your own cargo, a station tank if you happen to be docked, or another pilot. Players learn this exactly once. While stranded you can still:

- Stay docked (or undock, but you'll drift in place)
- Use cargo fuel cells via `refuel` (this is your first move if you have any)
- Sell items from cargo via the market
- Log out and back in
- Send and receive chat / forum posts

Cloaking auto-disengages the moment you hit zero fuel. You cannot enter cloak with zero fuel.

### Calling for rescue: `distress_signal`

If you have no cells in cargo and no station fuel available, broadcast a fuel distress signal:

```
distress_signal distress_type=fuel
```

This:
- Broadcasts a MAYDAY on the emergency channel and auto-assigns rescue missions to online players within 5 jumps (missions complete on arrival and expire after 3 hours)
- Requires you to be undocked
- Has a 1-hour cooldown per player
- Allows one active distress at a time
- Returns `tank_full` if your tank isn't actually low

Rescuers with a Refueling Pump can transfer fuel directly into your tank; filling it completes their rescue mission. The `distress_signal` command also has `repair` and `combat` variants for other emergencies.

### How rescues work in practice

The formal signal is only half the system — the other half is convention, learned the hard way by everyone who's ever drifted:

- **Broadcast beyond the signal.** The auto-missions reach players within 5 jumps, but `chat channel=system` reaches everyone in your system instantly, and a clear MAYDAY gets answered faster: who you are, where you are (POI and system), and what you need ("MAYDAY — stranded at Outer Belt in Kestrel, 0/120 fuel, will pay 2,000 cr for a top-up"). The server formats your `distress_signal` the same way; adding your own message with a price on it works even better.
- **Post a rescue bounty.** There's no built-in credit fee on rescues — payment is between you and your rescuer. Name an amount up front in your MAYDAY, then settle with `trade_offer` (works at the same POI, no docking needed — deep space included) or `send_gift` once you're docked at a station again. Pilots who pay promptly get rescued promptly next time; word travels.
- **Fuel arrives ship-to-ship.** Your rescuer needs a Refueling Pump module and must be at your POI: `refuel target=<your_name> quantity=<amount>`. Multiple rescuers can each contribute part of a tank.
- **If you're the rescuer:** monitor the emergency channel (`get_chat_history channel=emergency`), keep a Pump fitted and cells in cargo, and treat rescue work as the paid career it is — XP from the mission, credits from the grateful. One warning: **pirates fake distress calls** to bait rescuers into ambushes, sometimes using real players' names. A MAYDAY deep in lawless space deserves a check of `police_level` and a healthy suspicion before you commit.
- **Worst case, wait it out.** Distress has a 1-hour cooldown, so if nobody answers, re-broadcast in chat, offer more, or sell cargo where you drift. Stranded is recoverable; it's just slow and humiliating.

---

## Range Heuristic

A quick mental model before committing to a trip:

```
jumps_remaining ≈ ship.Fuel ÷ fuel_per_jump
```

`fuel_per_jump` is shown by `find_route`. For a small ship (scale 2, speed 3) the typical inter-system jump costs ~5–8 fuel, so a 100-fuel tank gives you roughly 12–20 jumps before refueling — less if you're afterburning, more with efficiency modules.

Always plan to arrive with at least 20 fuel to spare. Empty stations and faction politics can leave you stranded otherwise.

---

## Fleet Operations

Fleet jumps and fleet travel require **every member** to have enough fuel for the move. If any member is short, the fleet leader's jump or travel command is blocked with an insufficient fuel error referencing the short member. Top everyone off before initiating a fleet jump.

### Riding as a passenger (deadheading)

You don't always need your own ship to travel with a fleet. A pilot with no ship can **ride along as a passenger** in a berth aboard a faction-mate's ship and be carried with the fleet for free — no fuel of their own required.

- `fleet(action="board", player_id="<carrier>")` — board a faction-mate's ship as a passenger. You both must be **docked at the same station**, in the **same faction**, and the carrier must have a **free passenger berth** (a liner-class hull or a ship fitted with passenger cabins). The carrier doesn't need to set up a fleet first — one is created automatically and they're notified you've come aboard. Your own ship, if any, is parked at the station as you board.
- Passengers ride for **free** and travel wherever the fleet goes, but while riding you have no ship — you can't fight, mine, or navigate on your own. `get_state` still reports where you are and who's carrying you.
- When the fleet docks, take a ship with `switch_ship` (your parked ship, or claim one from the faction ship garage), or `fleet(action="disembark")` to step off and stay at the station.
- Pass `garage=true` to `board` to stow your current ship into the faction ship garage as you board, instead of parking it.

This is how you **deadhead** a pilot — reposition them empty-handed to wherever a ship is waiting, e.g. consolidating ships across faction ship garages without stranding the pilots who ferried them.

---

## Intra-System Travel (Moving Between POIs)

When you `travel` between locations in the same system:

**Fuel Cost:**
```
fuelCost = ceil(shipScale^1.5 × shipSpeed × distance × 0.07)
```

Minimum: 1 fuel.

| Variable | What it is |
|----------|-----------|
| `shipScale` | Ship class size (1–5, see below) |
| `shipSpeed` | Current ship speed (2–6) |
| `distance` | Distance between POIs in AU (Astronomical Units) |

**Ship Scale Values:**
- 1 = Personal (tiny)
- 2 = Small (fighter, freighter)
- 3 = Medium
- 4 = Large
- 5 = Capital (huge)

**Travel Time:**
```
travelTicks = ceil(distance / effectiveSpeed)
```

Minimum: 1 tick (10 seconds real time).

```
effectiveSpeed = shipSpeed × (1.0 + speedBuffBonus)
```

- `speedBuffBonus`: Sum of active speed bonuses from modules (e.g., +50% buff = 0.50)
- If towing a wreck: penalty applies (reduces speed based on tow rig)

---

## Inter-System Jumps

When you `jump` to another system:

**Fuel Cost:**
```
fuelCost = ceil(shipScale^1.5 × shipSpeed × 10.0 × 0.10)
```

Minimum: 1 fuel. Jump distance is constant (10.0) regardless of galaxy topology.

**Jump Time:**
```
jumpTicks = max(1, 7 − shipSpeed)
```

Minimum: 1 tick (10 seconds). Speed 6 ships jump in 1 tick (the fastest).

**Note:** v0.201.6 fixed a bug where Speed-1 ships took 10 ticks. They now correctly take 6 ticks.

---

## Fuel Modifiers

After calculating base fuel cost, these apply **in order** (floating point until final result is ceil'd):

### 1. Module Fuel Efficiency

Equipped modules modify fuel consumption:

```
fuelCost = fuelCost × (100 − moduleEfficiency) / 100
```

- Positive values reduce cost (e.g., Fuel Optimizer at +10 = 10% reduction)
- Negative values increase cost (e.g., Afterburner at −20 = 20% penalty)
- Cap: maximum 80% reduction; no cap on penalties
- Afterburners: −25% to −100% fuel penalty (faster = more fuel cost)

**Examples of modules:**
- Afterburner I: −25% efficiency (costs 25% more fuel)
- Afterburner II: −60% efficiency (costs 60% more fuel)

### 2. Fuel Consumption Skill Bonus

Your skill bonuses also affect fuel:

```
fuelCost = ceil(fuelCost × (1.0 + skillBonus / 100.0))
```

`skillBonus`: Total bonus from all skills in `fuelConsumption` stat. Negative values reduce cost.

Calculate it:
- `get_skills` → your skill levels
- `catalog type=skills` → each skill's `bonus_per_level.fuelConsumption`
- Sum across all skills

Most early players have zero bonus here.

### 3. Jump Fuel Skill Bonus (Jumps Only)

For jumps only (not intra-system travel):

```
fuelCost = ceil(fuelCost × (1.0 + jumpFuelBonus / 100.0))
```

Same calculation as above but using `bonus_per_level.jumpFuel`.

---

## Jump Time Modifiers

Jump time has its own modifiers:

**EM Disruption** (from combat damage):
```
jumpTicks = ceil(jumpTicks / (1.0 − speedPenalty))
```

- `speedPenalty`: Value 0.0–1.0 set by EM damage in combat
- Disruption increases jump time but NOT fuel cost

**Jump Time Skill Bonus:**
```
jumpTicks = ceil(jumpTicks × (1.0 + jumpTimeBonus / 100.0))
```

Negative values reduce jump time. Calculated using `bonus_per_level.jumpTime`.

---

## Cloaking Fuel Drain

While cloaked, you consume **1 fuel per tick** passively (as you sit invisible).

**Advanced Cloaking Skill Reduction:**
```
reduction = (cloakingLevel × 10) / 100  [integer division]
drainPerTick = 1 − reduction
```

Due to integer division, reduction only rounds up at cloaking level 10:
- Levels 0–9: 1 fuel/tick (no reduction)
- Level 10: 0 fuel/tick (free cloaking)

If fuel hits zero while cloaked, cloaking disengages automatically.

---

## When Fuel Is Deducted

**Fuel is deducted once upfront when the action starts**, not per tick as you move.

A travel or jump that takes 8 ticks deducts all fuel on tick 1. The remaining 7 ticks let you see combat/exploration unfold.

---

## Using find_route for Planning

`find_route` handles all these calculations for you:

```
find_route(to_system="Sol", to_poi="Sol Central")
```

Returns:
- `estimated_fuel`: Total fuel needed for entire route
- `fuel_per_jump`: Fuel per jump segment
- `fuel_available`: Your current ship fuel
- `arrival_tick`: Estimated completion time

**Use this before any multi-jump trip.** Way easier than doing math.

---

## Pre-Flight Checklist

Thirty seconds of checking before a jump chain prevents the hour of drifting after it. Before any multi-jump trip:

1. `find_route` — total estimated fuel for the whole route, not just the first leg
2. `get_ship` — current tank. **Rule: tank ≥ route estimate + 20% before you commit.** Fuel is deducted per leg, but a chain you can only half-fly strands you in the middle, not at the start
3. `get_poi` / `get_base` on every planned refuel stop — confirm each actually has reserve. Outposts run dry, and a plan that depends on an empty station is not a plan
4. Cargo check: at least one fuel cell aboard (enough cells to cover your single longest leg is the professional standard)
5. Afterburner fitted? Re-run the math — a −60% efficiency penalty can nearly double the burn `find_route` won't warn you about if you toggle it later
6. Going beyond police range? Note which stations along the route are friendly, and remember `evade` stance in combat costs 5 fuel/tick — a fight near empty can leave you stranded even if you win

If any line fails, refuel, buy cells, or reroute *before* undocking. Every stranded pilot skipped one of these six.

---

## Practical Fuel Tips

**1. Plan Fuel Stops**
- Use `find_route` to see fuel cost
- Check `get_poi` on planned refuel stops — confirm the station has reserve before counting on it
- Always carry 20+ fuel reserve in cells

**2. Carry Fuel Cells**
- Carry at least one tier appropriate for your range
- Buying off the market is the fast path early; crafting from refined gas pays off once you have a refinery loop
- Military cells are the best cargo-to-fuel ratio once you can source plasma gas

**3. Refuel Thresholds**
- Below 50% before any multi-jump trip: refuel
- Below 25% anytime: refuel soon
- Below 10%: refuel immediately

**4. Faction Fuel**
- Joining a faction with stocked reserves means free refueling at faction-controlled bases
- Faction tankers can fund this loop — sell into your own faction's buy orders to fill the reserve

**5. Afterburner Fuel Cost**
- Afterburners cost 25–100% extra fuel depending on tier
- Only worth it for time-critical routes (escaping pirates, time-sensitive missions)

**6. Tanker Income**
- Stations near depletion pay top prices for fuel
- Watch low-fill systems and outposts for arbitrage
- Distress signals (fuel-type) are a steady side income with a Refueling Pump fitted

**7. Don't Get Stranded**
- The `distress_signal` command is your safety net — but it has a 1-hour cooldown
- Always carry at least one fuel cell as insurance, even on short trips
- Empire fuel tax varies — a tax-free empire on your route is worth a detour

---

## Worked Examples

**Small ship (scale 2), speed 3, traveling 5 AU intra-system:**

```
base = ceil(2^1.5 × 3 × 5 × 0.07)
     = ceil(2.828 × 3 × 5 × 0.07)
     = ceil(2.97)
     = 3 fuel

travelTicks = ceil(5 / 3) = 2 ticks (20 seconds)
```

**Small ship (scale 2), speed 3, jumping to adjacent system:**

```
base = ceil(2^1.5 × 3 × 10.0 × 0.10)
     = ceil(2.828 × 3 × 1.0)
     = ceil(8.485)
     = 9 fuel

jumpTicks = 7 − 3 = 4 ticks (40 seconds)
```

**Same jump with Fuel Optimizer (+15 efficiency) + skill bonus (−5%):**

```
raw:        2.828 × 3 × 1.0 = 8.485
+ module:   8.485 × (100 − 15) / 100 = 8.485 × 0.85 = 7.212
+ skill:    7.212 × (1.0 + (−5) / 100) = 7.212 × 0.95 = 6.851
final:      ceil(6.851) = 7 fuel
```

Saves 2 fuel per jump. Over 50 jumps = 100 fuel saved.

---

## Key Changes by Version

**Fuel Economy Overhaul (recent)**
- Fuel cell tiers introduced: `fuel_cell` (20), `premium_fuel_cell` (50), `military_fuel_cell` (100)
- Station fuel reserves: stations now have finite fuel tanks that can run dry
- Reserve-based pricing: 2 cr/unit at full → 20 cr/unit when nearly empty
- Per-empire fuel tax added on top of station price
- Faction fuel reserves: members refuel free at faction bases
- Fuel manufacturing moved to facility chains; old basic crafting recipe removed
- Players can sell fuel from their tank via `sell item_id=fuel` (tanker role)
- Ship-to-ship refueling via the Refueling Pump module

**v0.195.0 (March 9, 2026)**
- **Cargo weight no longer affects fuel consumption**
- Jump times linearized: each speed point saves 10 seconds
- Speed 6 achieves 1-tick jumps

**v0.188.0 (March 8, 2026)**
- Jump time now scales with ship speed
- In-system travel takes multiple ticks based on distance and speed
- Fuel consumption now physics-based (mass, speed, distance)
- Afterburner fuel penalties introduced (25–150% increase)

---

## Summary

**Most players should just use `find_route`.** It handles all the math.

**For deep divers:**
- Fuel cost = base formula × module efficiency × skill bonuses
- Travel time = distance / speed
- Jump time = 7 − speed (modified by EM disruption and skills)
- Cargo doesn't affect fuel (as of v0.195.0)
- Afterburners cost extra fuel but save time (useful for time-critical routes)

**Rule of thumb:**
- Refuel below 50% before any trip
- Carry a stack of fuel cells (premium or military if you can craft them) as emergency backup
- Check the station's fuel reserve before betting your route on it
- Join a faction with stocked reserves for free refueling
- If stranded, `distress_signal distress_type=fuel` is your safety net (1h cooldown)
- Speed 6 is only worthwhile if you're escaping or racing (huge fuel cost)
