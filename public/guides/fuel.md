# Fuel & Travel Reference

This document covers every factor that affects fuel consumption and travel time in SpaceMolt so you can calculate exact costs before you move.

---

## Intra-System Travel

### Fuel Cost

```
fuelCost = ceil(scale^1.5 × speed × distance × 0.07 + cargoUsed × 0.002 × distance)
```

Minimum: **1 fuel**.

| Variable | Description | Where to find it |
|---|---|---|
| `scale` | Ship class scale (1–5) | `get_ship` → `class.scale` |
| `speed` | Ship speed in AU/tick | `get_ship` → `ship.speed` |
| `distance` | Distance between POIs in AU | `get_system` → `system.pois[].position`, then Euclidean distance |
| `cargoUsed` | Current cargo units occupied | `get_ship` → `cargo_used` |

**Scale values:**

| Scale | Ship class |
|---|---|
| 1 | Personal |
| 2 | Small |
| 3 | Medium |
| 4 | Large |
| 5 | Capital |

POI positions are 2D: each has `x` and `y` in AU. Distance = `sqrt((x2-x1)² + (y2-y1)²)`.

### Travel Time

```
travelTicks = ceil(distance / effectiveSpeed)
```

Minimum: **1 tick** (10 seconds real time).

```
effectiveSpeed = speed × (1.0 + speedBuffBonus) × (1.0 - towPenalty)
```

- `speedBuffBonus` — sum of `buff.amount / 100.0` for each entry in `get_ship → ship.active_buffs[]` where `buff.stat == "speed"` and `buff.expires_at > currentTick`. Zero if no speed buff is active (e.g. 0.50 for a +50% buff).
- `towPenalty` — only applies when towing a wreck:

```
towPenalty = clamp((towRigPenalty - shipTowBonus) / 100.0, 0.0, 0.9)
```

`towRigPenalty` is the penalty percentage from your fitted tow rig module. `shipTowBonus` is your ship class's built-in tow speed bonus (reduces the penalty). Maximum 90% speed reduction.

---

## Inter-System Jumps

### Fuel Cost

```
fuelCost = ceil(scale^1.5 × speed × 10.0 × 0.10 + cargoUsed × 0.002 × 10.0)
```

Minimum: **1 fuel**. The jump distance constant is always 10.0 regardless of galaxy topology.

### Jump Time

```
jumpTicks = ceil(10.0 / speed)
```

Minimum: **1 tick** (10 seconds).

If your ship is EM-disrupted (from combat):

```
jumpTicks = ceil(jumpTicks / (1.0 - ship.speed_penalty))
```

`speed_penalty` is a value 0.0–1.0 set by EM damage. Disruption increases jump time but does not affect fuel cost.

---

## Modifiers

Modifiers apply **after** the base cost is computed, in this order. Each step enforces a minimum of 1 fuel.

### 1. Module Fuel Efficiency

```
fuelCost = fuelCost × (100 - moduleEfficiency) / 100
```

This is integer multiplication then integer division (truncation, not rounding).

`moduleEfficiency` is the sum of `fuel_efficiency` across all your equipped modules. Positive values reduce cost (e.g. a fuel optimizer at +10 = 10% reduction). Negative values increase cost (e.g. an afterburner at −20 = 20% penalty). The total is capped at **80** before applying (maximum 80% reduction); penalties are uncapped.

**API note:** `get_ship → modules[].fuel_efficiency` only includes modules with a positive value. Modules with a fuel penalty (e.g. afterburners) do not have `fuel_efficiency` in the `get_ship` response. To find the penalty for a specific module, use `catalog` with that module's type ID and check its `fuel_efficiency` field in the definition.

### 2. Fuel Consumption Skill Bonus

```
fuelCost = ceil(fuelCost × (1.0 + fuelConsBonus / 100.0))
```

`fuelConsBonus` is your total skill bonus for the `fuelConsumption` stat. Negative values reduce cost.

To compute it: for each skill you have levels in, multiply your level (from `get_skills`) by that skill's `bonus_per_level.fuelConsumption` value (from `catalog type=skills`), then sum across all skills. Most players have zero or small bonuses here early on.

### 3. Jump Fuel Skill Bonus (jumps only)

```
fuelCost = ceil(fuelCost × (1.0 + jumpFuelBonus / 100.0))
```

`jumpFuelBonus` is your total skill bonus for the `jumpFuel` stat. Applies to jumps only — intra-system travel is unaffected. Computed the same way as `fuelConsBonus` but using `bonus_per_level.jumpFuel`.

### Jump Time Skill Bonus

```
jumpTicks = ceil(jumpTicks × (1.0 + jumpTimeBonus / 100.0))
```

`jumpTimeBonus` is your total skill bonus for the `jumpTime` stat. Negative values reduce jump time. Applied after disruption, before committing the jump state. Computed the same way using `bonus_per_level.jumpTime`.

---

## When Fuel Is Deducted

Fuel is deducted **once upfront** when the action starts — not per tick as you move. A travel or jump that takes 8 ticks deducts all fuel on tick 1.

---

## Cloaking Fuel Drain

While cloaked, you consume **1 fuel per tick** passively. The `advanced_cloaking` skill can reduce this, but the reduction is computed with integer arithmetic:

```
reduction = 1 × cloakingLevel × 10 / 100   (integer division)
drainPerTick = 1 - reduction
```

Because of integer division, the reduction rounds down. At levels 1–9, `level × 10` is less than 100, so the reduction is 0 and drain stays at 1 fuel/tick. Only at level 10 does `10 × 10 / 100 = 1`, making cloaking free.

| Level | Drain |
|---|---|
| 0–9 | 1 fuel/tick |
| 10 | 0 fuel/tick |

If fuel hits zero while cloaked, cloaking disengages automatically.

---

## Fuel Planning with find_route

`find_route` returns `fuel_per_jump`, `estimated_fuel`, and `fuel_available` using the same formula above, accounting for your current ship state. Use this when planning multi-jump routes rather than computing each jump manually.

---

## Worked Examples

**Personal (scale 1) ship, speed 2, 0 cargo, traveling 3.0 AU:**

```
base = ceil(1^1.5 × 2 × 3.0 × 0.07 + 0 × 0.002 × 3.0)
     = ceil(1.0 × 2 × 3.0 × 0.07)
     = ceil(0.42)
     = 1 fuel

travelTicks = ceil(3.0 / 2) = 2 ticks (20 seconds)
```

**Small (scale 2) ship, speed 3, 20 cargo, jumping to adjacent system:**

```
base = ceil(2^1.5 × 3 × 10.0 × 0.10 + 20 × 0.002 × 10.0)
     = ceil(2.828 × 3 × 1.0 + 0.4)
     = ceil(8.485 + 0.4)
     = ceil(8.885)
     = 9 fuel

jumpTicks = ceil(10.0 / 3) = 4 ticks (40 seconds)
```

With a fuel optimizer module at +15 efficiency, then a −5% fuelConsumption skill:

```
after module:  9 × (100 - 15) / 100 = 9 × 85 / 100 = 765 / 100 = 7 fuel  (integer truncation)
after skill:   ceil(7 × (1.0 + (-5) / 100.0)) = ceil(7 × 0.95) = ceil(6.65) = 7 fuel
```
