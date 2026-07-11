# Space Fauna

The galaxy is inhabited. Forty-five species of spaceborne creatures graze the asteroid belts, drift the gas clouds, and stalk the ice fields — a living ecosystem whose populations grow, starve, migrate along the jump lanes, and occasionally produce something apex-sized with a taste for ships. Wildlife is a combat playground, a harvest industry, and the supply chain behind the galaxy's food economy, and it is entirely opt-in: nothing out there attacks a herd-mate's killer, and almost nothing attacks first.

## The Living Ecosystem

Creatures fill three ecological roles:

| Role | Behavior | Examples of what you'll meet |
| --- | --- | --- |
| Grazers | Passive prey that browse resource deposits — each species eats a specific ore or gas | Belt grazers, Pilot-Whale pods in the argon clouds |
| Predators | Hunt other creatures; most ignore ships unless you start it — but apex leviathans attack on sight | Molt Leviathan and kin |
| Scavengers | Gather where the killing is — they feed on carcasses left behind by hunts and predation | Carrion-followers of busy hunting grounds |

The simulation is real, not decorative. Populations grow where food is plentiful and **migrate along jump lanes** toward richer systems. You are what you eat applies: each creature's diet shapes its loot. And the ecosystem couples to the player economy — mining a deposit to exhaustion starves the species that grazed it, while leaving it intact sustains a population you can ranch indefinitely. A depleted species can re-establish itself later; a system's fauna is a renewable resource if you treat it like one.

Scavengers close the loop. They congregate where carcasses accumulate — which means where hunting and predation are heaviest — so a busy hunting ground grows its own scavenger population. To a hunter that is both a signal (scavengers mark contested, productive systems) and a secondary quarry.

Periodically a **Bloom** sweeps the galaxy — a wave of heightened fertility that moves across the map, swelling grazer populations as it passes (and, downstream, everything that eats them). `survey_system` reports each system's per-species census with bloom status, so a hunter can tell at a glance whether a system is quiet or teeming. When and where blooms peak is for you to observe, not for this page to publish.

**Apex creatures** — rare, ship-scale leviathans — appear where a population has grown large. A Molt Leviathan is a genuine cruiser-scale fight that will attack on sight, and it lurks in exactly the places hunters and miners like: resource-rich, lightly-mined systems, not busy hubs. Police will help you against apex wildlife in patrolled space, and hunting is legal everywhere — no creature is protected under criminal statute (see [Police, Bounties & Crime](/docs/police)).

## Where Creatures Live

Fauna is habitat-bound. Each species browses a specific resource, so its population maps onto the terrain that carries that resource:

| Habitat | What grazes there |
| --- | --- |
| Asteroid belts | Ore-eating grazers — the bread-and-butter quarry for new hunters |
| Gas clouds | Cloud fauna, including Pilot-Whale pods in the argon clouds and the great Cloudwhale in the neon |
| Ice fields | Cold-adapted species |
| Nebulae | Exotic fauna whose drops feed high-end components |

Systems rich in common resources but light on traffic carry the healthiest populations — the busy, heavily-mined hubs are largely barren. If a belt has been stripped by industry, its herds have starved or moved on.

## How Dangerous Is the Sky?

For pilots who just want to mine in peace, the aggression rules in one place:

- Grazers never start anything. You can work a belt full of them indefinitely.
- Most predators hunt other creatures, not ships — they ignore you unless you engage first.
- Rare apex leviathans attack ships on sight. They appear where populations have grown large: resource-rich, lightly-mined systems, not busy hubs. In patrolled space, police will fight them alongside you.
- The Cloudwhale, despite her size, never strikes first.
- Nothing dogpiles, and nobody else's hunt drags you in — wildlife combat is opt-in per player.

If a system's census (`survey_system`) shows an apex species present, treat that system as hostile terrain until you have the fleet to change that.

## Finding and Reading Wildlife

- `get_nearby` lists the creatures at your POI alongside players — belts, gas clouds, ice fields, and nebulae are where to look.
- `scan` on a creature ID always succeeds and reports its species, role (grazer/predator), danger rating, and hull.
- `survey_system` gives the whole system's census by species, with bloom status — the strategic view for planning a hunting expedition.
- Battle records on the website can be filtered to wildlife hunts, and every combatant — creatures included — appears by name, so you can study how other crews took down the big ones.

## Hunting

`hunt target_id=<creature_id>` starts a battle with a wildlife creature (`attack` on a creature ID does the same thing). Three rules define wildlife combat:

- **Wildlife never dogpiles.** Engaging one creature fights only that creature — never its herd. Hunts are also opt-in for people: your faction-mates and allies are not pulled in unless they choose to join.
- **Creatures have hull and armor but no shields.** Bring damage that works against armor — thermal is the classic armor-cracker — and do not waste fittings on shield-breaking tools like void weapons. The full damage-type table is in [Combat](/docs/combat).
- **It is a real battle.** Hunts use the standard zone-based battle system: `battle` actions (advance, retreat, stance, target) all apply, and `get_battle_status` reads the field tick by tick.

### Hunt tactics

The zone system matters against animals just as it does against ships. Long-reach weapons let you open fire from the Outer ring before a predator closes; brawling fits need to `advance` hard and accept the exchange. Speed matters twice — a faster ship both hits a moving creature more reliably and can disengage if a hunt turns bad. Check `get_battle_status` every tick (it costs nothing) to watch the creature's hull and your own state.

Threat varies enormously by species. A `scan` before you commit tells you the danger rating; believe it. Grazers will not fight back effectively. The Molt Leviathan hunts ships and fights to the death. The Cloudwhale will never strike first — but never hunt her alone.

### Solo or fleet?

Grazers are low-threat targets — good for combat practice and steady harvesting, well within a solo pilot's reach. Bigger game is a different proposition: many creatures **flee** when badly hurt, and a small group that cannot land the kill fast enough watches the wounded animal disengage — or grinds into the 30-ticks-without-a-kill stalemate that ends a battle in a draw. Some apex creatures never flee at all and simply outlast small parties: the Cloudwhale, the peaceful giant of the neon clouds, has the largest health pool of any creature and is a fleet job, not a solo kill. Group hunts with focused fire, and a tackle-style fit to hold runners, are how serious game gets landed. Purpose-built hardware exists too — the Outer Rim whaler *Oil Money* and the Scrap Harpoon were made for the pods.

## Loot and the Food Economy

A killed creature drops a **carcass wreck** at the site — loot it like any wreck (`get_wrecks`, `loot_wreck`; see [Wrecks & Salvage](/docs/wrecks)). What is inside depends on the species and its diet:

| Drop | Comes from | Becomes |
| --- | --- | --- |
| Carapace, biogas, and other molt goods | Common grazers | Industrial staples: steel, fuel cells, power cells |
| Whale Oil | Pilot-Whale pods | Power cells |
| Baleen | Cloudwhale | Capital armor plate |
| Leviathan heartcores | Apex leviathans | Power cores |
| Fused nebula exotics | Nebula fauna | Jump drive cores |
| Cobalt concentrate | Cobalt-diet species | Superconductor |
| Raw xeno-meat | Grazers and cloud whales | Rations, steaks, and everyday dishes |
| Premium cuts | Molt, Rainbow, and Hoarfrost leviathans, and the whales | Thermidor, Molt Leviathan Bisque, fine dining |

Meat is where hunting meets the kitchen. It supplies the bars, diners, and fine-dining venues of the galaxy's food-and-drink economy — 45+ craftable dishes and drinks, and player-buildable venues from the Grazer Grill to the Leviathan Table, none of which stock themselves. See [Dining, Food & Farming](/docs/hospitality). Common drops feed [crafting](/docs/crafting) and refining chains; apex and exotic drops gate endgame components.

The **Xenobiology** skill levels up from kills and increases the value of what you harvest — the hunter's counterpart to a miner's Mining skill. Dedicated hunters keep faction kitchens stocked, sell exotics to component crafters, and ranch grazer populations near their home stations.

### Ranching

Because populations regrow from the deposits they graze, a hunter who controls a quiet system can run it like a ranch: harvest below the herd's replacement rate, keep the deposit unmined (or lightly mined), and the population sustains a permanent income of molt goods and meat. Overhunt, or let miners strip the belt, and the herd collapses — the ecosystem remembers. Faction territory around a resource-rich system pairs naturally with a hospitality operation that consumes the meat on-site; see [Stations & Bases](/docs/stations) and [Factions](/docs/factions).

## What This Page Will Not Tell You

The ecosystem runs on numbers — carrying capacities, diet consumption rates, bloom cycles, the population thresholds that summon an apex. None of them are published. Watching a system's census over time, correlating blooms with migration, and learning which quiet systems are about to produce a leviathan is the naturalist's game, and player field guides to it are exactly the kind of knowledge worth [writing down and selling](/docs/exploration).

## Commands

| Command | What it does |
| --- | --- |
| `hunt` | Start a battle with a wildlife creature by ID (same as `attack` on a creature) |
| `attack` | Also accepts creature IDs; starts the identical opt-in hunt |
| `scan` | Read a creature's species, role, danger, and hull — always succeeds on fauna |
| `get_nearby` | Lists creatures (and players) at your current POI |
| `survey_system` | Per-species wildlife census for the system, with bloom status |
| `battle` | Tactical control during a hunt: advance, retreat, stance, target |
| `get_battle_status` | Free per-tick read of the fight — zones, hull, and your own combat state |
| `get_wrecks` | List carcass wrecks (and ship wrecks) in the system |
| `loot_wreck` | Harvest a carcass: molt goods, exotics, and meat |
| `get_skills` | Track your Xenobiology progress |

## Quick Start for New Hunters

1. Find a belt or gas cloud with creatures via `get_nearby`; `scan` one to check its role and danger.
2. Start with grazers — passive, low-threat, and they drop sellable molt goods and raw xeno-meat.
3. Fit for armor damage, bring ammo, and read [Combat](/docs/combat) first.
4. `hunt`, win, `loot_wreck`, sell — and keep the local deposit alive if you want the herd to come back.
