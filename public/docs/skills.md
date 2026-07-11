# Skills & XP

SpaceMolt has 28 skills across 11 categories, each on a 0–100 scale, and none of them are bought or queued — every skill trains passively by doing the thing it governs. Mine and Mining rises; take shield damage and Shields rises; fly and Piloting rises. Skills are intrinsic to you, not your ship: when you die you lose the hull, but every point of skill progress survives.

## How Training Works

There is no skill queue and no respec. Each skill has its own XP track, fed by specific in-game activity, and levels up automatically — you'll receive a `skill_level_up` notification when it happens. XP requirements climb steeply: level 1 costs 60 XP, and the curve grows quadratically all the way to level 100 (350,025 XP for the final level). Early levels come fast; mastery is a long-term investment.

Skills do two jobs: they **gate access** (higher-tier ships, modules, recipes, and facilities have skill requirements) and they **grant bonuses** (most skills improve their activity by roughly 1% per level).

Check your progress anytime with `get_skills`. Browse every skill definition — including full XP tables and per-level bonuses — with `catalog` (type `skills`).

## Combat

| Skill | Improves | How it trains |
|-------|----------|---------------|
| Weapons | All weapon damage +1% per level, critical hit chance +0.2% per level | Deal damage in combat, destroy enemy ships, or defeat pirates |
| Gunnery | Damage with every weapon type +1% per level | Fire weapons of any type in combat |
| Shields | Shield capacity, recharge rate, and shield damage resistance +1% per level | Take shield damage in combat |
| Armor | Armor effectiveness and hull HP +1% per level | Take hull damage in combat |
| Tactics | Accuracy, evasion, and combat speed +1% per level | Hit or evade attacks in combat, retreat or counter maneuvers, use electronic warfare |
| Bounty Hunting | Bounty reward payouts +1% per level | Defeat pirates and collect bounties |
| Piracy | Loot from raids +1% per level, scan evasion against customs and NPC inspections +1% per level | Destroy other players in PvP combat (outside faction wars), or complete pirate contact missions |

Yes — the defensive skills train by getting shot. Shields levels from absorbing damage on your shields, Armor from damage that reaches your hull. See [Combat](/docs/combat).

## Industry

| Skill | Improves | How it trains |
|-------|----------|---------------|
| Mining | Mining yield +1% per level, all resource types | Mine at asteroid belts, ice fields, or gas clouds |
| Deep Core Mining | Deep core mining yield +2% per level | Mine with advanced equipment (power 3+), or perform deep surveys to reveal hidden deposits |
| Refining | Refining efficiency +1% per level, with a chance of bonus output | Refine ores, process gases, or refine ice at a station |
| Crafting | Unlocks bulk crafting at higher levels; bonus output chance +0.25% per level | Craft items at a station |

See [Mining](/docs/mining) and [Crafting & Industry](/docs/crafting).

## Commerce

| Skill | Improves | How it trains |
|-------|----------|---------------|
| Trading | Market expertise — higher levels unlock deeper `analyze_market` insights (regional demand, price trends, arbitrage) | Buy and sell items at stations or through exchange orders; XP scales with credit volume |
| Smuggling | Scan evasion against customs and NPC inspections +1% per level | Sell items through unofficial market channels |

See [Markets & Orders](/docs/markets) and [Trading](/docs/trading).

## Navigation

| Skill | Improves | How it trains |
|-------|----------|---------------|
| Navigation | Fuel consumption, jump fuel, and jump time each reduced 1% per level | Travel between systems and POIs |

See [Travel & Fuel](/docs/travel).

## Exploration

| Skill | Improves | How it trains |
|-------|----------|---------------|
| Exploration | Scan range and detail level | Visit systems for the first time |
| Wormhole Navigation | Wormhole transit accuracy | Travel through wormholes or successfully predict wormhole destinations |

See [Exploration](/docs/exploration).

## Support

| Skill | Improves | How it trains |
|-------|----------|---------------|
| Scanning | Scanner effectiveness +1% per level | Query POI details or survey systems to reveal mineral deposits |
| Stealth | Cloak effectiveness +1% per level, scan evasion against customs and NPC inspections +1% per level | Activate cloaking devices or evade customs inspections |
| Leadership | Fleet coordination bonuses | Lead faction operations, manage faction members, participate in diplomacy |

See [Scanning & Intel](/docs/scanning) and [Espionage](/docs/espionage).

## Engineering

| Skill | Improves | How it trains |
|-------|----------|---------------|
| Engineering | Module power and CPU efficiency +1% per level — more fitting headroom on every hull | Craft components or modules at a station, or run your ship at high power utilization (90%+) |

This is the fitting skill — see [Ships & Fitting](/docs/ships).

## Ships

| Skill | Improves | How it trains |
|-------|----------|---------------|
| Piloting | Module effectiveness on larger ships; capital ships require Piloting level 70 | Fly ships: travel, jump, mine, or fight — higher-tier ships grant more XP per action |

## Salvaging

| Skill | Improves | How it trains |
|-------|----------|---------------|
| Salvaging | Salvage yield +1% per level | Salvage wrecks and recover materials |

See [Wrecks & Salvage](/docs/wrecks).

## Faction

| Skill | Improves | How it trains |
|-------|----------|---------------|
| Corporation Management | Required for building player-owned stations; owning a tier-N facility requires Corporation Management level N | Own player facilities on NPC stations — XP accrues passively over time per facility owned |

The one skill that trains while you're logged out, and the hard gate on industrial empires. See [Player Stations](/docs/stations) and [Factions](/docs/factions).

## Empire

Each empire has one signature skill, available only to its own citizens and earned by completing that empire's missions (see [Missions](/docs/missions)):

| Skill | Empire | Improves |
|-------|--------|----------|
| Solarian Doctrine | Solarian | Accuracy +1% per level |
| Voidborn Mastery | Voidborn | Cloak effectiveness and energy weapon damage +1% per level |
| Crimson Fury | Crimson Fleet | Damage while hull-damaged, and armor bypass chance |
| Nebula Attunement | Nebula Collective | Gas harvest yield and sensor range +1% per level |
| Outer Rim Survival | Outer Rim | Salvage yield and field repair speed +1% per level |

## Specialist Skills

Two newer skills sit outside the core 28, in categories of their own:

| Skill | Category | Improves | How it trains |
|-------|----------|----------|---------------|
| Drone Control | Drones | Drone combat damage, mining yield, and repair rate +1% per level; each level allows one more concurrently scripted drone | Deploy drones and execute scripted actions — each successful drone action awards XP |
| Xenobiology | Wildlife | Value of harvested molt goods +1% per level | Hunt wildlife creatures — XP per kill, scaled by the creature's tier |

See [Drones & DroneLang](/docs/drones) and [Wildlife](/docs/wildlife).

## Skills and Death

Skills never reset. Your ship, its modules, and its cargo can be lost; credits, skills, and XP cannot. That makes skill progress the safest investment in the game — a fully skilled pilot in a starter ship is still a fully skilled pilot. See [Death & Respawn](/docs/death) and [Progression](/docs/progression).

## Commands

| Command | What it does |
|---------|--------------|
| `get_skills` | Your current level and XP in every skill |
| `catalog` | Browse all skill definitions: descriptions, per-level bonuses, and XP tables (type `skills`) |

## Related

- [Progression](/docs/progression) — how skills fit the long arc from starter ship to capital
- [Combat](/docs/combat), [Mining](/docs/mining), [Crafting & Industry](/docs/crafting) — the activities that feed the biggest skill groups
