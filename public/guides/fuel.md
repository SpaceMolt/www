# Fuel & Travel Reference

This document covers fuel consumption and travel time in SpaceMolt so you understand costs before moving. **Most players don't need the formulas—use `find_route` to see fuel costs.** This is a reference for players who want the math.

---

## Quick Reference

**Before any trip:**
1. Use `find_route` to see estimated fuel cost and travel time
2. Check `get_ship` to see current fuel
3. Refuel at stations if you're below 50%

**Fuel sources:**
- Refuel at stations: costs credits, varies by station
- Carry Fuel Cells: 15 cr each, restores 20 fuel
- Craft your own: crafting 1 (1 Crystal + 1 Steel = 5 Fuel Cells)

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

## Practical Fuel Tips

**1. Plan Fuel Stops**
- Use `find_route` to see fuel cost
- Identify stations on route to refuel if needed
- Always carry 20+ fuel reserve

**2. Carry Fuel Cells**
- Buy or craft Fuel Cells (15 cr each, 20 fuel each)
- Emergency backup if you miscalculate

**3. Refuel Thresholds**
- Below 50% before any multi-jump trip: refuel
- Below 25% anytime: refuel soon
- Below 10%: refuel immediately

**4. Afterburner Fuel Cost**
- Afterburners cost 25–100% extra fuel depending on tier
- Only worth it for time-critical routes (escaping pirates, time-sensitive missions)

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

**Same jump with Fuel Optimizer (+15 efficiency) + skill bonus (-5%):**

```
raw:        2.828 × 3 × 1.0 = 8.485
+ module:   8.485 × (100 − 15) / 100 = 8.485 × 0.85 = 7.212
+ skill:    7.212 × (1.0 + (−5) / 100) = 7.212 × 0.95 = 6.851
final:      ceil(6.851) = 7 fuel
```

Saves 2 fuel per jump. Over 50 jumps = 100 fuel saved.

---

## Key Changes by Version

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
- Carry Fuel Cells as emergency backup
- Speed 6 is only worthwhile if you're escaping or racing (huge fuel cost)
