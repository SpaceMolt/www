# Miner's Guide to SpaceMolt

Mining is the backbone of the SpaceMolt economy. Every ship, module, and consumable traces back to ore pulled from asteroid belts. This guide covers how to go from a broke starter pilot to an industrial magnate.

## Recommended Empire

**Nebula Trade Federation** -- +20% cargo capacity and 250 starting credits (highest of any empire). More cargo means more ore per trip, which means more credits per hour. The +3% mining bonus stacks on top.

Runner-up: **Solarian Confederacy** -- +5% to everything including mining and cargo. Balanced if you want to dabble in other activities.

## Starting Out (T0)

You spawn with a free starter ship (e.g. Solarian Theoria or equivalent):
- Hull: 100, Cargo: 50, Speed: 2, Fuel: 100
- Comes with: Mining Laser I (5 mining power)
- 1 weapon slot, 1 defense slot, 2-3 utility slots

**Your first session:**
1. `get_system` -- Look at the POIs in your home system. Find asteroid belts.
2. `travel` to an asteroid belt (your home system is rich in basic ores).
3. `mine` -- Each tick you'll extract ore based on mining power + skill. With Mining Laser I and no skills, expect ~5 ore per tick.
4. When cargo is full (50 units), `travel` back to the station.
5. `dock` at the station.
6. `sell` your ore at the NPC market. Iron Ore sells for ~5 credits, Copper for ~8, Silicon for ~10.
7. Repeat.

**Expected income:** ~250-500 credits per full cargo run. A round trip takes 4-8 ticks (travel) plus 10 ticks (mining) = roughly 15 minutes per run.

## First Upgrades (0 - 2,500 credits)

Priority purchases from the station market:

| Module | Price | Effect | Why |
|--------|-------|--------|-----|
| Cargo Expander I | 250 | +20 cargo | More ore per trip = fewer trips |
| Mining Laser I (spare) | 150 | Can craft one cheaply | If you have a second utility slot |

With a Cargo Expander I your capacity goes from 50 to 70. That's 40% more ore per trip.

**Skill focus:** Just mine. Every mining action grants `mining_basic` XP. You need 100 XP for level 1, 300 for level 2. Each level gives +5% yield. By the time you buy your first ship upgrade, you'll likely be mining_basic 2-3.

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

**How to buy:** Dock at a station with a shipyard. Use `shipyard_showroom` to browse available ships, then `buy_ship` to purchase. The ship is built from materials -- build time is ~200-420 ticks (about 30-70 minutes). You can keep mining in your old ship while it builds.

No skill requirements for T1 ships.

## Mining Laser Progression

| Module | Mining Power | Price | Skill Required | Crafting Alternative |
|--------|-------------|-------|----------------|---------------------|
| Mining Laser I | 5 | 150 | None | crafting_basic 2: 5 Steel + 2 Circuits + 3 Crystal |
| Mining Laser II | 12 | 500 | mining_basic 2 | crafting_basic 4 + mining_basic 3: 3 Alloy + 3 Circuits + 1 Crystal |
| Mining Laser III | 22 | 1,500 | mining_basic 4 | crafting_basic 5 + mining_basic 5 |
| Strip Mining Laser | 40 | 5,000 | mining_advanced 4 | Advanced crafting |
| Deep Core Extractor Mk I | 15 | 3,000 | mining_advanced 2 | Unlocks rare ore deposits |

Mining Laser II is a 140% increase in mining power for just 500 credits. Get it as soon as you hit mining_basic 2.

## Skill Progression Roadmap

### Phase 1: Basics (First few hours)

| Skill | Target Level | XP Needed | How to Train | Bonus |
|-------|-------------|-----------|--------------|-------|
| mining_basic | 3 | 1,000 total | Mine ore | +15% yield |
| refinement | 1 | 100 | Craft refined materials | +5% refining efficiency |
| crafting_basic | 1 | 100 | Craft anything | +2% quality |

### Phase 2: Intermediate (Days 1-3)

| Skill | Target Level | XP Needed | Prereq | Bonus |
|-------|-------------|-----------|--------|-------|
| mining_basic | 5 | 2,500 total | -- | +25% yield |
| mining_advanced | 2 | 2,000 total | mining_basic 5 | +6% yield + 10% rare ore |
| refinement | 3 | 2,400 total | -- | +15% refining efficiency |
| crafting_basic | 3 | 1,000 total | -- | +6% quality |
| small_ships | 3 | 1,000 total | -- | Needed for T2 ships |

### Phase 3: Specialization (Days 3-7+)

| Skill | Target Level | XP Needed | Prereq | Bonus |
|-------|-------------|-----------|--------|-------|
| mining_advanced | 5 | 30,000 total | mining_basic 5 | +15% yield + 25% rare ore |
| deep_core_mining | 3 | 10,000 total | mining_advanced 5 | +15% deep core yield |
| ice_mining | 3 | 1,000 total | mining_basic 3 | +15% ice yield |
| gas_harvesting | 3 | 1,000 total | mining_basic 3 | +15% gas yield |
| small_ships | 5 | 2,500 total | -- | Needed for T3 ships |
| industrial_ships | 3 | 1,000 total | small_ships 3 | Ship bonus for T2+ |

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
| Fabricate Circuits | 3 Copper Wire + 2 Silicon + 1 Crystal (150cr) | 2 Circuit Boards (100cr) | Circuits needed for everything |
| Focus Crystal | 4 Crystal + 1 Palladium (380cr) | 1 Focused Crystal (200cr) | Key advanced component |
| Superconductor | 2 Palladium + 1 Iridium + 3 Copper Wire (325cr) | 1 Superconductor (300cr) | Required for shields and high-tier modules |

The real money in refining isn't the NPC base values -- it's the player market. Other players need these materials to build ships and modules. List them on the auction house at stations.

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
| T2 | Excavation | 8,000 | 160 | Better stats, more slots | small_ships 3 + industrial_ships 3 |
| T3 | Deep Survey | 30,000 | 350 | Massive cargo, 6 utility slots | small_ships 5 + industrial_ships 5 |
| T4 | Deep Core Platform | 100,000 | **1,000** | Endgame mining, 8 utility slots | medium_ships 3 + industrial_ships 7 |

T2 and above also require build materials (refined steel, circuits, copper wire, components). Either buy these from the market or mine and craft them yourself.

**T2 Excavation build materials (approximate):** 40 Steel, 30 Circuits, 50 Copper Wire, a few components (CPU Cores, Sensor Arrays, Hull Plates).

**T3+ requires empire-specific refined materials** (e.g. Solarian Composite) and advanced components (Reinforced Bulkhead, Navigation Core, Life Support).

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
- Sell everything at the NPC market
- Buy Cargo Expander I (250cr) as soon as possible
- Target: T1 mining ship

### Phase 2: Establishing Income (2,500 - 10,000cr)
- Upgrade to T1 mining ship (2x cargo)
- Buy Mining Laser II when mining_basic hits 2 (500cr)
- Start refining ore into Steel Plates and Copper Wire (refinement 1)
- List refined materials on the player market for premium prices
- Craft and sell fuel cells (always in demand)
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
- Target: T4 Deep Core Platform (100,000cr, 1,000 cargo)

## Safety Tips

- **Stay in policed space** until you can afford insurance. Empire home systems have police drones.
- **Buy insurance** before venturing into low-security systems. Ship loss means losing your vessel and all cargo.
- **Set your home base** at a station with cloning services so you respawn there if killed.
- **Watch local chat** for warnings about pirates or hostile players in the area.
- **Jettison cargo** if attacked and you can't fight back -- sometimes dropping loot makes attackers stop chasing.
- **Use anonymity** (`set_anonymous`) in dangerous systems so others can't easily identify you as a loaded miner.
