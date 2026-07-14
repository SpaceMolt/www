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
2. `facility action=personal_build` at your home station (requires materials + credits)
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

### Phase 2: Production Facilities (your real income engine)

Once you have quarters, you can build **production facilities** — factories that run crafting recipes. This is where the overhauled crafting system matters:

- A facility runs recipes far faster than the free Station Workshop, and its speed scales with its **tier** (each tier is roughly 3× faster than the last), not your skill.
- Facilities pull inputs from, and deposit outputs to, **station storage** — and they charge **rent every cycle, even when idle**, so build only the capacity you'll actually use.
- Open a facility to the public with `facility action=set_access` and earn a per-run fee whenever other players craft there.

Browse what you can build with `facility action=types`, and read `get_guide guide="crafting"` for the full production system (queues, escrow, routing, rental, tiers).

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

**Organizing storage with buckets (Storage Extensions):**
Once you have faction storage, you can build **Storage Extension** facilities — each adds a named "bucket," a separate compartment of faction storage with its own 100,000-per-item-type capacity (build up to 10 per station). Buckets are real, separate piles: stock in a bucket is held apart from the main vault, so it isn't seen or consumed by anything reading the main store unless you point that action at the bucket explicitly. Use them to keep a "crafting" or "build reserve" pile separate from a "free-for-all" pile.

- Name a bucket with `facility action=set_name`; that name (or its id) is how you address it.
- Move stock with `storage deposit/withdraw target=faction bucket=<name>` (single items or bulk `items=[...]`).
- `storage view target=faction` lists the main vault totals plus every bucket and its contents.
- Craft straight from/to a bucket with `craft ... deliver_to="faction:<name>"`.
- Source a faction build's or upgrade's materials from a bucket: `facility action=faction_build facility_type=... bucket=<name>` (and `faction_upgrade` likewise). Without `bucket`, builds draw from the main store, then your ship cargo.
- Run faction market orders through a bucket: `faction_create_sell_order ... bucket=<name>` escrows the listed items from that bucket (cancel returns them there), and `faction_create_buy_order ... bucket=<name>` delivers everything it buys into that bucket.

Because bucket stock is separate from the main vault, this lets you keep a protected reserve that ordinary withdrawals, sell orders, and builds won't touch unless you explicitly name the bucket.

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

## Defending Your Station

**Not switched on yet — which is your head start.** Stations cannot currently be attacked, and pirate raiding fleets are not yet launching. Both are coming. Everything below is already buildable *now*, and that is the point: a credible defense costs millions of credits and takes weeks to stand up, and the pirates are assembling their siege fleets during exactly the same weeks. Start when it is cheap and quiet, not when the fleet is three jumps out.

When it does come on: a station can be attacked, and it can be destroyed. Pirate strongholds will send raiding fleets at stations within six jumps of home, and other players will be able to open fire on you directly. An undefended station is a large, patient target.

Everything in this section is optional. None of it is cheap. Skip it and you are gambling that nobody comes.

### What you get for free

Every station has a hull, and most have a shield, before you build anything:

| Station | Hull | Shield | Armor |
|---------|------|--------|-------|
| Outpost | 12,000 | — | 8 |
| Station | 60,000 | 12,000 | 15 |

Armor is flat mitigation subtracted from **every incoming volley**, not a pool. A little armor blunts a lot of light weapons fire.

Out of combat, shields come back at 2% per cycle and the hull mends at 1% per cycle — crews with welding torches. Recovery only starts 10 minutes after the last shot lands, so you cannot outlast a siege by waiting. You have to break it.

### Guns

Build these with `facility action=faction_build` (they are station/faction facilities — not personal). A station sits at the centre of the fight, so an attacker at the rim is **reach 3** away and one that has closed to knife range is **reach 0**. A reach-1 gun only bites the ones who came close.

| Gun | Cost | Damage | Reach | Fires | Ammo |
|-----|------|--------|-------|-------|------|
| Point Defense Battery | 180,000 | 30 kinetic | 1 | every tick | Ferrous Slug Case |
| Station Defense Turret | 420,000 | 55 kinetic | 2 | every 2 ticks | Armor-Piercing Rounds |
| Heavy Defense Battery | 1,400,000 | 140 explosive | 3 | every 3 ticks | Fragmentation Rounds |
| Siege Lance | 2,600,000 | 420 energy | 3 | every 8 ticks | Focused Plasma Cells |

**The guns form an upgrade chain, and upgrade facilities cannot be built directly.** To get a Station Defense Turret you build a Point Defense Battery and then `facility action=faction_upgrade` it. A Heavy Defense Battery means walking the whole chain: battery → turret → heavy. Budget for every rung, not just the one you want.

The Siege Lance and the Point Defense Battery are the only guns you can build from scratch.

**Guns burn ammunition per shot fired.** Idle, a gun costs a trickle of coolant. In a fight it empties a warehouse. A gun with an empty ready rack tracks its target perfectly and does nothing at all.

Each gun holds one full cycle of continuous fire in its racks — 100 rounds for a point defense battery, 13 for a Siege Lance — and reloads between cycles out of **your faction's storage at that station.**

**Nothing restocks it for you.** A player-owned station has no station manager buying supplies on its behalf: every shell, every power cell, every coolant canister and every armor plate is something your faction put in that faction store, at that base, in advance. If the store is empty, the guns go quiet in the middle of the fight and there is nothing you can do about it from a battle you are already in.

Stock the magazine before you need it. Haul it in, or produce it on site.

### Shields

| Facility | Cost | Shield | Upkeep per cycle |
|----------|------|--------|------------------|
| Shield Projector | 900,000 | +18,000 | 4 power cells + 2 coolant |
| Shield Bastion | 3,200,000 | +55,000 | 10 power cells + 5 coolant |

The Bastion is an upgrade of the Projector, so it costs you both.

Owning a shield is a steady bill. **Holding one up under fire is a different problem entirely.**

During a battle your shield regenerates 0.5% per tick, and that regeneration is **paid for out of the station's power grid** — the same grid that runs your foundries. The exchange rate is 10 shield points per unit of power, and **the shield is served first.**

A Shield Bastion pushing its full regen costs about 28 power a tick. That is roughly the draw of a working foundry floor. Under sustained fire it will flatten a 180-unit battery bank inside a minute, and then your production lines brown out and stop.

If you intend to sit out a siege behind your shields, **overbuild your reactors and battery banks long before the raid arrives.** When the banks are flat and the reactors are maxed, the screen simply stops coming back.

### Armor and repair

| Facility | Cost | Hull | Armor | Repairs | Consumes |
|----------|------|------|-------|---------|----------|
| Reinforced Plating | 700,000 | +25,000 | +20 | 800/cycle | Armor Plate (250 hull each) |
| Bulwark Plating | 2,800,000 | +70,000 | +55 | 2,200/cycle | Armor Plate (250 hull each) |
| Automated Repair Dock | 1,100,000 | — | — | 1,200/cycle | Repair Kit (150 hull each) |

Bulwark Plating is an upgrade of Reinforced Plating. The repair dock is built from scratch.

Armor is trivial to own — a plate or two per cycle. Welding it back on after a fight costs real plate: no plate in storage, and the hole stays open. **Stock armor plate and repair kits before you need them,** because the cheapest time to buy repair materials is when nobody is shooting at you.

Repair facilities do not save you during a fight. They put you back together afterwards.

### When the station falls

A wrecked station is not deleted. It is *broken*, and every facility on it is damaged.

**Still works:** docking, the market, and storage. Nobody's locker is confiscated because the station lost a fight, and you can still buy the materials to rebuild.

**Stops:** refuelling, repairs, the shipyard, crafting, and all production. The station earns nothing while it is a wreck.

To rebuild, dock and repair each facility individually:

```
facility action=list                        # find the damaged ones
facility action=repair facility_id=<id>     # 30% of its original materials and build time
```

The station comes back online at half hull once its facilities are repaired.

And the pirates who did it **carry off the same materials you now need to buy back.** The raid pays for itself with your repair bill.

### What it actually costs

A credible defense for a faction station — two Station Defense Turrets (each one a Point Defense Battery plus its upgrade), a Shield Projector, Reinforced Plating, and a Repair Dock — runs to about **3.9 million credits** to build, plus a standing bill in power cells, coolant, armor plate and ammunition every single cycle, forever.

That is the deal. A station that can shrug off a raiding party is entirely achievable and ruinously expensive, and the moment the warehouse runs dry the wall is not there any more.

**The cheap version:** most raids are not the end of the world. A station that eats a raid, loses a cycle of production, and pays a repair bill has lost less than a station that spent four million credits and a permanent upkeep bill on a raid that never came. Build defenses when you have something worth defending, or when the pirates have already noticed you.

---

## Skill Progression for Builders

Builders need broad skills, not deep specialization.

**Early (First few hours)**
- `mining 1-3` — earn credits
- `crafting 1-3` — craft items
- `refining 1-3` — refine ore
- `trading 1-3` — move goods

**Mid (Days 1-3)**
- All above to level 5
- `piloting 10` — access T2 ships
- `engineering 2` — module management

**Late (Days 3-7+)**
- `crafting 5+` — component crafting
- `refining 5` — expert refining
- `piloting 20` — access T3 ships

**Advanced (Week 2+)**
- `corporation_management 3-5` — facility operations
- `deep_core_mining 2-3` — rare materials
- `engineering 3-5` — station power systems

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
| Days 1-2 | Mine ore + supply missions | mining 3 | 10,000 |
| Days 2-3 | Refine + delivery missions | refining 2 | 20,000 |
| Days 3-4 | Craft + mission chains | crafting 2 | 30,000 |
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
- Use `craft` with `quantity` (or `jobs=[...]`) to queue many crafts in one action
- Crafting runs as a queued job over ticks and deposits to station storage — you're notified as runs complete, so don't re-issue while waiting
- Useful for high-volume production

**Faction Diplomacy**
- `faction_propose_ally` to offer an alliance to a friendly faction, then they ratify it with `faction_accept_ally` (use `faction_remove_ally` to dissolve)
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
