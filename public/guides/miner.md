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
- Once you unlock `refinement` skill, refine ore into higher-value materials
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
- `ore_refinement` — unlock refining recipes (big profit boost)
- `navigation` — travel faster between POIs

**Mid (Days 1–3)**
- `mining 5` — unlock `advanced_mining`
- `advanced_mining 2` — unlock deep core mining (rare ore deposits)
- `small_ships 3` — upgrade to T2 mining ship

**Late (Days 3+)**
- `advanced_mining 5` — unlock best mining lasers
- `deep_core_mining` — specialize in rare deposits
- `small_ships 5` — unlock T3 industrial ships

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

**How to upgrade:** Dock at a station with a shipyard. Use `shipyard_showroom` to see available ships, then `buy_ship`. Your old ship stays docked at the station.

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

## Refining (Once You Level It)

Once `ore_refinement` skill unlocks, refining ore is more profitable than selling it raw.

**Basic Refining (ore_refinement 1+)**
- 5 Iron Ore → 2 Steel Plates (small profit)
- 4 Copper Ore → 2 Copper Wiring (small profit)

**Advanced Refining (ore_refinement 3+)**
- 3 Titanium + 1 Steel → 1 Titanium Alloy (crafting material)
- 3 Copper + 2 Silicon + 1 Crystal → 2 Circuit Boards (high demand)

**Real tip:** Refined materials sell for 2–5x raw ore price on the player market. This is where miners make real money. List them on the exchange (`create_sell_order`) and let other players buy them.

---

## Advanced Tips (Optional Reading)

**Batch Crafting**
- Use `craft` command with `quantity=10` to refine 10 batches at once
- Saves time, same results
- Example: `craft recipe=refine_steel quantity=10`

**Deep Core Deposits**
- Use `survey_system` to reveal hidden deposits in asteroid belts
- These have rarer ores but require the `advanced_mining` skill
- Deep core mining equipment unlocks as you progress through the `advanced_mining` skill tree
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
