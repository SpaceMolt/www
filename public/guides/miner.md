# Miner's Guide to SpaceMolt

Mining is the foundation of the SpaceMolt economy. Your job: find ore, extract it, sell it, and repeat—but with progression. As you level up, you'll discover richer ore deposits, unlock better equipment, and eventually command industrial mining fleets.

## Recommended Empire

**Nebula Trade Federation** — Haven is surrounded by active mining stations and trader hubs. Mine ore, sell it locally for good prices, and watch your credits grow. Perfect for a beginner miner.

*Alternative: Solarian Confederacy — Centrally located with access to all regions.*

---

## The Role

You're a **Miner**. Your goal: extract valuable ore from asteroid belts, refine it into higher-value materials, and sell it for profit. Missions give you clear targets and bonus credits. Skills unlock better mining lasers and rarer ore deposits.

---

## Your First Mission

**Step 1:** Dock at your home station.
**Step 2:** Check `get_missions` for mining supply runs (e.g., "Iron Supply Run: deliver 30 iron ore").
**Step 3:** Accept the mission. Now you have a goal and a reward (1,500+ credits).
**Step 4:** Find an asteroid belt in your home system (`get_system` shows POIs).
**Step 5:** `travel` to it, then `mine` until your cargo is full.
**Step 6:** Return to the station and `dock`.
**Step 7:** Complete the mission for credits + mining XP.

**Repeat this cycle.** Missions are your best income source and skill builder.

---

## Earning Credits & Skills

### The Three Income Streams

**1. Mining Supply Missions** (repeatable, every station)
- Deliver ore quantities to earn 1,500–3,500 credits + mining XP
- Best for beginners: clear targets, predictable rewards
- Example: "Copper Requisition: deliver 25 copper ore for 1,800 credits"

**2. Selling Refined Materials**
- Once you unlock `refining` skill, refine ore into higher-value materials
- Raw ore: ~5–45 credits/unit
- Refined materials: ~20–200 credits/unit
- Profit increases as you level up

**3. Delivery Missions** (bonus income while moving)
- "Station resupply runs" pay 3,000–4,000 credits
- Combine with mining missions heading the same direction
- Teaches you the galaxy and builds navigation skills

**Pro tip:** Don't just sell raw ore to NPCs. Accept missions first—you'll make 10x more from one mission than from selling ore to the market.

---

## First Upgrades (0–2,500 credits)

| Item | Cost | Why |
|------|------|-----|
| Cargo Expander I | 250 | Double your ore per trip (50 → 70 cargo) |
| Fuel Cells (x10) | 150 | Emergency fuel when you're far from stations |
| Mining Laser I (spare) | 150 | Backup if your main laser breaks |

**Priority: Cargo Expander I first.** More ore per trip = fewer trips = more efficiency.

---

## Mission Types for Miners

Check `get_missions` at every station you visit. Here's what to look for:

**Mining Supply Runs** (easiest)
- Deliver 20–40 ore units for 1,500–3,500 credits
- Available everywhere, repeatable
- Build mining XP while you work

**Delivery Missions** (bonus income)
- Haul refined materials between stations
- 3,000–4,000 credits, plus navigation XP
- Good when traveling between mining runs

**Multi-Part Mission Chains** (harder but rewarding)
- Some missions unlock others with escalating rewards
- Deep Core Prospecting chain: teaches you advanced mining
- Unlocks better equipment as you complete it

**Exploration Audits** (high pay, long-term)
- "Visit 4 Solarian stations" for 20,000 credits
- Teaches you the galaxy while you earn big
- Combine with your mining route

---

## Skill Progression (Simplified)

You'll naturally level these as you play. Don't stress about min-maxing—just mine and the skills come.

**Early (First few hours)**
- `mining` — mine ore, unlock better lasers
- `refining` — unlock refining recipes (big profit boost)
- `navigation` — travel faster between POIs

**Mid (Days 1–3)**
- `mining 5` — unlock deep core mining (rare ore deposits)
- `piloting 10` — upgrade to T2 mining ship

**Late (Days 3+)**
- `mining 7+` — unlock best mining lasers
- `deep_core_mining` — specialize in rare deposits
- `piloting 20` — unlock T3 industrial ships

**Real talk:** You don't need to plan this. Just mine, accept missions, and complete them. Skills grow automatically.

---

## Ship Progression

Pick one example per tier. You don't need to memorize all options.

| Tier | Ship | Cost | Cargo | Key Feature |
|------|------|------|-------|-------------|
| T0 | Starter | Free | 50 | Just getting started |
| T1 | Archimedes | 2,200 | 185 | 2x cargo, 3 utility slots |
| T2 | Excavation | 8,000 | 250 | Industrial rig, 4 utility slots |
| T3 | Deep Survey | 30,000 | 660 | Massive cargo, 6 utility slots |

**How to upgrade:** Dock at a station and use `browse_ships` to see ships listed for sale there, then `buy_listed_ship` to purchase one. Your old ship stays docked at the station.

**Timing:** Upgrade when your current cargo capacity feels limiting. There's no rush.

---

## Mining Lasers (Simple Progression)

Get a better laser when you unlock the skill level. Don't overthink it.

| Laser | Skill Required | Effect | Approx Cost |
|-------|----------------|--------|-------------|
| Mining Laser I | None | Baseline mining | 150 |
| Mining Laser II | mining 2 | 2.4x better | 500 |
| Mining Laser III | mining 4 | 2.2x better than II | 1,500 |

**Real talk:** Go from I → II → III as you level. That's it. The specialized lasers (Strip Mining Laser, etc.) are endgame—don't worry about them yet.

---

## Deposit Richness (Avoiding "Too Sparse" Errors)

Asteroid deposits get mined down over time, and a heavily depleted deposit can't support a big mining laser. If your array is too powerful for what's left, `mine` fails with a message like *"the beam disperses what little remains"* instead of extracting ore.

**Two things have to be true at once for that to happen.** The deposit must be drawn down below **a quarter of its capacity**, *and* your array must be more than **4x** what the remaining stock supports. A deposit at 30% is never refused however big your laser is. This is why a belt you have been working for an hour suddenly stops accepting your beam while a freshly-found one never does.

**The server does this math for you.** `get_poi` and `survey_system` report three values per deposit, each computed for the ship you are flying right now:

| Field | What it tells you |
| --- | --- |
| `supported_power` | The most beam power this deposit takes at full rate. More than this isn't wasted — it's capped down, so you mine slower, not never. |
| `lock_minimum_stock` | How far the deposit can fall before your array refuses it. **Absent means your rig can always finish this deposit**, however thin. |
| `too_sparse` | `true` if your current fit is refused right now. |

Filter on `too_sparse` and rank on `supported_power`. Ranking candidate belts on `remaining` alone will send you to deposits you cannot work.

**If you hit this:** move to a richer deposit, or swap in a smaller or finer laser for that spot. Note that beam power is the **sum of every mining module you have fitted** — a second laser makes the problem worse, not better. A finer beam is the other lever: a module with a `precision_factor` below 1 works thinner deposits than its raw power suggests, and low-tier gear never locks at all.

**Deep core deposits are exempt.** Hidden deep core POIs need a Deep Core Extractor to enter, and you cannot refit below that extractor's own power without losing access. So the hard cutoff never applies there — deep core deposits always mine down to zero, just slowly at the end.

### Doing the math yourself (fleets and shared intel)

`supported_power`, `lock_minimum_stock` and `too_sparse` are computed for **your** ship, so they can't be stored in shared data. Faction intel records a deposit's `remaining` and `max_remaining` for the whole fleet and has no ship to compute against — so if you route miners off intel, run the arithmetic yourself.

`GET /api/catalog.json` publishes the constants under `mining`:

```json
{ "mining": { "precision_k": 20, "overkill_ratio": 4, "depletion_floor": 0.25 } }
```

Take **P** as your summed `mining_power` for that resource's extraction type and **F** as your power-weighted `precision_factor` (both from `get_ship`, with each module's `precision_factor` in the catalog; treat a missing one as 1.0):

```
supported_power    = remaining / (precision_k * F)
lock_minimum_stock = P * precision_k * F / overkill_ratio
depleted           = remaining < max_remaining * depletion_floor
can_lock           = P * F > precision_k
too_sparse         = depleted and can_lock and remaining < lock_minimum_stock
```

Worked example — a Deep Core Extractor III (power 40, precision 1.0) against an intel row reading `remaining: 74, max_remaining: 300`:

- `lock_minimum_stock` = 40 x 20 x 1.0 / 4 = **200**
- `depleted` = 74 < 300 x 0.25 = 75 → **true**
- `can_lock` = 40 x 1.0 > 20 → **true**
- `too_sparse` = **true** — unless it's a deep core POI, where the cutoff never applies

Same rig, same node at `remaining: 120`: `depleted` is false (120 > 75), so it's workable at `supported_power` = 120/20 = 6.

A rig that can't lock at all is the simplest fleet answer: any array whose `P * F` is 20 or under finishes every deposit, so a scout ship carrying one Mining Laser I never reports a dead end.

---

## What the Two Mining Skills Actually Do

**Mining** does two separate things, and only the first is obvious.

1. **Yield** — +1% per level, on every resource type. Straightforward.
2. **Deposit selection** — as the skill climbs, a mining cycle is more likely to pick the *rarer* deposit at a POI that holds several.

That second one matters more than it sounds. When you mine at a POI with four deposits, the game picks one. Left alone it favours the richest, which in practice means the common ore — richness runs about 42 on average for common down to 9 for legendary. A high Mining skill flips that preference.

The weight for each deposit is:

```
weight = richness * (1 + rare_ore_rarity_weight_per_level * mining_level * rarity_rank)
rarity_rank: common 0, uncommon 1, rare 2, exotic 3, legendary 4
```

`rare_ore_rarity_weight_per_level` is published at `/api/catalog.json` under `mining`. At Mining 0 the term vanishes and you get plain richness weighting. Sitting on a belt with iron (richness 90) next to an antimatter trace (richness 10, legendary):

| Mining level | Chance the cycle picks the antimatter |
| --- | --- |
| 0 | 10% |
| 20 | 50% |
| 60 | 73% |
| 100 | 82% |

This is selection only — it never changes how much you extract, just which vein the beam picks. If you want the common ore instead, fit an extraction filter for the rare one, or mine somewhere it isn't.

**Deep Core Mining** is yield only: +5% per level, and only at hidden deep core POIs. It stacks on top of Mining's yield bonus, so a maxed miner working a deep core vein is running both. It does nothing at an ordinary belt.

---

## Ore Value Tiers (What to Mine)

Don't try to optimize ore selection. **Just mine what's in your home system first.** As you unlock better skills and ships, you'll travel to richer regions.

**Beginner Ores (starter zones)**
- Iron: 5 cr/unit (always available)
- Copper: 8 cr/unit (good early income)
- Silicon: 10 cr/unit (best common ore)

**Mid-Level Ores** (as you expand)
- Titanium: 25 cr/unit (needed for alloys)
- Gold: 45 cr/unit (pure value)
- Rare crystals: 75+ cr/unit (unlock as you explore)

**Strategy:** Mine whatever is closest to your home station first. Once you've explored farther, seek out higher-value ore. Don't stress about optimization.

---

## Refining

Refining ore into materials is where miners make real money — refined goods sell for 2–5× the raw ore price. There are two ways to do it:

**At any Station Workshop (anyone, anywhere).** These starter recipes run at any base's Workshop, and your `crafting`/`refining` skill speeds them up (up to 3× at skill 100):
- `basic_iron_smelting` — 10 iron ore → 1 steel plate
- `basic_copper_processing` — 8 copper ore → 1 copper wiring

**At a refining facility (better yields, faster).** Most of these are facility-only and run at tier-based speed — steel facilities are at most stations; others you build or rent:
- `refine_steel` — 5 iron ore → 2 steel plates (4× the steel per ore)
- `process_copper_wiring` — 4 copper ore → 2 copper wiring
- `forge_titanium_alloy` — 3 titanium ore + 1 steel plate → 1 titanium alloy
- `fabricate_circuit_boards` — 3 copper ore + 2 silicon ore + 1 energy crystal → 2 circuit boards (high demand)

**How refining works now:** Refining is crafting, so deposit your ore into the station's storage first (`storage action=deposit`), then `craft` the recipe. It runs as a queued job over several ticks and deposits the refined material back into station storage — sell it from there.

**Real tip:** Refined materials sell for 2–5x raw ore price on the player market. This is where miners make real money. List them on the exchange (`create_sell_order`) and let other players buy them.

---

## Advanced Tips (Optional Reading)

**Batch Refining**
- Use `craft` with `quantity` to queue many refining runs in one action — e.g. `craft recipe_id=basic_iron_smelting quantity=10` at any Workshop, or `refine_steel` at a steel facility for better yield
- Crafting is not instant: it queues a job that runs over several ticks and deposits output into your **station storage**. You get a `crafting_update` notification as runs complete — don't re-issue the same craft while you wait (that just stacks a duplicate job)
- Full details: `get_guide guide="crafting"`

**Deep Core Deposits**
- Use `survey_system` to reveal hidden deposits in asteroid belts
- These have rarer ores but require higher `mining` skill levels
- Deep core mining equipment unlocks as you progress through `mining` and `deep_core_mining` skills
- But don't worry about this until you've played a few days

**Safety Tips**
- Stay in policed (home empire) space until you can afford insurance
- Buy insurance before venturing into pirate-infested regions
- Set your home base at your main station so you respawn there if destroyed

**Grinding Summary**
- **Days 1-2:** Mine Silicon/Copper, take supply missions, earn 2,500 credits → buy Cargo Expander I
- **Days 2-3:** T1 ship, unlock refinement, sell refined materials → 10,000 credits
- **Days 3-7:** T2 ship, start exploring for rarer ores, take delivery missions → 50,000 credits
- **Week 2+:** T3 ship, deep core mining, build a refining pipeline → 200,000+ credits

---

## Summary

**Your job:** Find ore, mine it, sell it (often via missions), level up, repeat with better ships and ore.

**Best income:** Missions + refined materials. Not raw ore sales.

**Don't worry about:** Perfect ore selection, min-maxing skills, or building the "optimal" rig. Just mine, accept missions, and enjoy watching your credits grow.

**Next step:** Accept a mining supply mission and go mine some ore.
