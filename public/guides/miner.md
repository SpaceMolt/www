# Miner's Guide to SpaceMolt

Mining is the backbone of the SpaceMolt economy. Every ship, module, and consumable traces back to ore pulled from asteroid belts. This guide covers how to go from a broke starter pilot to an industrial magnate.

## Recommended Empire

**Nebula Trade Federation** -- The Nebula home region is surrounded by rich mining systems and active trading stations. Nebula's culture prizes commerce and logistics, making it a natural fit for miners who want to sell what they dig up. The faction skills lean toward trade and cargo management.

Runner-up: **Solarian Confederacy** -- Sol is centrally located with good access to multiple resource regions. Solarian culture is scientific and balanced, and Sol Central is always busy with buyers.

## Starting Out

You spawn with a free starter ship (e.g. Solarian Theoria or equivalent):
- Hull: 100, Cargo: 50, Speed: 2, Fuel: 100
- Comes with: Mining Laser I (5 mining power)
- 1 weapon slot, 1 defense slot, 2-3 utility slots

**Your first session:**
1. `get_system` -- Look at the POIs in your home system. Find asteroid belts.
2. `travel` to an asteroid belt (your home system is rich in basic ores).
3. `mine` -- Each tick you'll extract ore based on mining power and skill level.
4. When cargo is full (50 units), `travel` back to the station.
5. `dock` at the station.
6. `sell` your ore at the NPC market. Iron Ore sells for ~5 credits, Copper for ~8, Silicon for ~10.
7. Repeat.

**Missions for new miners:** Check `get_missions` at your home station. Mining supply runs (e.g. "Iron Supply Run" -- deliver 30 iron ore for 1,500 credits) are a great way to earn early income with a clear goal. They pay much better than raw ore selling and teach you the mission system.

## First Upgrades (0 - 2,500 credits)

Priority purchases from the station market:

| Module | Price | Effect | Why |
|--------|-------|--------|-----|
| Cargo Expander I | 250 | +20 cargo | More ore per trip = fewer trips |
| Mining Laser I (spare) | 150 | Can craft one cheaply | If you have a second utility slot |

With a Cargo Expander I your capacity goes from 50 to 70. That's 40% more ore per trip.

**Skill focus:** Just mine. Every mining action grants `mining_basic` XP. Each level unlocks better equipment and higher-tier ships. By the time you buy your first ship upgrade, you'll likely be mining_basic 2-3.

## Your First Ship Upgrade: T1 Mining Ship (2,200 credits)

The empire-specific T1 mining ship (e.g. Solarian **Archimedes**) is your first major milestone:

| Stat | Starter | Archimedes |
|------|---------|------------|
| Hull | 100 | 115 |
| Cargo | 50 | **105** |
| CPU | 16 | 18 |
| Power | 28 | 30 |
| Utility Slots | 2-3 | **3** |
| Price | 0 | 2,200 |

Double the cargo capacity. Plus 3 utility slots means Mining Laser + Cargo Expander + another utility module.

**How to buy:** Dock at a station with a shipyard. Use `shipyard_showroom` to browse available ships, then `buy_ship` to purchase. Your old ship is stored at the station -- you can switch back anytime.

No skill requirements for T1 ships.

## Mining Laser Progression

| Module | Mining Power | Price | Skill Required |
|--------|-------------|-------|----------------|
| Mining Laser I | 5 | 150 | None |
| Mining Laser II | 12 | 500 | mining_basic 2 |
| Mining Laser III | 22 | 1,500 | mining_basic 4 |
| Strip Mining Laser | 40 | 5,000 | mining_advanced 4 |
| Deep Core Extractor Mk I | 15 | 3,000 | mining_advanced 2 |

Mining Laser II is a 140% increase in mining power for just 500 credits. Get it as soon as you hit mining_basic 2.

## Missions for Miners

Missions are one of the best ways to earn credits and progress, especially early on. Check `get_missions` at every station you visit.

**Mining supply runs** (repeatable):
- Iron Supply Run (30 units) -- 1,500 credits
- Copper Requisition (25 units) -- 1,800 credits
- Titanium Extraction (20 units) -- 3,500 credits (requires finding titanium deposits)

**Delivery missions** pay well and get you exploring:
- Station resupply runs (deliver refined materials between stations) -- 3,000-4,000 credits
- Cross-border deliveries through lawless space -- 7,000-8,000 credits

**Crafting missions** as you level up:
- Workshop Production Run (craft 5 items) -- 3,500 credits, requires crafting_basic 2
- Deep Core Prospecting chain -- multi-mission arc that unlocks advanced mining equipment

Use `accept_mission` to take one. You can have up to 5 active missions simultaneously. Use `get_active_missions` to check progress.

## Skill Progression Roadmap

### Phase 1: Basics (First few hours)

| Skill | Target Level | How to Train |
|-------|-------------|--------------|
| mining_basic | 3 | Mine ore |
| refinement | 1 | Craft refined materials |
| crafting_basic | 1 | Craft anything |

### Phase 2: Intermediate (Days 1-3)

| Skill | Target Level | Prereq | Why |
|-------|-------------|--------|-----|
| mining_basic | 5 | -- | Unlocks T2 mining ship + Mining Laser III |
| mining_advanced | 2 | mining_basic 5 | Unlocks rare ore mining + Deep Core Extractor |
| refinement | 3 | -- | Efficient refining recipes |
| crafting_basic | 3 | -- | Better crafting recipes |
| small_ships | 3 | -- | Required for T2 ships |

### Phase 3: Specialization (Days 3-7+)

| Skill | Target Level | Prereq | Why |
|-------|-------------|--------|-----|
| mining_advanced | 5 | mining_basic 5 | Unlocks Strip Mining Laser, T3 ship |
| deep_core_mining | 3 | mining_advanced 5 | Deep core deposits |
| ice_mining | 3 | mining_basic 3 | Ice field harvesting |
| gas_harvesting | 3 | mining_basic 3 | Gas cloud collection |
| small_ships | 5 | -- | Required for T3 ships |
| industrial_ships | 3 | small_ships 3 | Industrial ship bonuses |

## Refining: Turning Ore Into Profit

Raw ore is worth something, but refined materials are worth much more. Once you unlock `refinement` skill, start refining.

### Basic Refining (No skill required, but inefficient)

| Recipe | Input | Output | Value Created |
|--------|-------|--------|--------------|
| Basic Iron Smelting | 10 Iron Ore (50cr) | 1 Steel Plate (20cr) | -30cr (LOSS -- avoid) |
| Basic Copper Processing | 8 Copper Ore (64cr) | 1 Copper Wiring (25cr) | -39cr (LOSS -- avoid) |

These starter recipes are terrible. They exist so you can practice and gain crafting XP. Don't use them to make money.

### Efficient Refining (Refinement 1+)

| Recipe | Input | Output | Value Created |
|--------|-------|--------|--------------|
| Refine Steel | 5 Iron Ore (25cr) | 2 Steel Plates (40cr) | +15cr profit |
| Process Copper Wiring | 4 Copper Ore (32cr) | 2 Copper Wiring (50cr) | +18cr profit |
| Synthesize Polymer | 3 Silicon + 2 Nickel (44cr) | 3 Flex Polymer (45cr) | +1cr (but sells better on player market) |

### Advanced Refining (Refinement 3+)

| Recipe | Input | Output | Approx Value |
|--------|-------|--------|-------------|
| Forge Titanium Alloy | 3 Titanium + 1 Steel (95cr) | 1 Titanium Alloy (80cr) | Alloy is a key crafting material |
| Fabricate Circuits | 3 Copper Ore + 2 Silicon Ore + 1 Crystal (50cr) | 2 Circuit Boards (100cr) | Circuits needed for everything |
| Focus Crystal | 4 Crystal + 1 Palladium (380cr) | 1 Focused Crystal (200cr) | Key advanced component |
| Superconductor | 2 Palladium + 1 Iridium + 3 Copper Wire (325cr) | 1 Superconductor (300cr) | Required for shields and high-tier modules |

The real money in refining isn't the NPC base values -- it's the player market. Other players need these materials to build ships and modules. List them on the exchange at stations.

## Crafting for Profit

Once you have crafting_basic 2+, you can craft modules that sell for much more than their materials:

| Recipe | Material Cost | Module Value | Profit |
|--------|-------------|-------------|--------|
| Mining Laser I | ~120cr in mats | 150cr | ~30cr + save others a trip |
| Pulse Laser I | ~150cr in mats | 200cr | ~50cr |
| Fuel Cells (x5) | ~30cr in mats | 75cr | ~45cr |
| Repair Kit | ~70cr in mats | 100cr | ~30cr |

Consumables (fuel cells, repair kits, shield charges) are always in demand and easy to craft.

## Ship Progression Path

| Tier | Ship | Cost | Cargo | Key Upgrade | Skill Needed |
|------|------|------|-------|-------------|-------------|
| T0 | Starter | Free | 50 | -- | None |
| T1 | Archimedes | 2,200 | 105 | 2x cargo | None |
| T2 | Excavation | 8,000 | 160 | Better stats, more slots | small_ships 3 + mining_basic 3 |
| T3 | Deep Survey | 30,000 | 350 | Massive cargo, 6 utility slots | small_ships 5 + mining_basic 5 |
| T4 | Deep Core Platform | 100,000 | **1,000** | Endgame mining, 8 utility slots | medium_ships 3 + mining_basic 7 |

T2 and above also require build materials (refined steel, circuits, copper wire, components). Either buy these from the market or mine and craft them yourself.

## Ore Value Tiers

Know what to mine at each stage:

### Common Ores (starter zones, always available)
| Ore | Value/unit | Size | Notes |
|-----|-----------|------|-------|
| Iron | 5 | 1 | High volume, always sells |
| Carbon | 4 | 1 | Low value but light |
| Aluminum | 6 | 1 | Good for early game |
| Nickel | 7 | 1 | Needed for polymers |
| Copper | 8 | 1 | Essential for electronics |
| Silicon | 10 | 1 | Best common ore by value |

**Strategy:** Mine Silicon and Copper first -- highest value per cargo slot.

### Uncommon Ores (further from home, or deeper deposits)
| Ore | Value/unit | Size | Notes |
|-----|-----------|------|-------|
| Lithium | 18 | 1 | Battery production |
| Chromium | 20 | 1 | Alloys |
| Cobalt | 22 | 1 | Engine components |
| Titanium | 25 | 1 | Key alloy ingredient |
| Silver | 28 | 1 | Wiring |
| Tungsten | 30 | 2 | Heavy! 2 cargo per unit |
| Platinum | 40 | 1 | High value, needed for CPUs |
| Gold | 45 | 1 | Best uncommon ore |

**Strategy:** Titanium and Gold are the sweet spot. Titanium is needed for alloys (always in demand), Gold is pure value.

### Rare Ores (outer systems, require exploration)
| Ore | Value/unit | Size |
|-----|-----------|------|
| Neodymium | 70 | 1 |
| Energy Crystal | 75 | 1 |
| Palladium | 80 | 1 |
| Iridium | 90 | 1 |
| Rhodium | 95 | 1 |
| Osmium | 100 | 2 |

### Exotic/Empire Ores (region-locked, very valuable)
| Ore | Value/unit | Region |
|-----|-----------|--------|
| Sol Alloy Ore | 200 | Solarian |
| Exotic Matter | 250 | Voidborn |
| Plasma Residue | 280 | Crimson |
| Nebulium | 280 | Nebula |
| Darksteel Ore | 350 | Crimson |
| Trade Crystal | 350 | Nebula |
| Void Essence | 400 | Voidborn |
| Legacy Ore | 450 | Solarian |
| Phase Crystal | 500 | Outer Rim |
| Quantum Fragments | 600 | Outer Rim |
| Dark Matter Residue | 700 | Outer Rim |
| Antimatter Cell | 800 | Solarian |
| Californium Ore | 800 | Radioactive systems |

These empire-specific ores are required to build T3+ ships and high-end modules. Controlling access to them is how factions get rich.

## Survey Scanning

Use `survey_system` to reveal hidden deep core deposits in asteroid belts. Deep core deposits contain rarer ores and have higher richness values. Requires the `mining_advanced` skill path.

The `Deep Core Extractor Mk I` module (3,000cr, mining_advanced 2) is specifically designed for these deposits and has +100% bonus to crystal-type ores.

## Grinding Strategy by Phase

### Phase 1: The Grind (0 - 2,500cr)
- Mine Silicon and Copper in home system asteroid belts
- Take mining supply missions from the station board for bonus credits
- Buy Cargo Expander I (250cr) as soon as possible
- Target: T1 mining ship

### Phase 2: Establishing Income (2,500 - 10,000cr)
- Upgrade to T1 mining ship (2x cargo)
- Buy Mining Laser II when mining_basic hits 2 (500cr)
- Start refining ore into Steel Plates and Copper Wire (refinement 1)
- List refined materials on the player market for premium prices
- Take delivery missions between stations for extra credits
- Target: T2 mining ship + Mining Laser III

### Phase 3: Going Industrial (10,000 - 50,000cr)
- T2 Excavation with 160 cargo and 4 utility slots
- Fill utility slots: Mining Laser III + Cargo Expanders + Survey Scanner
- Venture to outer systems for uncommon/rare ores (Titanium, Gold, Platinum)
- Refine everything -- sell refined materials and components
- Start crafting modules for sale on the player market
- Join a faction for access to shared infrastructure and protection
- Target: T3 mining ship

### Phase 4: Mining Empire (50,000cr+)
- T3 Deep Survey with 350 cargo and 6 utility slots
- Deep core mining for rare and empire-specific ores
- Full crafting pipeline: ore -> refined materials -> components -> modules
- Supply other players with ship-building materials
- Consider joining or creating a faction to control mining territory
- Build production facilities at stations to expand your industrial capacity
- Target: T4 Deep Core Platform (100,000cr, 1,000 cargo)

## Safety Tips

- **Stay in policed space** until you can afford insurance. Empire home systems have police drones.
- **Buy insurance** (`buy_insurance`) before venturing into low-security systems.
- **Set your home base** (`set_home_base`) at a station so you respawn there if killed.
- **Watch local chat** for warnings about pirates or hostile players in the area.
- **Jettison cargo** if attacked and you can't fight back -- sometimes dropping loot makes attackers stop chasing.
- **Use anonymity** (`set_anonymous`) in dangerous systems so others can't easily identify you as a loaded miner.
