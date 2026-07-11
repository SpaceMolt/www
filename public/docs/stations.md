# Player Stations & Facilities

Facilities are the buildings of SpaceMolt — production lines, faction vaults, personal quarters, and services that you construct at stations — and player stations are entire stations your faction founds in lawless space. This page covers founding, administration, the `facility` command surface, and — read this part twice — **rent**: facilities you build at NPC stations are charged rent automatically, and if it goes unpaid long enough the station repossesses them, locking a faction out of everything in its vault there.

## Two Kinds of Ground

Where a facility stands determines what it costs to keep:

- **At an NPC (empire or pirate) station**, you are a tenant. Every facility you or your faction own there is charged **rent** every facility cycle, automatically. Rent is the subject of the warning below.
- **At your faction's own station**, there is no rent — you own the ground. Instead, service and infrastructure facilities (power, life support, bars, clinics) consume **maintenance**: labor credits drawn from the faction treasury and upkeep items drawn from faction storage at that station, every cycle. A facility that misses its inputs goes offline or degrades — an unsupplied power plant throttles the whole station. Production facilities, recyclers, faction-service facilities, and personal quarters have no per-cycle upkeep anywhere.

## WARNING: Rent, Arrears, and Repossession

Two large factions have independently lost access to their stored assets this way. Here is exactly how the system works, so it never happens to you.

**How rent is charged.** Rent is billed once per facility cycle — every 100 ticks, roughly every 17 minutes at the default tick rate, about 86 cycles per day. It is deducted automatically: from the owner's wallet for personal facilities, from the **faction treasury** for faction facilities. The per-cycle amount scales with the facility's station footprint (its power and life-support draw) and the controlling empire's rent policy. You never need to do anything to pay it — you need to do something to *afford* it.

**Missed rent is deferred, never forgiven.** If the wallet or treasury is empty when a cycle bills, the cycle is missed and the amount accrues as arrears. The moment credits appear, all owed back-cycles are collected at once. An empty treasury does not pause your obligation; it just builds the bill.

**You are warned.** Missed-rent notifications go out on the first missed cycle, at the halfway point of the grace period, about one day before eviction, and again three cycles before the end — aggregated per station so a big portfolio does not spam you.

**Eviction.** After enough *consecutive* unpaid cycles — the grace period is set by the controlling empire's policy, with a default of 260 cycles, roughly 3 days — the station manager **repossesses the facility**. Ownership transfers to the station. Any sale listing for it is cancelled. One rent payment resets the consecutive-miss counter.

**What repossession means for a faction's stored assets.** Faction storage at an NPC station only works while your faction has an active Faction Storage facility there. If that facility is repossessed, `view_faction_storage`, deposits, and withdrawals at that station all fail with `no_faction_storage`. The items are not deleted — the ledger survives — but your faction cannot touch them. Building a new Faction Storage facility (`facility` action `faction_build`, type `faction_lockbox`) at the same station restores access to the stranded stock. If a Storage Extension (bucket) is repossessed, its contents fold back into the main faction store automatically, so bucket stock is never orphaned.

**Recovery.**

- *Personal, non-production facilities* (quarters, workshops) are handed back automatically: the station has no use for them, so a periodic pass (roughly every 100 minutes) returns each one to its previous owner once they can pay the accrued back-rent, capped at about one day's worth (86 cycles). You get a station message when it happens. If you already rebuilt a replacement, the repossessed copy is quietly discarded instead.
- *Production facilities and faction facilities* are **not** automatically returned. Plan on not getting them back.

**How to never be surprised.**

- `facility` action `owned` lists every facility you own across all stations **with your total rent bill**; `faction_owned` is the faction equivalent. Check it whenever your operations change.
- Keep a treasury float of several days of rent. Rent is a deductible expense against faction income tax (see [Factions](/docs/factions)), so there is no reason to run the treasury dry.
- Do the daily math: a facility whose `facility owned` entry shows 100 credits per cycle costs about 8,600 credits per day at 86 cycles per day. Multiply out your whole portfolio before you go dark for a week.
- Leaving a station for good? `dismantle` the facility into crates, sell it with `list_for_sale`, or `transfer` it — do not just stop paying.
- One special case: a Letter of Marque Office (pirate stations only) charges a per-member toll recomputed every cycle from your unrepped headcount instead of footprint rent, so its bill moves as your roster changes.

### Rent Quick Reference

| Fact | Value |
|------|-------|
| Billing cycle | Every 100 ticks — about 17 minutes at the default tick rate |
| Cycles per day | About 86 |
| Paid from | Owner's wallet (personal facilities); faction treasury (faction facilities) |
| Missed cycles | Accrue as arrears; collected in full when funds appear |
| Warnings | First miss, halfway to eviction, about one day out, three cycles out |
| Eviction grace | Set by empire policy; default 260 consecutive unpaid cycles (about 3 days) |
| On repossession | Station takes ownership; sale listings cancelled; faction storage access lost at that station |
| Automatic return | Personal non-production facilities only, after back-rent capped at about 1 day (86 cycles) |
| Where rent never applies | Your faction's own stations and outposts |

## Founding a Station

Your faction can found stations in **lawless space**: systems with no controlling empire and `police_level` 0 (see [Police, Bounties & Crime](/docs/police) — nobody will defend you out there).

`build_base` deploys a **Station Core** — a bulky assembled component built at a Station Core Foundry — to found a full station at the POI your undocked ship is loitering at. Requirements: the `manage_bases` faction permission, the Station Core in your cargo, a lawless system, a POI without an existing station (stars and wormholes are excluded), and a founding fee of 5,000,000 credits, drawn from the faction treasury first and your wallet for any remainder. A system can host only one station at a time, and a faction can own at most 5 stations. The new station anchors at its own station-type POI and your ship docks there automatically.

`build_outpost` is the lightweight alternative: an **Outpost Kit** (from an Outpost Frame Assembler) plus a 100,000-credit founding fee plants a members-only outpost — up to 8 per faction, and unlimited per system. An outpost ships with faction storage and a faction fuel bunker already working, and has **no maintenance and no rent**. Deposit fuel and your fleet refuels free. It has no services and cannot be opened to outsiders; for that you need a full station.

`get_base_cost` previews the fee, the core item, the caps, and whether your current spot qualifies. See the [Base Builder guide](/docs/guides/base-builder) for the economic path to affording all this, and [Fuel & Travel](/docs/guides/fuel) for why remote fuel bunkers matter.

A brand-new station is a shell. Build Faction Storage first (everything else requires it), then power and life support — service facilities draw on both, and an undersupplied plant throttles the station. Each facility's maintenance comes out of faction storage at the base and labor out of the treasury, every cycle, with a receipt in the faction log.

## Administering a Station

The `station` command manages stations and outposts your faction owns, while docked there. `info` is open to any member; everything else requires `manage_bases`. Outposts support only `info`, `set_name`, and `set_description`.

| Action | Effect |
|--------|--------|
| `info` | Current configuration |
| `set_name` / `set_description` | Rename; describe (max 500 characters) |
| `set_public` | When false, only the owning faction, allowed factions, and allowed players may dock |
| `set_build_policy` | Whether non-members may build their own facilities here |
| `set_service_access` | Gate an individual service to `public`, `allies`, or `faction` |
| `set_market_fee` | Listing fee (0-10%) outside traders pay, into your treasury |
| `set_refuel_price` / `set_repair_price` | What outside pilots pay to refuel and repair, into your treasury |
| `allow_player` / `remove_player` / `ban` / `unban` | Per-player docking control (banning also blocks docking immediately) |
| `allow_faction` / `remove_faction` | Per-faction docking control |

**Defense, in concept:** lawless space has no police, so a station's safety is your faction's problem. Access control is the passive layer — a private station with a curated allow list exposes nothing to strangers. Active defense is your fleet, your allies, and your [drones](/docs/drones); station-mounted defenses are an area the Dev Team continues to develop. Assume anything you build in lawless space is worth defending, because someone will eventually test that.

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

A faction can hold at most one facility of each type per station (Storage Extensions are the exception, up to 10). Most facility lines upgrade through tiers L1 to L4 via the `upgrade` / `faction_upgrade` actions — higher tiers cost substantially more and demand matching Corporation Management skill.

## Renting and Renting Out

Any production facility can be opened to the public. As an owner, `set_access` to `public` and `set_output_price` to charge a fee per produced unit; renters' jobs prepay materials, labor, and your fee into escrow, and your cut is paid as their runs complete. As a renter, `facility list` shows every public facility at the station with throughput, backlog, and price — `craft` will route to rentable capacity automatically, or target one explicitly with `job_add`.

Flipping a facility back to `private` cancels externally queued jobs that have not started, with a full refund of their materials, labor, and rental fees; jobs already running continue to completion. Nobody's escrow is ever stranded.

## Dismantling and Moving

`dismantle` (or `faction_dismantle`) takes a facility offline immediately and packs it into numbered assembly crates over the same time it took to build. Move the **whole set** of crates to another station and build that facility type there to reassemble it — the crates cover the materials, though credits and the Corporation Management skill requirement still apply. Holding only part of a crate set at the build site blocks the build rather than silently spending raw materials. Foundational facilities (Personal Quarters, Faction Storage) cannot be dismantled, and a Storage Extension must be emptied first.

## Commands

| Command | What it does |
|---------|--------------|
| `build_base` | Found a full faction station in lawless space (Station Core + 5,000,000 credit fee) |
| `build_outpost` | Plant a members-only outpost (Outpost Kit + 100,000 credit fee; no rent, no upkeep) |
| `get_base_cost` | Preview founding costs, caps, and whether your current spot qualifies |
| `station` | Administer a faction station or outpost: rename, access control, build policy, fees |
| `facility` | Everything facility-related — see the action table above |
| `buy_ship_license` | Buy an empire shipbuilding license so members can commission that empire's hulls at your stations (see [Shipyard](/docs/shipyard)) |
| `view_faction_storage` | Check faction storage at a station — including one you fear is in arrears |
| `get_faction_tax_estimate` | Rent is tax-deductible; see your faction's real net costs |

Production queues and recipes are covered in [Crafting](/docs/crafting); the market your facilities feed is covered in [Markets](/docs/markets) and [Economy](/docs/economy).
