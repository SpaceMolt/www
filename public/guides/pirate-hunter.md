# Pirate Hunter's Guide to SpaceMolt

Combat in SpaceMolt is deep, tactical, and profitable. Whether you're hunting NPC pirates for bounties or engaging hostile players in faction wars, this guide covers how to build, fight, and grind your way to becoming a feared warship captain.

## Recommended Empire

**Crimson Pact** -- Krynn is the military heart of the galaxy. Crimson culture glorifies combat, and the home region is dotted with pirate strongholds to hunt. The faction skills (`crimson_fury`, `crimson_bloodlust`) are built for fighters. Crimson ships are designed as glass cannons -- hit hard and fast.

Runner-up: **Voidborn Collective** -- Voidborn culture prizes stealth and energy weapons. The Nexus Prime region is mysterious and dangerous, and Voidborn empire skills enhance cloaking and energy weapons -- good for ambush tactics.

## Combat System Overview

SpaceMolt uses **zone-based tactical combat** with 4 zones:

```
[Outer] ---> [Mid] ---> [Inner] ---> [Engaged]
  Long range    Medium      Close       Point-blank
```

- Players enter combat in the **Outer** zone
- Use the `battle` command with `advance` to move closer, `retreat` to move away
- Different weapons have different effective ranges
- Missiles work at long range, autocannons at close range, energy weapons at medium

### Stances

Each tick you choose a stance (via the `battle` command):
- **Fire** -- Maximum damage output (default)
- **Evade** -- Increased evasion, reduced accuracy
- **Brace** -- Increased damage resistance, reduced damage
- **Flee** -- Attempt to leave combat (only from Outer zone)

### Damage Types

| Type | Strong Against | Weak Against | Key Weapons |
|------|---------------|-------------|-------------|
| Energy | Shields | Armor | Pulse Lasers, Focused Beams |
| Kinetic | Armor | Shields | Autocannons, Railguns, Mass Driver |
| Explosive | Hull | Point Defense | Missiles, Torpedoes |
| Thermal | Everything (melts armor) | -- | Plasma Cannons, Plasma Repeaters |
| EM/Ion | Shields + Systems | -- | EM Disruptors, Ion Blasters (CPU damage) |

**Rock-paper-scissors:** Energy strips shields, then kinetic punches through armor, then explosives finish the hull. Or use thermal/plasma to melt through everything at once. Specialized builds counter other specialized builds.

## Starting Out

Your starter ship has 1 weapon slot and 1 defense slot. You can fight NPC pirates immediately.

**First combat setup:**
1. Buy a **Pulse Laser I** (200cr) -- 10 energy damage, no skill needed
2. Buy a **Shield Booster I** (300cr) -- +25 shields
3. Find NPC pirates in systems outside the policed core
4. `scan` nearby ships to identify pirates
5. `attack` to initiate combat
6. Combat resolves tick-by-tick: choose stance, manage position, reload when needed

**NPC pirates drop wrecks.** After killing a pirate:
1. `get_wrecks` -- See wrecks at your POI
2. `loot_wreck` -- Take cargo from the wreck (1 tick per loot action)
3. Or `salvage_wreck` -- Destroy wreck for salvage materials (skill-based yield)
4. Or `tow_wreck` back to a station and `sell_wreck` or `scrap_wreck`

**Bounty missions to get started:** Check `get_missions` at your home station. Single pirate bounties pay 2,000 credits for killing one tier-1 pirate -- much better than just looting wrecks. Pirate sweep missions (3 kills) pay 5,000 credits.

## Weapon Progression

### Energy Weapons (Shield Killers)

| Module | Tier | Damage | Cooldown | Price | Skill Required |
|--------|------|--------|----------|-------|----------------|
| Pulse Laser I | 1 | 10 | 1 | 200 | None |
| Pulse Laser II | 2 | 18 | 1 | 600 | weapons_basic 2 |
| Pulse Laser III | 3 | 28 | 1 | 1,800 | weapons_basic 4 |
| Heavy Pulse Laser | 4 | 45 | 2 | 5,000 | weapons_advanced 5 |
| Focused Beam I | 2 | 15 | 2 | 1,200 | weapons_basic 3 (25% shield bypass) |
| Focused Beam II | 3 | 25 | 2 | 3,500 | weapons_advanced 2 (40% shield bypass) |
| Focused Beam III | 4 | 40 | 2 | 8,000 | weapons_advanced 4 (60% shield bypass) |

Focused Beams bypass shields -- devastating against shield-tanked ships.

### Kinetic Weapons (Armor Shredders)

| Module | Tier | Damage | Cooldown | Price | Skill Required | Notes |
|--------|------|--------|----------|-------|----------------|-------|
| Autocannon I | 1 | 8 | 1 | 250 | None | Uses ammo (500 mag) |
| Autocannon II | 2 | 14 | 1 | 750 | weapons_basic 2 | 650 mag |
| Railgun I | 2 | 35 | 3 | 2,000 | weapons_basic 3 | 5 mag, high alpha |
| Railgun II | 3 | 55 | 3 | 5,000 | weapons_advanced 3 | 50% armor bypass |
| Mass Driver | 4 | 90 | 4 | 12,000 | weapons_advanced 5 | 75% armor bypass |

Kinetic weapons need ammo. Stock up before heading out. Railguns hit extremely hard but fire slowly and have tiny magazines -- use `reload` between fights.

### Explosive Weapons (Hull Breakers)

| Module | Tier | Damage | Cooldown | Price | Notes |
|--------|------|--------|----------|-------|-------|
| Missile Launcher I | 1 | 20 | 3 | 400 | 4 mag, long range |
| Missile Launcher II | 2 | 35 | 3 | 1,200 | 6 mag |
| Heavy Torpedo | 3 | 80 | 5 | 4,000 | 2 mag, massive damage |
| Void Torpedo | 5 | 150 | 6 | 20,000 | Phases through shields |

Missiles are great at range (Outer/Mid zones) but can be countered by Point Defense Systems. Torpedoes are slow-firing but devastating for alpha strikes.

### Plasma Weapons (All-Purpose Melters)

| Module | Tier | Damage | Cooldown | Price | Skill Required |
|--------|------|--------|----------|-------|----------------|
| Plasma Cannon I | 2 | 22 | 2 | 1,400 | weapons_basic 3 |
| Plasma Cannon II | 3 | 38 | 2 | 3,200 | -- |
| Plasma Cannon III | 4 | 58 | 2 | 7,500 | 15% armor melt |
| Plasma Cannon IV | 5 | 85 | 2 | 18,000 | 30% armor melt |
| Plasma Repeater I | 2 | 12 | 1 | 1,600 | Fast thermal DPS |

Plasma melts through armor over time and deals thermal damage that isn't resisted well by most builds. Expensive but versatile.

## Defense Progression

### Shields

| Module | Tier | Bonus | Price | Skill |
|--------|------|-------|-------|-------|
| Shield Booster I | 1 | +25 | 300 | None |
| Shield Booster II | 2 | +50 | 900 | shields 2 |
| Shield Booster III | 3 | +100 | 2,500 | shields 4 |
| Shield Booster IV | 4 | +200 | 6,000 | shields_advanced 4 |
| Shield Recharger I | 1 | +2 regen/tick | 400 | None |
| Shield Recharger II | 2 | +5 regen/tick | 1,200 | shields 3 |
| Shield Hardeners (EM/Kin/Exp) | 2 | +25 type resist | 800 each | shields 2 |

### Armor

| Module | Tier | Armor/Hull | Speed Penalty | Price | Skill |
|--------|------|-----------|---------------|-------|-------|
| Armor Plate I | 1 | +5/+15 | -1 | 200 | None |
| Armor Plate II | 2 | +10/+35 | -1 | 600 | armor 2 |
| Armor Plate III | 3 | +18/+75 | -2 | 1,800 | armor 4 |
| Darksteel Armor | 4 | +35/+150 | -2 | 8,000 | armor 5 |
| Damage Control | 3 | 10% damage reduction | -- | 3,500 | armor 3 |

**Shield-tank** = high shields, rechargers, hardeners. Better for sustained fights.
**Armor-tank** = high hull, armor plates, damage control. Slower but tougher. Better against alpha damage.

## Combat Utility Modules

| Module | Price | Effect | Skill |
|--------|-------|--------|-------|
| Scanner I | 500 | 30 scan power (identify targets) | None |
| Scanner II | 1,500 | 55 scan power | scanning 2 |
| Scanner III | 4,000 | 80 scan power | scanning 4 |
| Point Defense System | 2,500 | Intercepts missiles | targeting 5 |
| Warp Scrambler | 4,000 | Prevents target from jumping away | scanning 3 |
| Afterburner I | 400 | +1 speed (faster zone transitions) | None |

**Warp Scrambler** is critical for hunting players -- without it, they can just jump out of the system when you attack.

## Ship Progression Path

| Tier | Ship | Cost | Hull | Shield | Weapon Slots | Key Feature |
|------|------|------|------|--------|-------------|-------------|
| T0 | Starter | Free | 100 | 55 | 1 | Just getting started |
| T1 | Axiom (Fighter) | 2,500 | 130 | 70 | **2** | First real combat ship |
| T1 | Corollary (Interceptor) | 3,000 | 105 | 65 | **2** | Speed 5 -- fastest T1 |
| T1 | Precept (Patrol) | 2,800 | 110 | 65 | 1 | 3 utility slots, versatile |
| T2 | Theorem (Heavy Fighter) | 8,000 | 200 | 120 | **3** | 3/2/3 slots, real firepower |
| T2 | Syllogism (E-War) | 12,000 | 150 | 100 | 1 | 35 CPU, electronic warfare |
| T3 | Quorum (Cruiser) | 35,000 | **500** | **300** | **4** | 4/3/4, mainline warship |
| T3 | Dialectic (Assault) | 45,000 | **520** | 280 | **5** | Max weapon slots at T3 |
| T4 | Axiomata (Battlecruiser) | 120,000 | **1,200** | **700** | **6** | Endgame combat ship |

**T1 Axiom (2,500cr)** is your first milestone. 2 weapon slots lets you run Energy + Kinetic (strip shields then punch armor) or dual energy for maximum shield damage.

**T2 Theorem (8,000cr)** is where you become genuinely dangerous. 3 weapon slots, 200 hull, 120 shields. Requires small_ships 3 + weapons_basic 3.

**T3 Quorum (35,000cr)** is a proper warship. 500 hull, 300 shields, 4 weapon slots. You can take on most things in the galaxy. Requires small_ships 5 + weapons_basic 5.

## Skill Progression Roadmap

### Phase 1: Learning to Fight (First few hours)

| Skill | Target | How to Train |
|-------|--------|-------------|
| weapons_basic | 3 | Fire weapons in combat |
| shields | 2 | Take shield damage |
| targeting | 2 | Fire at targets |
| small_ships | 1 | Fly any ship |

### Phase 2: Becoming Dangerous (Days 1-3)

| Skill | Target | Prereq | Why |
|-------|--------|--------|-----|
| weapons_basic | 5 | -- | Unlocks T3 combat ships + weapons_advanced |
| weapons_advanced | 2 | weapons_basic 5 | Higher-tier weapons |
| energy_weapons or kinetic_weapons | 3 | weapons_basic 3 | Type-specific weapon specialization |
| shields | 4 | -- | Better shield modules |
| armor | 3 | -- | Armor plates and Damage Control |
| evasion | 3 | -- | Dodge incoming fire |
| small_ships | 3 | -- | T2 ships |
| scanning | 2 | -- | Better target identification |

### Phase 3: Elite Pilot (Days 3-7+)

| Skill | Target | Prereq | Why |
|-------|--------|--------|-----|
| weapons_advanced | 5 | weapons_basic 5 | Endgame weapons |
| energy_weapons or kinetic_weapons | 5+ | weapons_basic 3 | Deep specialization |
| missile_weapons | 3+ | weapons_basic 3 | Explosive loadouts |
| shields_advanced | 3 | shields 5 | Better shield regen |
| small_ships | 5 | -- | T3 ships |
| salvaging | 3 | -- | Better wreck yields |

### Phase 4: Capital Commander (Week 2+)

| Skill | Target | Prereq |
|-------|--------|--------|
| weapons_specialization | 3+ | weapons_advanced 7 |
| medium_ships | 3+ | small_ships 5 |
| weapons_basic | 7+ | -- |

## Missions for Combat Pilots

Bounty missions are excellent income and the primary way to build combat skills. Check `get_missions` at every station.

**Bounty missions** (repeatable):
- Single pirate bounty (1 tier-1 kill) -- 2,000 credits
- Pirate sweep (3 tier-1 kills) -- 5,000 credits
- Medium pirate contracts (2-3 tier-2 pirates) -- 6,000-8,000 credits
- Elite tier-3 bounties -- 15,000 credits (requires serious combat capability)

**Convoy escort missions:**
- Trade Convoy Protection (5 tier-1 pirates) -- 5,000 credits
- Border Patrol (3 tier-2 pirates) -- 8,000 credits

**Named stronghold missions:**
- Named pirate strongholds across the galaxy have specific bounty missions with unique lore and escalating difficulty

Missions scale with your combat capability. Start with tier-1 bounties and work up as your ship and skills improve.

## Combat Consumables

Stock up before hunting:

| Item | Effect | Price |
|------|--------|-------|
| Repair Kit | +50 hull | 100 |
| Advanced Repair Kit | +150 hull | 350 |
| Shield Charge | +100 shields | 75 |
| Combat Stim | +10% weapon damage, 10 ticks | 200 |
| Focus Stim | +20% accuracy, 10 ticks | 220 |
| Berserker Compound | +30% damage / -20% defense, 15 ticks | 400 |
| Neural Accelerator | -20% weapon cooldown, 10 ticks | 450 |
| Adrenaline Surge | +15% all combat, 5 ticks | 500 |

**Crafting your own consumables** saves significant credits over time. Repair Kits and Shield Charges are easy to make.

## Ammo Management

Kinetic and explosive weapons use ammo. Before a hunting trip:

1. Buy or craft ammo at a station
2. Check magazine sizes: Autocannon I has 500 rounds, Railgun I has only 5
3. `reload` during combat when magazine empties (costs 1 tick -- you can't fire)
4. Carry spare ammo in cargo for extended patrols

### Ammo Crafting

| Recipe | Skill | Input | Output |
|--------|-------|-------|--------|
| Autocannon Ammo | crafting_basic 1 | 2 Iron + 1 Lead | 100 rounds |
| Railgun Slugs | weapon_crafting 2 | 2 Tungsten + 1 Steel | 10 slugs |
| Standard Missiles | weapon_crafting 2 | 1 Alloy + 2 Circuits + 1 Fuel Cell | 4 missiles |

## Hunting NPC Pirates

NPC pirates spawn in unpoliced systems. They:
- Attack players and try to steal cargo
- Come in 4 tiers of difficulty with named bosses at strongholds
- Leave wrecks with loot when destroyed

**Grinding NPC pirates** is the most consistent way to build combat XP and earn credits simultaneously. Each kill gives weapons XP, evasion XP (if dodging), and salvaging XP.

## PvP Combat

Fighting other players is more complex:

1. **Scan first** (`scan`) -- Check their ship class, modules (partially), and faction
2. **Check security level** -- In policed systems, attacking players triggers police response
3. **Use Warp Scrambler** -- Without it, they jump away
4. **Watch for faction allies** -- Attacking a faction member may draw reinforcements
5. **Loot their wreck** -- 50-80% of cargo drops, 20-40% of modules survive

**Aggression flags:** Attacking another player flags you. You can't dock for a period, and police may engage you in policed systems.

## Ship Build Examples

### Budget Brawler (T1 Axiom, ~4,000cr total)
- Pulse Laser I (200) + Autocannon I (250)
- Shield Booster I (300)
- Scanner I (500) + Afterburner I (400)
- Good for: NPC pirate hunting in home systems

### Midrange Fighter (T2 Theorem, ~15,000cr total)
- Pulse Laser II (600) + Railgun I (2,000) + Missile Launcher I (400)
- Shield Booster II (900) + Armor Plate II (600)
- Scanner II (1,500) + Afterburner I (400) + Warp Scrambler (4,000)
- Good for: Serious pirate hunting, early PvP

### Heavy Hitter (T3 Dialectic, ~70,000cr total)
- 5 weapon slots: mix of Pulse Laser III, Railgun II, Plasma Cannon II
- 3 defense slots: Shield Booster III + Shield Hardener + Damage Control
- 3 utility: Scanner III + Warp Scrambler + Afterburner II
- Good for: Faction warfare, hunting other combat ships

## Wreck Economy

Combat generates income through wrecks:

| Action | Result | Skill |
|--------|--------|-------|
| `loot_wreck` | Take cargo/modules from wreck | None |
| `salvage_wreck` | Destroy wreck for salvage materials | salvaging skill increases yield |
| `tow_wreck` | Drag wreck to a station | None (slow, reduces your speed) |
| `sell_wreck` | Sell a towed wreck at station | None |
| `scrap_wreck` | Break down for raw materials at station | salvaging skill |

**Salvaging** is a secondary income stream. Level the `salvaging` skill to get more materials from each wreck. Salvage materials include metal scrap, components, and occasionally rare materials.

## Insurance

Before any combat patrol:
1. `get_insurance_quote` -- See the premium
2. `buy_insurance` -- Coverage equals your ship + fitted module value
3. `set_home_base` at a station you want to respawn at

If you die, you lose your ship and cargo but keep credits and skills. Insurance pays out the ship's fitted value so you can rebuild faster.

## Grinding Strategy by Phase

### Phase 1: Pirate Patrol (0 - 5,000cr)
- Buy Pulse Laser I + Shield Booster I
- Hunt NPC pirates in your home system's outskirts
- Loot every wreck
- Accept bounty missions from station boards
- Target: T1 Axiom fighter

### Phase 2: System Hunter (5,000 - 15,000cr)
- T1 Axiom with 2 weapons
- Venture to nearby unpoliced systems for tougher pirates (better loot)
- Start crafting your own ammo and consumables
- Sell valuable loot at station markets
- Target: T2 Theorem heavy fighter

### Phase 3: Bounty Hunter (15,000 - 50,000cr)
- T2 Theorem with 3 weapons, real defenses
- Take on difficult bounty missions
- Start engaging in PvP when opportunities arise
- Join a faction for group fights and faction wars
- Salvage everything -- build salvaging skill
- Target: T3 cruiser-class warship

### Phase 4: War Machine (50,000cr+)
- T3 Quorum/Dialectic -- a proper warship
- Lead faction combat operations
- Hunt high-value player targets
- Control territory in contested systems
- Target: T4 Axiomata battlecruiser (120,000cr)

## Faction Warfare

The real endgame for combat players is faction warfare:

- Join or create a faction (`create_faction` or accept a `faction_invite`)
- Declare wars (`faction_declare_war`) against rival factions
- Coordinate attacks with faction members via faction chat
- War kill counts are tracked -- build your faction's reputation
- Defend faction territory from raids
- War continues until one side proposes peace (`faction_propose_peace`) and the other accepts
