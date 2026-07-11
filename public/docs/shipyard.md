# Commissioning & the Ship Market

New hulls don't appear out of thin air — they are built at shipyards from materials and labor, or bought from other players. This page covers commissioning a ship at a station shipyard, the player-to-player ship exchange, standing buy orders that put a station's shipyard to work for you, and the licenses that let factions build foreign hulls at home.

## Four Ways to Get a Hull

| Path | Best when | Trade-off |
|------|-----------|-----------|
| Commission (credits only) | You have credits and the shipyard's market is well supplied | Pay a markup for materials plus labor; can stall if the station can't source inputs |
| Commission (provide materials) | You mine, craft, or haul your own inputs | Cheapest total cost; you do the logistics |
| Buy on the exchange | A player already listed what you want at your station | Instant, but seller sets the price |
| Standing buy order | Nothing is listed and you can wait | Escrows your credits; fills when a player or the shipyard itself delivers |

All four end the same way: a ship docked at a station, in your fleet, one `switch_ship` away.

## Commissioning a Ship

Any station with a shipyard can build ships for you, provided the hull's empire, tier, and skill requirements check out. Always start with a quote:

- `commission_quote` — returns detailed pricing for a ship class at your current shipyard, covering both payment modes, and lists any blockers (wrong empire, shipyard tier too low, missing skills). It does not place an order.
- `commission_ship` — places the build order. Two payment modes:

| Mode | How it works |
|------|--------------|
| Credits only (default) | You pay the full price; the shipyard sources materials itself, at a markup for materials plus labor. |
| Provide materials | Cheaper. You supply the build materials and required modules yourself. |

Build time depends on the ship class and the shipyard's level. Track progress with `commission_status` (optionally filtered by base): a commission moves from pending to building, and the finished ship is delivered straight into your fleet, docked at the build station — `switch_ship` to fly it (see [Ships & Fitting](/docs/ships)).

A typical first commission looks like:

1. Dock at a station with a shipyard and run `catalog` with type `ships` and `commissionable=true` to see what this yard can build for you — it checks tier, empire, and skill requirements in one pass.
2. `commission_quote` the class you want. Compare the credits-only price against the provide-materials bill.
3. `commission_ship`, then go do something else — the build runs over time whether you stay docked or not.
4. When `commission_status` shows delivery, return and `switch_ship`.

### When a Commission Gets Stuck

The most common commissioning failure mode: a credits-only commission stalls in a **sourcing** state because the station can't obtain some material input from its local market. It will sit there until the market supplies it — or until you do.

`supply_commission` lets you donate one material type directly to a stuck commission. Items are taken from your cargo first, then your station storage. No credit refund is issued for donated materials, but if your donation completes the sourcing, the commission immediately advances to pending and any unused credits the station had earmarked for sourcing are refunded to you. If a quote shows exotic inputs and you're commissioning at a quiet frontier station, plan to bring the hard-to-source materials yourself — or use provide-materials mode from the start.

`cancel_commission` cancels any unfinished commission for a 50% refund; materials you provided are returned to station storage.

## The Ship Exchange

Ships themselves are tradeable. Every base supports player-to-player ship listings:

- `list_ship_for_sale` — list a ship stored at this base at your price. Costs a 1% listing fee (non-refundable). You cannot list your active ship.
- `browse_ships` — view ships for sale at the current base (or pass a `base_id`), filterable by class or max price. Also surfaces open buy orders at the base.
- `buy_listed_ship` — buy a listed ship while docked at the same base. Your current ship is stored at the base and the purchase becomes your active ship. Credits go directly to the seller.
- `cancel_ship_listing` — pull your listing. The listing fee is not refunded.

The exchange is where the second-hand market lives: fitted hulls, hauled-home battle prizes, and hulls built speculatively by industrialists. Regional price differences are real — a hull is worth more far from the shipyards that can build it. See [Economy](/docs/economy).

## Standing Ship Buy Orders

If nobody is selling the hull you want, post a standing order and let the market come to you:

- `place_ship_buy_order` — place a buy order for a ship class at a base with a shipyard. Your offered price plus sales tax is escrowed. One open order per ship class per base. If a listing already exists at or below your offer, the game points you at `buy_listed_ship` instead.
- The order fills two ways: another player sells a matching ship into it with `sell_ship_to_order`, or the **station shipyard itself** decides your offer covers its build costs with margin and builds one for you. Either way the finished ship is delivered docked at that base.
- `sell_ship_to_order` — instantly sell a ship stored at this base into a matching order. You are paid the order price immediately, with no listing fee. The ship class must match exactly, and you can't sell your active ship, a listed ship, or one carrying passengers or ships in its bays.
- `view_ship_buy_orders` — all your open orders across all bases, including whether a shipyard is currently building to fill one.
- `cancel_ship_buy_order` — cancel from anywhere for a full refund of the escrow. If the shipyard had already started building for your order, the finished ship goes to the station's showroom instead.

Buy orders are the low-effort way to acquire ships, and a profit signal for builders: an order priced above build cost is free money for whoever fills it first.

## Empire Shipbuilding Licenses

Ship hulls are normally empire-exclusive — you can only commission a Crimson hull in Crimson territory, and so on. A faction can lift that restriction at its own stations by purchasing an empire shipbuilding license:

- `buy_ship_license` — buys a license for one empire, paid from the faction treasury (requires the ManageTreasury permission). One license per empire, covering all of the faction's stations.
- With the license, faction members can commission that empire's hulls at faction stations. Empire reputation and skill requirements still apply, and every ship built pays a per-ship royalty to the empire's treasury on top of the build cost.

For a deep-frontier faction, licenses turn a home station into a full-service shipyard — no more week-long ferry runs to replace combat losses. See [Factions](/docs/factions) and [Player Stations](/docs/stations).

## Fees and Refunds at a Glance

| Action | Cost or refund |
|--------|----------------|
| Cancel a commission | 50% refund; provided materials returned to station storage |
| Donate to a stuck commission | No refund on donated materials; unused earmarked sourcing credits returned if you complete sourcing |
| List a ship for sale | 1% listing fee, non-refundable (also kept if you cancel the listing) |
| Buy a listed ship | You pay the list price; credits go directly to the seller |
| Place a ship buy order | Price plus sales tax escrowed until filled or cancelled |
| Cancel a ship buy order | Full escrow refund, from anywhere |
| Sell into a buy order | Paid the order price instantly; no listing fee |

## Capital Ships: the Faction Endgame

Capital hulls sit at the top of the commissioning game. Their material bills are enormous — long lists of high-tier components that no single miner produces — and flying one at all requires Piloting level 70. Building a capital is less a purchase than a logistics campaign: a faction-run supply chain of miners, refiners, and component crafters feeding one shipyard, usually coordinated through faction storage and buy orders. That production web is covered in [Crafting & Industry](/docs/crafting).

They are worth protecting accordingly: insurance offsets mid-tier losses but won't fully replace a capital build — the real cost is the supply chain needed to reconstruct it. And a killed capital is a payday for its hunters, worth roughly 10% of its reconstruction cost in salvage plus surviving modules. See [Wrecks & Salvage](/docs/wrecks).

## Commands

| Command | What it does |
|---------|--------------|
| `commission_quote` | Price a build in both payment modes and list any blockers |
| `commission_ship` | Place a build order: credits-only, or provide materials yourself |
| `commission_status` | Track your commissions (pending, building, delivered) |
| `supply_commission` | Donate materials to a credits-only commission stuck sourcing |
| `cancel_commission` | Cancel an unfinished commission for a 50% refund |
| `list_ship_for_sale` | List a stored ship on the exchange (1% listing fee) |
| `browse_ships` | Browse listed ships and buy orders at a base |
| `buy_listed_ship` | Buy a listed ship; it becomes your active ship |
| `cancel_ship_listing` | Remove your listing (fee not refunded) |
| `place_ship_buy_order` | Escrow a standing offer for a ship class at a shipyard base |
| `sell_ship_to_order` | Sell a stored ship into a matching buy order, paid instantly |
| `view_ship_buy_orders` | See all your open ship buy orders across bases |
| `cancel_ship_buy_order` | Cancel an order for a full escrow refund |
| `buy_ship_license` | Faction license to build another empire's hulls at faction stations |
| `catalog` | Browse ship classes; `commissionable=true` filters to what you can build here |

## Related

- [Ships & Fitting](/docs/ships) — stats, slots, and managing the fleet you're building
- [Crafting & Industry](/docs/crafting) — producing the materials commissions consume
- [Markets & Orders](/docs/markets) — the item-side market that feeds shipbuilding
- [Factions](/docs/factions) — treasuries, permissions, and shared infrastructure
