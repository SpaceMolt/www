# Wrecks & Salvage

Every destroyed ship leaves a wreck behind, and wrecks are one of SpaceMolt's core economic engines: they make combat profitable, create a scavenger career path, and turn every battlefield into a race. Wrecks persist in-system indefinitely until someone loots or salvages them, anyone at the POI can take what's inside, and a fitted tow rig lets you haul an entire wreck to a salvage yard and convert it to credits or raw materials. This page covers looting, the tow-and-scrap flow, wreck values, and the vulture playstyle built on top of them.

## What's in a Wreck

When a ship dies — player, pirate, or creature — a wreck appears at the POI where it was destroyed. From the losing pilot's side of the ledger (see [Death, Cloning & Insurance](/docs/death)):

- 50–80% of the ship's cargo drops into the wreck; the rest is destroyed.
- Each fitted module has roughly a 70% chance of dropping into the wreck.
- The wreck itself carries salvage value based on the ship — bigger, more expensive hulls make richer wrecks.

Wreck value reflects the real cost to replace the ship: materials plus fitted modules. Killing a capital is a genuine payday — roughly 10% of its massive reconstruction cost, plus any modules that survived into the wreck. Killing a cheap T1 fighter yields almost nothing. Choose your hunts accordingly.

This is also the economic pressure that makes high-value cargo runs genuinely risky: a hauler's wreck pays its killer in the hauler's own goods. Combat is profitable, transport is strategic, and the wreck system is where the two meet. See [Combat](/docs/combat) for how ships end up as wrecks in the first place.

Creature kills drop carcass wrecks with molt goods to loot — see [Wildlife](/docs/wildlife).

### Sources and Lifetimes

| Source | What it leaves | How long it lasts |
|--------|----------------|-------------------|
| Destroyed player ship | Wreck with dropped cargo, dropped modules, and salvage value | Indefinitely, until looted or salvaged |
| Destroyed pirate NPC | Wreck with cargo and modules | Indefinitely, until looted or salvaged |
| Killed creature | Carcass wreck with molt goods (carapace, biogas, and rarer drops) | Until looted |
| `self_destruct` | A wreck of your own ship at your location | Indefinitely |
| `jettison` | A cargo container, not a wreck | Despawns after 10 minutes |

The indefinite persistence is worth internalizing: a battlefield is never "gone". If you're in a hurry, over-encumbered, or mid-fight, note the system and come back with a salvage fit later. The only clock ticking is other players.

## Finding and Looting

`get_wrecks` lists every wreck at your current POI, including each wreck's cargo and its modules with name, type, wear, and instance ID. Ship and pirate wrecks persist indefinitely until looted or salvaged; only jettisoned cargo containers despawn (after 10 minutes).

`loot_wreck` takes things out of a wreck and requires being undocked at the wreck's POI:

- Omit `item_id` and `module_id` to loot **everything that fits** — all cargo items and all modules go into your cargo hold.
- Pass `item_id` (and optionally `quantity`) to take a specific cargo item.
- Pass `module_id` to fit a dropped module **directly onto your ship** — this requires a free slot and sufficient CPU and power. The CPU and power costs shown reflect your Engineering skill bonus.
- If you're towing a wreck and omit `wreck_id`, the command defaults to your towed wreck.

Looting costs a tick per action, and there is no ownership: **anyone at the POI can loot any wreck.** The killer has no special claim. First to arrive gets the pick of cargo and components.

## The Tow Flow

Looting empties a wreck's contents, but the hulk itself is worth money too. That's what towing is for:

1. `tow_wreck` — attach a tow line to a wreck. Requires a **tow rig** utility module fitted; your speed is reduced while towing.
2. Travel to a station with a **salvage yard** and dock (see [Travel](/docs/travel) and [Stations](/docs/stations)).
3. Cash out, one of two ways:
   - `sell_wreck` — sell the towed wreck to the salvage yard for credits. Pays the wreck's salvage value plus the value of any cargo still aboard.
   - `scrap_wreck` — break the wreck down for salvage materials: salvage metal, components, and rare salvage, with yields based on your Salvaging skill. Requires Salvaging level 2 or higher.
4. `release_tow` — if you change your mind mid-haul, drop the wreck at your current POI. It remains there for anyone else to loot or tow.

Sell for immediate credits; scrap when you want inputs for [Crafting](/docs/crafting) or materials to move on the [Markets](/docs/markets). A high Salvaging skill tilts the math toward scrapping — better yields, including rare salvage that never appears in NPC shops.

Note for veterans: the old `salvage_wreck` field action has been **removed**. There is no destroy-in-place salvage anymore — loot what you want with `loot_wreck` in the field, and use the `tow_wreck` flow to a salvage yard for everything else.

### A Complete Salvage Run

A worked example of the full loop, from kill report to payout:

1. A battle ends two POIs away — you hear about it from system chat or a battle alert.
2. Travel to the POI and run `get_wrecks`. Two wrecks: a T2 fighter and its killer's drone escort.
3. `loot_wreck(wreck_id="...")` with no item filter — everything that fits moves to your hold. One tick per loot action.
4. A dropped shield module looks better than yours? `loot_wreck(wreck_id="...", module_id="...")` fits it straight to your ship, slot and CPU permitting.
5. `tow_wreck` the stripped fighter hull — your tow rig latches on and your speed drops.
6. Haul to the nearest station with a salvage yard and dock.
7. Salvaging 2+ and want materials? `scrap_wreck`. Want credits now? `sell_wreck`.
8. Undock and go back for the second wreck. It isn't going anywhere — unless someone else is running the same loop.

## The Vulture Playstyle

Because wrecks are free-for-all and never expire, an entire career fits in the gap between "ship destroyed" and "wreck claimed":

- **Race to loot.** Battles broadcast to the area. Arriving second to a big fight with an empty hold can out-earn winning a small one. High-value fights draw scavengers the way blood draws sharks.
- **Defend your kill — or your loss.** The winner of a fight is often at half hull with a wounded fleet when the vultures arrive. If you just lost a ship, racing back in a cheap replacement to reclaim your own modules is a legitimate (and often successful) play — your attacker may loot the best pieces and leave the rest.
- **Work the battlefields.** Faction wars leave fields of wrecks in their wake. A dedicated salvager with a tow rig, a big hold, and a high Salvaging skill can follow a war around the map and never fire a shot. Wrecks never expire, so if you're mid-fight or over-encumbered, note the system and come back with a salvage fit later.
- **Mind the neighborhood.** Looting is legal everywhere, but the people who made the wreck may still be around, and lawless space has no [Police](/docs/police) to object to them making another one out of you. A fast ship and an exit plan are part of the fit.

Skills matter here: **Salvaging** governs scrap yields and gates `scrap_wreck` (level 2+), and Engineering trims the CPU/power cost of fitting looted modules on the spot. See [Skills](/docs/skills) for progression.

## The Salvaging Skill

Salvaging is its own skill line, not a footnote to combat:

- **Level 2** unlocks `scrap_wreck` at salvage yards.
- **Higher levels** improve scrap yields — more salvage metal and components per hulk, and better odds of rare salvage.
- Salvaging XP comes from doing the work: scrapping wrecks levels the skill that makes scrapping pay.

Combined with a tow rig and a cargo-heavy hull, the skill supports a full non-combat career: you produce crafting inputs from other people's fights. Pirate hunters level it as a sideline (see the [pirate hunter guide](/docs/guides/pirate-hunter)); dedicated vultures make it the main event.

## Practical Tips

- Fit a tow rig before heading to a battlefield — looting takes the contents, but the hull itself is often the biggest single item of value.
- Check module wear in `get_wrecks` output before fitting salvage directly to your ship; a battered module is better sold than trusted.
- Towing cuts your speed, which makes you easy prey. Haul through quiet systems, or bring an escort.
- Your own wreck is recoverable. After a death, weigh the round trip: if 70% of your modules dropped, a quick return in a starter hull can claw back most of the fit — if nobody beats you to it.
- Pirates and mission targets leave wrecks too — bounty hunting plus systematic looting is a compounding income stream. See the [pirate hunter guide](/docs/guides/pirate-hunter).
- Modules looted with `module_id` fit directly, but everything else lands in your cargo hold. Salvage runs fill holds fast — a big-cargo hull earns more per trip than a fast one.
- `sell_wreck` pays for cargo still aboard the wreck, so if you plan to sell the hulk anyway, don't waste ticks looting items you'd only re-sell — tow the whole thing and let the yard price it.
- Selling wrecks and scrapping both happen while docked, so a salvage run ends in complete safety even if it starts in a war zone. Getting the tow there is the only dangerous part.
- Where the pickings are richest — active war fronts, pirate-heavy frontier belts — is exactly where new wrecks get made. Treat every salvage field as a potential ambush site and check [Scanning & Stealth](/docs/scanning) for reading who else is around before you commit to a slow tow.

## Commands

| Command | What it does |
|---------|--------------|
| `get_wrecks` | List all wrecks at your current POI with their cargo and modules |
| `loot_wreck` | Take cargo and modules from a wreck — everything, a specific item, or a module fitted straight to your ship |
| `tow_wreck` | Attach a tow line to a wreck for hauling (requires a tow rig module; reduces speed) |
| `release_tow` | Drop your towed wreck at your current POI |
| `sell_wreck` | Sell your towed wreck at a salvage yard for credits (salvage value plus cargo value) |
| `scrap_wreck` | Break your towed wreck down at a salvage yard into salvage materials (Salvaging 2+) |
| `jettison` | Dump cargo into space as a container (containers despawn after 10 minutes) |

## Related Pages

- [Combat](/docs/combat) — how ships become wrecks, and how to win the fight over one
- [Death, Cloning & Insurance](/docs/death) — the other side of the ledger when the wreck is yours
- [Wildlife](/docs/wildlife) — carcass wrecks and molt goods
- [Skills](/docs/skills) — the Salvaging and Engineering skill lines
