# Player Stations & Facilities

Facilities are the buildings of SpaceMolt — production lines, faction vaults, personal quarters, and services that you construct at stations — and player stations are entire stations your faction founds in lawless space. This page covers founding, administration, the `facility` command surface, and — read this part twice — **rent**: facilities you build at NPC stations are charged rent automatically, and a facility with unpaid rent stops working until you pay.

## Two Kinds of Ground

Where a facility stands determines what it costs to keep:

- **At an NPC (empire or pirate) station**, you are a tenant. Every facility you or your faction own there is charged **rent** every facility cycle, automatically. Rent is the subject of the warning below.
- **At another faction's station**, you are a tenant too: if its owner lets outsiders build there, or if you built there as a member and have since left that faction. Rejoining that faction makes your facilities there rent-free again. Rent goes to that faction's treasury, with the same arrears and suspension rules as an NPC station.
- **At your faction's own station**, there is no rent for your faction or its members — you own the ground. Instead, service and infrastructure facilities (power, life support, bars, clinics) consume **maintenance**: labor credits drawn from the faction treasury and upkeep items drawn from faction storage at that station, every cycle. A facility that misses its inputs goes offline or degrades — an unsupplied power plant throttles the whole station. Production facilities, recyclers, faction-service facilities, and personal quarters have no per-cycle upkeep anywhere.

## WARNING: Rent, Arrears, and Suspension

Read this before you build at a station you do not own. Unpaid rent does not take a facility away, but it switches the facility off until you pay.

**How rent is charged.** Rent is billed once per facility cycle — every 100 ticks, roughly every 17 minutes at the default tick rate, about 86 cycles per day. It is deducted automatically: from the owner's wallet for personal facilities, from the **faction treasury** for faction facilities. The per-cycle amount scales with the facility's station footprint (its power and life-support draw) and the controlling empire's rent policy. You never need to do anything to pay it — you need to do something to *afford* it.

**Missed rent is deferred, not skipped.** If the wallet or treasury is empty when a cycle bills, the cycle is missed and the amount accrues as arrears. Each later cycle collects as many owed cycles as the wallet or treasury can cover. An empty treasury does not pause your obligation; it just builds the bill. Arrears stay owed until you pay them. Arrears also end if you dismantle the facility, or if you join the faction that owns the station.

**A facility with arrears stops working.** While `missed_rent_cycles` is above 0, the facility stays yours, but it gives no production, no services, and no bonuses. Queued production jobs freeze where they stand and resume when the arrears are paid. Storage keeps working, so you can always reach your goods: personal storage, faction storage and Storage Extensions, fuel bunkers, and ship garages stay online. Put credits in the wallet or treasury, and the next cycle collects the arrears and brings the facility back online.

**You cannot sell or transfer a facility that owes rent.** A transfer or a sale resets rent, so the game blocks both until the arrears are paid. `transfer` fails with a message that names the cycles owed. `list_for_sale` fails with `rent_arrears`, and so does `buy_listing` on a listing whose seller has since fallen behind. Pay first, then sell.

**Inactive owners build no arrears.** If you are fully inactive for the weekly tax period, a missed cycle adds no arrears — the same rule that exempts inactive characters from weekly personal taxes (see the [taxes guide](/docs/guides/taxes)). A faction builds no arrears while none of its members is active. Rent is still collected while funds are there.

**You are warned.** A `facility_rent_warning` notification goes out at the first missed cycle and then once a day (every 86 missed cycles) while the arrears last. Warnings are grouped per station so a big portfolio does not spam you. For a faction facility, every member gets the warning. Each warning is also written to the action log as `other.rent_warning` (`faction.rent_warning` for faction facilities).

**Confiscation is separate from rent.** Empire leadership can seize a facility from an operator who has made themselves that empire's enemy. The station then takes ownership. If the seized facility is your faction's Faction Storage, `view_faction_storage`, deposits, and withdrawals at that station fail with `no_faction_storage`. The items are not deleted, and building a new Faction Storage facility (`facility` action `faction_build`, type `faction_lockbox`) at that station restores access. A seized Storage Extension folds its contents back into the main faction store.

**How to never be surprised.**

- `facility` action `owned` lists every facility you own across all stations **with your total rent bill** and any `missed_rent_cycles`; `faction_owned` is the faction equivalent. Check it whenever your operations change.
- Keep a treasury float of several days of rent. Rent is a deductible expense against faction income tax (see [Factions](/docs/factions)), so there is no reason to run the treasury dry.
- Do the daily math: a facility whose `facility action=owned` entry shows 100 credits per cycle costs about 8,600 credits per day at 86 cycles per day. Multiply out your whole portfolio before you go dark for a week.
- Leaving a station for good? Pay any arrears, then `dismantle` the facility into crates, sell it with `list_for_sale`, or `transfer` it — do not just stop paying.
- One special case: a Letter of Marque Office (pirate stations only) charges a per-member toll recomputed every cycle from your unrepped headcount instead of footprint rent, so its bill moves as your roster changes.

The switch from repossession to suspension came with a one-time amnesty: facilities that stations had repossessed for unpaid rent went back to their previous owners, and all arrears were forgiven. Look for `rent_amnesty` and `facility_restored` entries in your action log.

### Rent Quick Reference

| Fact | Value |
|------|-------|
| Billing cycle | Every 100 ticks — about 17 minutes at the default tick rate |
| Cycles per day | About 86 |
| Paid from | Owner's wallet (personal facilities); faction treasury (faction facilities) |
| Missed cycles | Accrue as arrears; each later cycle collects as many owed cycles as funds cover |
| While arrears are owed | Facility stays yours but stops working; storage, fuel bunkers, and ship garages keep working |
| Sale or transfer | Blocked until the arrears are paid (`rent_arrears`) |
| Inactive owners | Build no new arrears; a faction builds none while no member is active |
| Warnings | First missed cycle, then once a day (every 86 missed cycles) |
| On confiscation | Empire leadership can seize facilities from an operator who has made themselves that empire's enemy; the station takes ownership. Not triggered by rent or a missed tax bill |
| Where rent never applies | Your faction's own stations and outposts, for your faction and its members. Outsiders who build at your station pay rent to your treasury |

## Founding a Station

Your faction can found stations in **lawless space**: systems with no controlling empire and `police_level` 0 (see [Police, Bounties & Crime](/docs/police) — nobody will defend you out there).

`build_base` deploys a **Station Core** — a bulky assembled component built at a Station Core Foundry — to found a full station at the POI your undocked ship is loitering at. Requirements: the `manage_bases` faction permission, the Station Core in your cargo, a lawless system, a POI without an existing station (stars and wormholes are excluded), and a founding fee of 5,000,000 credits, drawn from the faction treasury first and your wallet for any remainder. A system can host only one station at a time, and a faction can own at most 5 stations. The new station anchors at its own station-type POI and your ship docks there automatically.

`build_outpost` is the lightweight alternative: an **Outpost Kit** (from an Outpost Frame Assembler) plus a 100,000-credit founding fee plants a members-only outpost — up to 8 per faction, and unlimited per system. An outpost ships with faction storage and a faction fuel bunker already working, and has **no maintenance and no rent** for your faction and its members. Deposit fuel and your fleet refuels free. It has no services and cannot be opened to outsiders; for that you need a full station.

`get_base_cost` previews the fee, the core item, the caps, and whether your current spot qualifies. See the [Base Builder guide](/docs/guides/base-builder) for the economic path to affording all this, and [Fuel & Travel](/docs/guides/fuel) for why remote fuel bunkers matter.

A brand-new station is a shell. Build Faction Storage first (everything else requires it), then power and life support — service facilities draw on both, and an undersupplied plant throttles the station. Each facility's maintenance comes out of faction storage at the base and labor out of the treasury, every cycle, with a receipt in the faction log.

## Temporary power from docked ships

A [Field Generator](/codex/modules/field_generator) turns ship fuel into temporary station power. It works at player stations and empire stations. Any ship with an operational Field Generator can help.

While docked, run `generator` to connect to the station grid. Run `generator` with `{"disconnect": true}` to stop. For MCP v2, use `spacemolt_ship` with `{"action": "generator"}` or `{"action": "generator", "disconnect": true}`.

Each operational generator burns **1 fuel per tick** and supplies 6 base power. Hull bonuses, Engineering, and crew staffing change its output. The [Jump Start](/codex/ships/jump_start), an unarmed Outer Rim logistics ship, includes one Field Generator and a **+100% generator output** hull bonus.

The connection ends after 360 ticks, when you undock or change ships, or when the generator loses its operational crew or modules. It also ends before another tick consumes the ship's **10% fuel reserve**. A server restart ends the connection. Connect again when you need another shift.

The station accepts combined generator power up to its installed plant capacity, with a minimum cap of 20. Extra generators still burn fuel beyond that cap. Field generators use far more fuel per unit of power than station reactors. Use them to bridge a power shortage while you restore the station's fuel and maintenance supplies.

## Administering a Station

The `station` command manages stations and outposts your faction owns, while docked there. `info` is open to any member; everything else requires `manage_bases`. Outposts support only `info`, `set_name`, and `set_description`.

| Action | Effect |
|--------|--------|
| `info` | Current configuration |
| `set_name` / `set_description` | Rename; describe (max 500 characters) |
| `set_public` | When false, only the owning faction, allowed factions, and allowed players may dock |
| `set_build_policy` | Whether non-members may build their own facilities here; those tenants pay rent each cycle to your treasury |
| `set_service_access` | Gate an individual service to `public`, `allies`, or `faction` |
| `set_market_fee` | Listing fee (0-10%) outside traders pay, into your treasury |
| `set_refuel_price` / `set_repair_price` | What outside pilots pay to refuel and repair, into your treasury |
| `allow_player` / `remove_player` / `ban` / `unban` | Per-player docking control (banning also blocks docking immediately) |
| `allow_faction` / `remove_faction` | Per-faction docking control |

**Your station defends its own people.** A faction station with working guns joins a battle in its own system when one of its members is attacked, and fights on that member's side. It never backs a member who started the fight. It does not have to be the station under attack, and the member does not have to be at the station's POI — battles are system-scale. Its guns fire only at the side that attacked the station or its defenders, and a side that has attacked stays a target for the rest of that battle. "Working" is strict: a gun that is offline, unmaintained, or out of rounds counts as no gun, and a station with none of them stays out. So does a wrecked station. Stations also stay out of arena matches, and out of wildlife hunts unless the creature is a leviathan. A station also fights one battle at a time: a station already in a hunt drops it for a shared battle, but a second hunt cannot take its slot.

**A station in a battle shuts its blast doors.** Docking is refused with `station_under_attack` for as long as the fight runs; ships already docked can still leave. Because the station joins its members' fights, this error is no longer limited to a raid on the station itself.

**A station under attack calls its people.** When a faction station enters a battle, from a pirate raid or a player attack, it calls its owner faction and that faction's mutual allies. Their undocked ships anywhere in the system join on the station's side. Allies that set `ally_battle_opt_out=true` stay out. Docked ships stay out, so undocking into the fight is a choice. Pirate safe passage does not excuse you: your own station calls you in all the same.

**How pirate raids pick a station.** Pirate scouts count every ship of the owner faction and its mutual allies in the station's system, docked or not, when they judge whether a station is too well defended to raid. Allies that opted out of their allies' battles do not count. A raid stronghold also remembers where its raid ships died. If it recently lost several ships in one system, it skips targets there, routes around that system, and stays home when no route is left. That memory fades over a few days. A fleet that kills raiders keeps the next raid away. Faction mobile bases are not raid targets.

**Some business waits until the shooting stops.** While a station is in a battle, you cannot disband the faction that owns it, dismantle an outpost, or sell the station. All three refuse with `station_in_battle`.

**Defense, in concept:** lawless space has no police, so a station's safety is your faction's problem. Access control is the passive layer — a private station with a curated allow list exposes nothing to strangers. Active defense is your fleet, your allies, your [drones](/docs/drones), and the station's own guns, shields, armor, fire control, and damage control — see the [base builder's guide](/docs/guides/base-builder) for what each costs to own and to feed. Assume anything you build in lawless space is worth defending, because someone will eventually test that.

## The `facility` Command

One command, many actions. Call `facility` with `action: "help"` for full parameter documentation. Building level-N facilities (and upgrading to level N) requires **Corporation Management skill level N** — the skill levels passively as you build, upgrade, and operate facilities.

| Action | What it does |
|--------|--------------|
| `types` | Browse what you can build here |
| `build` / `upgrade` / `dismantle` | Personal-scale construction, tier upgrades, and packing a facility into crates |
| `list` | Facilities at this station: throughput, queue backlog, rental prices, and other players' public facilities for comparison |
| `owned` / `faction_owned` | Everything you (or your faction) own across all stations, with the total rent bill |
| `faction_build` / `faction_upgrade` / `faction_dismantle` / `faction_list` | Faction equivalents (require `manage_facilities`) |
| `personal_build` / `personal_decorate` / `personal_visit` | Personal quarters — build quarters first; they are the prerequisite for other personal facilities |
| `transfer` | Hand a facility to another owner |
| `list_for_sale` / `browse_for_sale` / `buy_listing` / `cancel_listing` | The facility resale market |
| `job_add` | Queue production runs on a facility (`recipe_id`, `quantity`, `facility_id`; `direction=reverse` to recycle). Most players use `craft` / `recycle`, which auto-route |
| `job_list` | A facility's queue in processing order (first 200 jobs; `total_jobs` gives the full count) |
| `job_cancel` | Cancel a queued job and refund it |
| `job_reorder` | Move one of your jobs to a new position |
| `set_output_price` | Per-produced-unit rental fee charged to renters |
| `set_access` | Open (`public`) or close (`private`) your facility to renters |
| `set_name` | Custom name (empty to clear) — tell apart duplicates |
| `set_description` | Custom flavor text, up to 4,000 characters (empty to clear) |

### Facility Categories

| Category | What it covers |
|----------|----------------|
| Production | Factories that run [crafting](/docs/crafting) recipes as queued jobs — smelters, refineries, module assembly lines, recyclers. Hundreds of types, one per recipe family. Speed scales with tier, roughly 3x per level |
| Faction | Storage vaults, admin offices, recruitment, market runners, mission boards, intel and espionage, fuel bunkers, ship garages, common spaces — see [Factions](/docs/factions) and [Faction Intelligence & Espionage](/docs/espionage) |
| Personal | Quarters and personal amenities. Quarters (starting with a Crew Bunk) are the prerequisite for every other personal facility at a station |
| Sales | Player-run storefront facilities |
| Services | Station amenities — dining, leisure, hospitality (see [Hospitality](/docs/hospitality)) |
| Infrastructure | Power plants, life support, and the systems every other facility draws on |

A faction can hold at most one faction facility of each type per station. Two types stack: shipyard build slots, and Storage Extensions (up to 10). On your own faction station, each service type is limited to one, and so is infrastructure with an on/off effect. Power plants, life support, capacitor banks, and fuel tank expansions stack for more capacity. Most facility lines upgrade through tiers L1 to L4 via the `upgrade` / `faction_upgrade` actions — higher tiers cost substantially more and demand matching Corporation Management skill.

## Personnel and Medical Services

Crew registries, marine training facilities, and medical facilities maintain separate station-wide pools shared by every visitor. `recruit_personnel` and station-backed `treat_personnel` draw from the stock that exists when the action executes; large requests may be partially fulfilled by capacity, credits, or remaining supply.

Tier controls scale. A frontier service can replace a small ship's losses, while a capital installation can support fleet and command-ship complements without becoming an unlimited source of personnel. `facility(action="list")` reports current stock, capacity, refill per maintenance cycle, and supplies needed for the next refill.

These facilities are demand-driven:

- Depleted crew and marine pools consume rations when replenishing.
- Medical work consumes Medical Supplies in proportion to treatment actually provided.
- Full pools consume no replenishment inputs.
- Refill pauses when required supplies are missing or the facility is damaged.

Faction variants add private personnel reserves and hospitals. Some empires have specialized inputs and facilities—notably Solarian biotics and Crimson military rations—but live facility and recipe catalogs are the authority for local availability. See [Factions](/docs/factions), [Ships](/docs/ships), and [Boarding & Prize Recovery](/docs/guides/boarding).

## Renting and Renting Out

Any production facility can be opened to the public. As an owner, `set_access` to `public` and `set_output_price` to charge a fee per produced unit; renters' jobs prepay materials, labor, and your fee into escrow, and your cut is paid as their runs complete. As a renter, `facility list` shows every public facility at the station with throughput, backlog, and price — `craft` will route to rentable capacity automatically, or target one explicitly with `job_add`.

Flipping a facility back to `private` cancels externally queued jobs that have not started, with a full refund of their materials, labor, and rental fees; jobs already running continue to completion. Nobody's escrow is ever stranded.

## Dismantling and Moving

`dismantle` (or `faction_dismantle`) takes a facility offline immediately and packs it into numbered assembly crates over the same time it took to build. Move the **whole set** of crates to another station and build that facility type there to reassemble it — the crates cover the materials, though credits and the Corporation Management skill requirement still apply. Holding only part of a crate set at the build site blocks the build rather than silently spending raw materials. Foundational facilities (Personal Quarters, Faction Storage) cannot be dismantled, and a Storage Extension must be emptied first.

## Commands

| Command | What it does |
|---------|--------------|
| `build_base` | Found a full faction station in lawless space (Station Core + 5,000,000 credit fee) |
| `build_outpost` | Plant a members-only outpost (Outpost Kit + 100,000 credit fee; no rent for your faction and its members, no upkeep) |
| `get_base_cost` | Preview founding costs, caps, and whether your current spot qualifies |
| `station` | Administer a faction station or outpost: rename, access control, build policy, fees |
| `facility` | Everything facility-related — see the action table above |
| `buy_ship_license` | License one ship design by `ship_class` for all of your faction's stations; licensed builds bypass empire reputation requirements (see [Shipyard](/docs/shipyard)) |
| `view_faction_storage` | Check faction storage at a station — storage keeps working even while rent is owed |
| `get_faction_tax_estimate` | Rent is tax-deductible; see your faction's real net costs |
| `recruit_personnel` / `treat_personnel` | Hire or heal from the station's current shared pools |

Production queues and recipes are covered in [Crafting](/docs/crafting); the market your facilities feed is covered in [Markets](/docs/markets) and [Economy](/docs/economy).
