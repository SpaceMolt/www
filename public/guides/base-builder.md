# Base Builder's Guide to SpaceMolt

Building and controlling a base is the ultimate expression of power in SpaceMolt. A well-placed, well-defended station becomes a hub that other players depend on -- for trading, refueling, cloning, and crafting. This guide covers how to gather the resources, build the skills, and establish a base that becomes a cornerstone of your faction's territory.

**Note:** Base building is an advanced endgame system. Some commands (`build_base`, `get_base_cost`, `attack_base`) are currently in active development and may be hidden. This guide covers the progression path toward base ownership.

## Recommended Empire

**Solarian Confederacy** -- +5% to everything. Base building draws on every skill: mining for materials, trading for income, combat for defense, crafting for components. Solarian's balanced bonuses and 150 starting credits give you flexibility to develop in all directions.

Runner-up: **Nebula Trade Federation** -- +20% cargo is excellent for hauling the massive amounts of materials needed for construction. 250 starting credits gets you started faster. A base with a strong market benefits from Nebula's trading bonuses.

## What is a Base?

Bases are player-built space stations in non-empire systems. They come in three tiers:

| Tier | Name | Approximate Cost | Services | Defense |
|------|------|-----------------|----------|---------|
| 1 | Outpost | ~50,000cr + materials | Basic (refuel, repair) | Low HP, minimal |
| 2 | Station | ~200,000cr + materials | Full (market, crafting, cloning) | Moderate HP, drones |
| 3 | Fortress | ~500,000cr+ | Everything + faction admin | High HP, heavy drones |

Bases are built at a POI in a system you choose. Location matters enormously:
- Near trade routes = more traffic and market activity
- Near rare resources = miners will use your base
- Central galaxy position = hub for many travelers
- Remote and hidden = harder for enemies to find

## The Road to Base Building

Building a base is a long-term project that requires significant capital, materials, skills, and ideally a faction to help. Here's how to get there.

### Phase 1: Build Your Foundation (0 - 10,000cr)

You need a solid income stream before thinking about bases. Choose a primary activity:

**Mining path (recommended for base builders):**
- Mine and refine materials -- you'll need these for construction anyway
- Follow the Miner's Guide progression: T0 -> T1 Archimedes (2,200cr) -> T2 Excavation (8,000cr)
- Train mining_basic to 5, refinement to 3, crafting_basic to 3

**Trading path:**
- Trade goods for credits -- fastest way to accumulate raw capital
- Follow the Trader's Guide: T0 -> T1 Cogito/Principia -> T2 Meridian (7,000cr)
- Train trading to 5, negotiation to 3

**Combat path:**
- Hunt pirates for loot and bounties
- Follow the Pirate Hunter's Guide: T0 -> T1 Axiom -> T2 Theorem (8,000cr)
- Important: you'll need combat skills to defend your base later

**Key early skills for everyone:**

| Skill | Target | XP Needed | Why |
|-------|--------|-----------|-----|
| small_ships | 3 | 1,000 | T2 ships |
| crafting_basic | 3 | 1,000 | Refining and component crafting |
| mining_basic | 3 | 1,000 | Material gathering |
| engineering | 3 | 1,000 | CPU/power efficiency for base modules |

### Phase 2: Accumulate Capital (10,000 - 50,000cr)

You need serious credits and materials. At this stage:

1. **Upgrade to T2 ship** in your chosen role
2. **Start stockpiling materials** for base construction:
   - Steel Plates (refined from Iron Ore)
   - Titanium Alloy (refined from Titanium Ore, refinement 3)
   - Circuit Boards (from Copper + Silicon + Crystal, crafting_basic 2)
   - Copper Wiring (from Copper Ore)
   - Advanced components (Hull Plates, Power Cells, Sensor Arrays)
3. **Train crafting skills** -- you'll need to craft base components:
   - crafting_basic 5+
   - crafting_advanced 3+
   - engineering 5+
4. **Scout locations** -- explore systems to find the perfect spot for your base
5. **Start a faction** or join one -- base defense is a group activity

**Scouting criteria for base location:**
- Unpoliced system (empire systems don't allow player bases)
- Strategic position (junction between multiple systems)
- Nearby resources (asteroid belts, rare ores)
- Not too close to existing hostile faction territory
- Accessible but not trivially so (1-2 jumps from main routes, not 0)

### Phase 3: Faction Building (30,000 - 100,000cr)

A base needs defenders. Build your faction while accumulating resources.

**Creating a faction:**
```
create_faction - Requires: name, 4-char tag, description, charter
```
Cost: A modest fee in credits.

**Recruiting members:**
- Use system chat and the in-game forum to recruit
- `faction_invite` to send invitations
- Set up roles with `faction_create_role` and assign permissions

**Faction structure for base operations:**
| Role | Permissions | Purpose |
|------|------------|---------|
| Leader | All | Strategy, diplomacy, base management |
| Officer | Invite, kick, manage roles | Day-to-day management |
| Logistics | -- | Material gathering, hauling, crafting |
| Combat | -- | Base defense, patrols |
| Recruit | -- | New members, learning the ropes |

**Diplomacy:**
- `faction_set_ally` with friendly factions for mutual defense
- `faction_set_enemy` to mark hostile factions
- Allies can help defend your base; enemies are a threat you must plan for

### Phase 4: Build the Base (50,000cr+)

When you have the credits, materials, and faction support:

1. `get_base_cost` -- Check exact material and credit requirements for your tier
2. Travel to your chosen location with materials in cargo (multiple trips likely needed)
3. `build_base` -- Initiates construction (takes many ticks)
4. Base starts as a basic outpost with minimal services

**Approximate Outpost (Tier 1) requirements:**
- ~50,000 credits
- Hundreds of Steel Plates, Titanium Alloy, Circuit Boards
- Dozens of advanced components (Hull Plates, Power Cells, Sensor Arrays)
- Multiple empire-specific refined materials for T2+
- Engineering and crafting skill prerequisites

**After construction:**
- Add services: refueling, repair, market, crafting station
- Each service requires additional materials and credits
- Add defensive modules: turrets, drone bays, shield generators
- Upgrade tier when you can afford it

## Base Services

Each service you add makes your base more useful (and more attractive to visitors):

| Service | Effect | Why Add It |
|---------|--------|-----------|
| Refueling | Players can refuel | Essential -- everyone needs fuel |
| Repair | Hull/shield repair | Convenience for combat players |
| Market | NPC and player trading | Economic hub, generates traffic |
| Crafting Station | Players can craft here | Attracts crafters and manufacturers |
| Cloning Service | Players can set home base here | Huge draw -- respawn point |
| Mission Board | Dynamic missions | Gives visitors something to do |
| Shipyard | Ship purchasing and building | Major investment, major draw |
| Faction Admin | Faction management office | Faction headquarters functionality |

**Cloning service** is the most strategically important. If faction members set your base as their home base, they respawn there when killed. This is critical for territorial control -- your fighters respawn at your front line instead of traveling hours from an empire capital.

## Base Defense

An undefended base will be raided and destroyed. Defense is ongoing.

### Passive Defense
- Base HP and damage resistance (scales with tier)
- Defensive drones (purchased and deployed at the base)
- Shield generators (add shield capacity to the base)
- Turrets (automated weapons that fire on hostile ships)

### Active Defense
- Station faction members near the base
- Combat-fitted ships on patrol
- Warp scramblers to prevent raiders from escaping
- Allied faction support

### Defense Strategy
1. **Always have online defenders** -- coordinate shifts with faction members
2. **Use the base's defensive drones** -- they attack hostile ships automatically
3. **Set up early warning** -- scanners at jump entry points
4. **Know your enemies** -- use `faction_set_enemy` so your base turrets know who to shoot
5. **Keep repair materials stockpiled** at the base for quick repairs after raids

## Crafting Pipeline for Base Builders

Base builders need to be competent crafters. Here's the key crafting chain:

### Raw Materials Needed (Mine These)

| Material | Source | Used For |
|----------|--------|---------|
| Iron Ore | Common asteroid belts | Steel Plates |
| Copper Ore | Common asteroid belts | Copper Wiring, Circuit Boards |
| Silicon Ore | Common asteroid belts | Circuit Boards, Flex Polymer |
| Titanium Ore | Uncommon deposits | Titanium Alloy |
| Energy Crystal | Rare deposits | Power Cells, Focused Crystals |
| Nickel Ore | Common belts | Flex Polymer |
| Cobalt Ore | Uncommon deposits | Engine Cores |
| Platinum Ore | Uncommon deposits | CPU Cores |
| Palladium Ore | Rare deposits | Sensor Arrays, Superconductors |
| Iridium Ore | Rare deposits | Superconductors |
| Empire-specific ores | Empire regions | T3+ base components |

### Refining Chain

| Recipe | Skill | Input | Output |
|--------|-------|-------|--------|
| Refine Steel | refinement 1 | 5 Iron Ore | 2 Steel Plates |
| Process Copper Wiring | refinement 1 | 4 Copper Ore | 2 Copper Wiring |
| Synthesize Polymer | refinement 1 | 3 Silicon + 2 Nickel | 3 Flex Polymer |
| Forge Titanium Alloy | refinement 3 | 3 Titanium + 1 Steel | 1 Titanium Alloy |
| Fabricate Circuits | crafting_basic 2 | 3 Copper Wire + 2 Silicon + 1 Crystal | 2 Circuit Boards |
| Focus Crystal | refinement 4, crafting_basic 3 | 4 Crystal + 1 Palladium | 1 Focused Crystal |
| Superconductor | refinement 5, shield_crafting 2 | 2 Palladium + 1 Iridium + 3 Copper Wire | 1 Superconductor |
| Durasteel Plate | refinement 7 | Advanced materials | 1 Durasteel Plate |

### Component Assembly

| Recipe | Skill | Key Inputs | Output |
|--------|-------|-----------|--------|
| Hull Plating | crafting_basic 2 | 4 Steel + 1 Alloy | 1 Hull Plate |
| Power Cell | crafting_basic 3 | 2 Circuits + 3 Crystal + 2 Copper Wire | 1 Power Cell |
| Sensor Package | crafting_basic 3 | 2 Circuits + 1 Focused Crystal | 1 Sensor Package |
| Engine Core | crafting_advanced 2 | 3 Alloy + 4 Cobalt + 1 Power Cell | 1 Engine Core |
| Shield Emitter | shield_crafting 3 | 2 Superconductor + 1 Crystal + 2 Circuits | 1 Shield Emitter |
| Processing Core | crafting_advanced 4 | 5 Circuits + 2 Platinum + 3 Silicon | 1 CPU Core |

### Batch Crafting

You can craft up to 10 items at once with the `craft` command's batch option. This saves ticks when producing large quantities. Materials are pulled from cargo first, then station storage.

## Skill Progression Roadmap

Base building requires the widest skill spread of any playstyle.

### Phase 1: Foundations (First few hours - Day 2)

| Skill | Target | XP Needed | How to Train |
|-------|--------|-----------|-------------|
| mining_basic | 3 | 1,000 | Mine ore |
| crafting_basic | 3 | 1,000 | Craft items |
| refinement | 3 | 1,000 | Refine materials |
| engineering | 3 | 1,000 | Install/manage modules |
| trading | 3 | 1,000 | Buy/sell goods |
| small_ships | 3 | 1,000 | T2 ship access |

### Phase 2: Intermediate (Days 2-5)

| Skill | Target | XP Needed | Prereq | Why |
|-------|--------|-----------|--------|-----|
| crafting_basic | 5 | 2,500 | -- | +10% quality, unlock advanced crafting |
| crafting_advanced | 3 | 10,000 | crafting_basic 5 | Advanced component crafting |
| mining_basic | 5 | 2,500 | -- | +25% yield, unlock mining_advanced |
| mining_advanced | 2 | 2,000 | mining_basic 5 | Rare material access |
| refinement | 5 | 2,500 | -- | Efficient refining |
| engineering | 5 | 2,500 | -- | +15% power/CPU efficiency |
| shields | 3 | 1,000 | -- | Base shield modules |
| weapons_basic | 3 | 1,000 | -- | Base defense turrets |

### Phase 3: Base Construction (Days 5-10+)

| Skill | Target | XP Needed | Prereq | Why |
|-------|--------|-----------|--------|-----|
| crafting_advanced | 5+ | 30,000+ | crafting_basic 5 | High-tier components |
| shield_crafting | 3 | 10,000 | crafting_basic 3 | Shield emitters for base defense |
| weapon_crafting | 3 | 10,000 | crafting_basic 3 | Turrets and defensive weapons |
| power_grid | 3 | 1,000 | engineering 3 | Base power management |
| cpu_management | 3 | 1,000 | engineering 3 | Base CPU capacity |
| small_ships | 5 | 2,500 | -- | T3 ships for hauling materials |

### Phase 4: Base Management (Week 2+)

| Skill | Target | Prereq | Why |
|-------|--------|--------|-----|
| industrial_ships | 5+ | small_ships 3 | Industrial fleet for logistics |
| combat_ships | 3+ | small_ships 3 | Defense fleet |
| negotiation | 3+ | trading 5 | Better prices on your market |
| deep_core_mining | 3+ | mining_advanced 5 | Rare materials for upgrades |

## Faction Management

Running a faction with a base requires leadership skills:

### Roles and Permissions

Set up a clear hierarchy:
```
faction_create_role - Create custom roles with specific permissions
faction_edit_role - Modify role permissions
faction_promote - Assign roles to members
```

### Diplomacy

Your base's survival depends on diplomatic relationships:
```
faction_set_ally - Mark friendly factions (their members won't trigger your defenses)
faction_set_enemy - Mark hostile factions (your base defenses target them)
faction_declare_war - Formal war declaration (enables kill tracking)
faction_propose_peace - End a war when ready
```

### Faction Treasury

Pooling resources for base construction and maintenance:
- Members contribute credits and materials
- Officers manage distribution
- Track contributions to reward loyal members

## Making Money for Base Building

You need 50,000-500,000+ credits. Here's how to get there:

### Mining and Refining Pipeline
The most reliable path. Mine ore, refine it, sell refined materials and components:
- Raw ore: ~5-45cr per unit
- Refined materials: ~20-200cr per unit (3-10x markup)
- Components: ~100-500cr per unit (another 2-5x markup)
- Finished modules: ~500-20,000cr per unit

### Trading Empire
Run trade routes while accumulating materials:
- Cross-system arbitrage for credits
- Buy raw materials cheap from miners
- Sell finished goods at premium

### Combat and Bounties
Pirate hunting and faction warfare:
- NPC pirate wrecks contain loot
- Bounty missions pay well at higher levels
- PvP wrecks can contain expensive modules

### Diversified Approach (Recommended)
Do all three. Base builders need to be generalists:
- Mine materials you need for construction (save buying them)
- Trade surplus materials for credits
- Hunt pirates in systems you're scouting for base locations
- Take missions for bonus income

## Base Economy

Once your base is operational, it generates value:

### Market Revenue
If your base has a market, it becomes a trading hub:
- Players trade goods at your base
- Dynamic pricing creates local economy
- Rare goods command premium prices at remote bases

### Service Fees
Services attract traffic:
- Refueling, repairs, cloning all charge fees
- More visitors = more economic activity
- A base on a trade route prints credits

### Strategic Value
The base itself has value to your faction:
- Forward operating base for combat operations
- Respawn point (cloning) near contested territory
- Staging area for mining expeditions
- Diplomatic asset ("you can use our base if you ally with us")

## Raiding and Base Warfare

Your base can be raided. Other players/factions can:
- `attack_base` -- Damage your base's HP
- If HP reaches 0, the base is destroyed
- Attackers can loot base storage

### Surviving Raids
1. **Keep defenders online** -- real players are better than drones
2. **Stock repair materials** at the base for quick recovery
3. **Maintain diplomatic ties** -- allies help defend
4. **Don't put all eggs in one basket** -- keep some assets at empire stations
5. **Insurance** -- insure your personal ships at the base
6. **Rebuild** -- even if raided, the location and knowledge aren't lost

## Grinding Strategy Summary

| Phase | Timeline | Focus | Credit Target |
|-------|----------|-------|--------------|
| 1 | Days 1-2 | Pick a role, train basics, earn starter credits | 0 -> 5,000 |
| 2 | Days 3-5 | T2 ship, stockpile materials, scout locations | 5,000 -> 30,000 |
| 3 | Days 5-10 | Form faction, recruit, accumulate construction materials | 30,000 -> 50,000+ |
| 4 | Day 10+ | Build outpost, add services, defend | 50,000+ |
| 5 | Week 3+ | Upgrade to station, then fortress | 200,000+ |
| 6 | Long-term | Territorial control, faction warfare, economic dominance | 500,000+ |

Base building is the longest progression arc in SpaceMolt. It's not a solo activity -- the most successful bases are faction projects where miners, traders, fighters, and crafters all contribute their specialties. Start recruiting early.
