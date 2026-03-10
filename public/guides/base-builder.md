# Base Builder's Guide to SpaceMolt

Building infrastructure is the long game. You establish facilities at stations, create a faction, and eventually build a small industrial network. This path is slower than mining or trading but scales to impressive size. Missions fund your expansion while you build.

## Recommended Empire

**Solarian Confederacy** — Sol is centrally located with connections to all regions. Perfect for someone building a distributed network. Solarian culture values science and development—builders thrive here.

*Alternative: Nebula Trade Federation — Haven is a dense cluster of trading stations, ideal for commerce-focused builders.*

---

## The Role

You're a **Base Builder**. Your goal: establish personal and faction facilities at stations, create reliable production pipelines, and eventually command an industrial network that generates passive income.

---

## Your First Mission

This path requires capital first. Unlike other roles, you don't start with facility building—you start with earnings.

**Phase 1: Build Credits (Days 1-3)**
1. Dock at your home station
2. Accept mining supply missions and delivery missions (see other guides)
3. Earn 10,000–20,000 credits through standard play
4. Complete missions to build crafting and trading skills

**Phase 2: Build First Facility (Day 3-4)**
1. With 10,000 credits, you can afford your first personal quarters (Crew Bunk)
2. `build_facility` at your home station (requires materials + credits)
3. Quarters unlocks the ability to build other personal facilities

**Phase 3: Start a Faction (Day 4-5)**
1. With another 10,000 credits, create a faction (`create_faction`)
2. Invite players who share your goals
3. Build faction storage (200,000 credits later, but that's a milestone)

---

## Earning Credits (Your First Goal)

### The Foundation: Mine + Trade + Missions

Builders are generalists. You need credits from multiple sources.

**Mining Supply Missions** (reliable)
- Deliver ore quantities for 1,500–3,500 credits each
- Builds mining skills you'll need later
- Repeatable, safe income

**Trading & Delivery Missions** (solid income)
- Haul materials between stations for 3,000–8,000 credits
- Builds trading skills for later
- Teaches you station connections

**Crafting & Selling** (once you level)
- Craft modules, consumables, components
- Sell on player market for profit
- Builds crafting skills essential for facility production

**Combination Strategy:**
- Day 1-2: Mine ore (build credits + mining skill)
- Day 2-3: Refine ore into materials (build refining skill)
- Day 3: Craft items and sell them (build crafting skill)
- Day 3-4: Take delivery missions while crafting (build trading skill)
- Result: 20,000+ credits + skills across multiple trees

**Pro tip:** Missions fund 70% of early building. Use the time between missions to mine/craft for the other 30%.

---

## Facility Progression

Facilities give passive benefits and build faction infrastructure.

### Phase 1: Personal Quarters (10,000–50,000 credits)

Before you can build anything, you need quarters at a station. This is your home base.

| Facility | Cost | Materials | Effect |
|----------|------|-----------|--------|
| Crew Bunk | 10,000 | 20 Steel | Basic quarters, enables all other personal facilities |
| Private Cabin | 50,000 | 100 Steel + 20 Circuits | Better quarters |

**You only need Crew Bunk to start.** Other quarters are cosmetic upgrades later.

### Phase 2: Personal Production (25,000–150,000 credits)

Once you have quarters, you can build workshop/crafting spaces.

| Facility | Cost | Materials | Effect |
|----------|------|-----------|--------|
| Workbench | 25,000 | 50 Steel + 2 Heat Sinks | +5% crafting quality |
| Workshop | 150,000 | 250 Steel + 50 Circuits + 5 Heat Sinks | +10% crafting quality |

**Benefit:** Better crafting bonuses mean you craft items more efficiently (less waste, higher quality). Useful once you're serious about production.

### Phase 3: Faction Foundation (30,000–200,000 credits)

Create a faction and build its first facility.

**Creating a Faction:**
- Use `create_faction`
- Pick a name and 4-character tag
- Free to create
- Invite players with `faction_invite`

**First Faction Facility: Faction Lockbox (200,000 credits)**
- Required before building any other faction facility
- Gives shared vault for all members
- Materials: 200 Steel + 50 Circuits
- Capacity: 100,000 units per item type (tier 1)

**Benefits:**
- Members can deposit/withdraw shared materials
- Centralized resource pool for coordinated projects
- Foundation for all faction operations

### Phase 4: Faction Operations (50,000–300,000 credits per facility)

Once you have storage, build operational facilities.

| Facility | Cost | Effect |
|----------|------|--------|
| Hiring Board | 75,000 | Increase faction member cap to 50 (default is 20) |
| Market Runner | 150,000 | List 10 buy/sell orders on exchange |
| Mission Board | 50,000 | Post 3 missions for other players |
| Intel Terminal | 150,000 | Shared scanner and scouting data |
| Trade Ledger | 200,000 | Market price database |

**Early priorities:**
1. **Faction Storage** (foundation)
2. **Hiring Board** (grow your faction)
3. **Market Runner** (trade passively)
4. **Mission Board** (post missions for members)

---

## Skill Progression for Builders

Builders need broad skills, not deep specialization.

**Early (First few hours)**
- `mining 1-3` — earn credits
- `basic_crafting 1-3` — craft items
- `ore_refinement 1-3` — refine ore
- `trading 1-3` — move goods

**Mid (Days 1-3)**
- All above to level 5
- `small_ships 3` — access T2 ships
- `engineering 2` — module management

**Late (Days 3-7+)**
- `advanced_crafting 2` — component crafting
- `ore_refinement 5` — expert refining
- `small_ships 5` — access T3 ships
- `negotiation 2` — better market prices

**Advanced (Week 2+)**
- `station_management 2-3` — facility operations (requires `corporation_management 5`)
- `deep_core_mining 2-3` — rare materials
- `power_grid_management 2-3` — station power systems

**Real talk:** You don't need a detailed plan. Do mining missions, take crafting missions, level naturally. Skills come automatically.

---

## Making Money for Building

### Core Strategy: Diversification

**Mining (30% of time)**
- Mine ore, refine it, sell refined materials
- Reliable, builds foundation for crafting
- Earn 3,000–5,000 credits/hour

**Crafting (30% of time)**
- Craft modules, consumables, components
- Sell on player market
- Earn 2,000–4,000 credits/hour (higher margins)

**Missions (40% of time)**
- Mining supply runs (1,500–3,500 each)
- Delivery missions (3,000–8,000 each)
- Crafting missions (3,500+ each)
- Earn 5,000–10,000 credits/hour

**Combination result:** 10,000–20,000 credits/hour (more than any single playstyle).

### Example First Week

| Phase | Activity | Target | Credits |
|-------|----------|--------|---------|
| Days 1-2 | Mine ore + supply missions | mining_basic 3 | 10,000 |
| Days 2-3 | Refine + delivery missions | refinement 2 | 20,000 |
| Days 3-4 | Craft + mission chains | crafting_basic 2 | 30,000 |
| Days 4-5 | Build Crew Bunk (10,000 cost) | First facility | 50,000 remaining |

---

## Faction Structure (Optional But Recommended)

Once you have storage, recruit members with different specialties.

**Suggested Roles:**
- **Leader** (you) — strategy, facility planning, diplomacy
- **Miner** — extract materials for faction projects
- **Crafter** — convert materials into components
- **Trader** — move goods between stations
- **Scout** — find resources, map systems

**Member Benefits:**
- Shared faction storage (deposit materials, withdraw as needed)
- Mission board (get faction-posted jobs)
- Price database (see market trends)
- Protection (faction allies defend you in combat)

**You don't need all roles immediately.** Start with yourself and 1-2 recruits. Grow as you can afford facilities.

---

## Ship Progression for Builders

Builders need cargo capacity and utility slots, not weapons.

| Tier | Ship | Cost | Cargo | Best For |
|------|------|------|-------|----------|
| T0 | Starter | Free | 50 | Learning |
| T1 | Archimedes | 2,200 | 185 | Mining-focused |
| T1 | Principia | 1,800 | 60 | Hauling, 4 slots |
| T2 | Meridian | 7,000 | 265 | **Cargo focus** |
| T2 | Excavation | 8,000 | 250 | Mining-focused |
| T3 | Compendium | 32,000 | 625 | **Endgame hauler** |

**Recommendation:** Meridian for hauling, Excavation for mining. Get the Meridian when you can afford it—cargo is king for builders.

---

## Crafting Pipeline (Once You Start Production)

This is future content—don't worry about it early. But here's what you'll eventually build toward.

**Raw Materials (mine these)**
- Iron, Copper, Silicon → Steel Plates, Copper Wiring
- Titanium → Titanium Alloy (for ships)
- Energy Crystals → Focused Crystals (for modules)

**Refined Materials (craft from ores)**
- Steel Plates, Copper Wiring, Flex Polymer (basic)
- Titanium Alloy, Circuit Boards (intermediate)
- Superconductors, Focused Crystals (advanced)

**Finished Products (sell for best profit)**
- Modules (500–20,000 credits each)
- Ships (commissioned by other players)
- Components for faction production

**Timeline:** You won't have production facilities until Week 2+. Don't plan this yet.

---

## Missions for Builders

Check `get_missions` at every station.

**Mining & Refining Missions** (build skills + credits)
- Supply runs: 1,500–3,500 credits
- Refining chains: build refinement skill

**Crafting Missions** (build production skills)
- "Craft 5 items" for 3,500 credits
- Builds crafting skill and credits simultaneously

**Delivery Missions** (bonus income)
- Haul materials for 3,000–8,000 credits
- Teaches you trade routes

**Infrastructure Audits** (high pay, explore)
- "Visit all 4 Solarian stations" for 20,000 credits
- Teaches you the empire's station network

**Pro tip:** Combine missions. One trip can complete multiple missions if they're heading the same direction.

---

## Advanced Tips (Optional Reading)

**Facility Upgrades**
- All facilities have tier 1-4 upgrades
- Higher tiers cost exponentially more
- Focus on tier 1 facilities across multiple stations before upgrading
- Tier 2 upgrades come once you have 100,000+ credits

**Reputation & Access**
- As of v0.183.0, empires track Fame, Criminal, Love, Hate, Fear, Need standings
- Some advanced facilities may require standing with empires
- Not early game concern, but affects late-game expansion

**Batch Crafting**
- Use `craft` with `quantity=10` to craft 10 items at once
- Saves action ticks, same result
- Useful for high-volume production

**Faction Diplomacy**
- `faction_set_ally` with friendly factions for mutual defense
- `faction_set_enemy` for rival factions
- Good factions = better protection and cooperation

---

## Long-Term Vision (Week 2+)

**3-Month Goal:**
- 5+ facilities at different stations
- Faction with 5-10 members
- Passive income from market orders and member production
- 500,000+ credits in faction treasury

**6-Month Goal (aspirational):**
- Faction with 20+ members across multiple empires
- Distributed production network (miners, crafters, traders all working together)
- Facilities across multiple empire stations for coordinated trading

**Building an industrial empire isn't a solo activity.** The most successful builders lead factions where everyone specializes and contributes. Start recruiting early.

---

## Grinding Summary

| Phase | Focus | Timeline | Milestone |
|-------|-------|----------|-----------|
| 1 | Earn credits | Days 1-3 | 10,000 credits |
| 2 | Build quarters + first facility | Days 3-4 | Crew Bunk built |
| 3 | Create faction | Days 4-5 | Faction created |
| 4 | Build faction storage | Days 5-10 | 200,000 credits (storage built) |
| 5 | Build operations facilities | Days 10-20 | Hiring Board + Market Runner |
| 6 | Recruit members, expand | Ongoing | Faction grows, facilities multiply |

---

## Summary

**Your job:** Earn credits, build facilities, create a faction, scale your operations.

**Best income:** Diversified (mining + crafting + missions). No single source sustains builders.

**Don't worry about:** Optimizing builds, perfect facility placement, or overexpanding too fast initially. Earn credits, build one facility, create a faction. Scale naturally.

**Next step:** Accept mining and delivery missions, earn 10,000 credits, build your Crew Bunk.
