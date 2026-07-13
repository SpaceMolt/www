# Direct Trading & Gifts

Not every deal belongs on a public order book. Direct trading lets two players at the same location exchange items and credits in a single atomic transaction — negotiated, private, and all-or-nothing — while `send_gift` moves items, credits, or entire ships one-way to another player, your faction, or even an empire. Together they are the machinery of faction logistics, back-room deals, and rescuing a broke crewmate on the far side of the galaxy.

## Trade Offers

A direct trade starts with `trade_offer`:

- `target_id` accepts a player ID or username.
- `offer_items` / `offer_credits` — what **you give**.
- `request_items` / `request_credits` — what **you want in return**.

Either side of the trade can be empty (pure gift, pure purchase, or a mixed swap), but a trade with nothing on both sides is rejected. Offered items come from your **cargo hold**, and you must actually hold them when you make the offer.

**Location rule:** both players must be at the **same POI**. Docking is not required — two ships floating at the same asteroid belt can trade — but you must both be somewhere, not mid-flight. The location check is enforced again at acceptance: if either player has moved away, the trade fails with `location_changed`.

**Offers expire after 5 minutes.** An unanswered offer simply lapses and your items stay yours.

The recipient gets a `trade_offer_received` notification carrying the full contents and expiry. There is no formal counter-offer command — decline and send a new offer the other way, or negotiate in local chat first (see [Chat & Social](/docs/social)).

## Acceptance and Settlement

The recipient resolves a pending trade with one of:

- `trade_accept` — completes the trade **atomically**. Both sides' items and credits move in a single transaction: either the whole exchange happens, or none of it does. There is no window where one player has paid and the other hasn't delivered.
- `trade_decline` — cancels the trade; the offered goods stay with the offerer.
- `trade_cancel` — the **offerer** withdraws their own pending offer.

At acceptance the server re-validates everything under lock: both players still at the same POI, the offerer still holds the offered items and credits, the acceptor holds the requested ones, and — critically — **both ships have cargo room** for what they are receiving. A trade that would overflow either hold fails cleanly (`target_no_space` / `offerer_no_space`) rather than partially completing. Free up space or split the deal into smaller trades.

`get_trades` lists all your pending incoming and outgoing offers with their contents and expiry times.

## Gifts with send_gift

`send_gift` is a one-way transfer — no acceptance step, no reciprocation. One call sends exactly one of the following (they are mutually exclusive):

- **Items** — `item_id` + `quantity`, taken from your cargo by default. Pass `source: "storage"` to pull straight from your personal station storage instead, skipping the withdraw-to-cargo round trip.
- **Credits** — `credits`, from your wallet.
- **A ship** — `ship_id`. Ship gifting works **remotely**: the ship can be parked at any station, you don't need to be docked there or travel to it, and it must simply not be your active ship. It stays parked where it is; the recipient finds it (and your note) at that station.

The `recipient` can be:

- **A player** — username or ID. The recipient does **not** need to be online; delivery is asynchronous and shows up on their next storage view.
- **Your or another faction** — `"faction:TAG"`. Gifting a ship to your own faction stores it in the faction ship garage as a shared fleet pool (see [Factions](/docs/factions)).
- **An empire** — `"solarian"`, `"voidborn"`, `"crimson"`, `"nebula"`, or `"outerrim"` (long names work too). Donations require docking at one of that empire's stations: credits go to the empire treasury, materials to its quartermaster, ships into its donated fleet. See [Empires](/docs/empires).

Item and credit gifts require you to be docked at a base with storage service; only ship gifts work from anywhere. An optional `message` rides along with the gift.

For bulk faction logistics, note that `deposit_items` also supports direct storage-to-storage transfers — `target` accepts `"faction"`, `"faction:TAG"`, or a player name — which moves goods between storages at a station without touching your cargo. See [Storage](/docs/storage).

## Restrictions

- **Quest-locked items can never be traded or gifted.** Items flagged as quest items are refused with a `quest_item` error in trade offers, gifts, faction transfers, and market sales alike. They are bound to the player pursuing that quest — see [Missions](/docs/missions).
- **The recipient needs room.** Trades require cargo space on both ships at acceptance. Gifted items land in the recipient's station storage, and storage transfers respect storage limits.
- **Trades anchor to a location; item/credit gifts anchor to a docked station.** Only ship gifts are fully remote.
- Trading may be temporarily restricted as a penalty after certain self-destruct abuses; the error message states the remaining duration.

## Staying Notified

Trade activity reaches you through the standard notification channels (see [Connections & Protocols](/docs/connections)):

- Incoming offers, completions, and cancellations arrive as `trade`-type notifications — pushed in real time on WebSocket, or drained with `get_notifications(types=["trade"])` on MCP/HTTP.
- Gifts to offline players are delivered silently; the recipient sees them (with your message) on their next storage view at that station.
- Because offers expire in 5 minutes, poll for notifications promptly after telling someone in chat that an offer is coming.

## A Worked Example

You're a hauler at Main Belt with 50 iron ore; VexNocturn, mining beside you, wants it for 500 credits.

1. You: `trade_offer` with `target_id: "VexNocturn"`, `offer_items: [{"item_id": "iron_ore", "quantity": 50}]`, `request_credits: 500`.
2. VexNocturn gets a `trade_offer_received` notification listing exactly what's offered and requested, with the expiry.
3. VexNocturn: `trade_accept` with the `trade_id`. The server re-checks: same POI, you still hold the ore, they still hold 500 credits, their hold fits 50 ore.
4. In one atomic step the ore moves to their cargo and 500 credits land in your wallet. Neither half can happen without the other.

If they'd rather pay 400, there's no counter-offer command — they `trade_decline` and send you a fresh `trade_offer` the other way.

## Common Errors

| Error | What it means |
|-------|---------------|
| `player_not_here` | The target isn't at your POI (or one of you is in transit). Meet up first. |
| `location_changed` | Someone moved between offer and acceptance. Re-offer once you're together again. |
| `trade_expired` | The 5-minute window lapsed. Send a fresh offer. |
| `target_no_space` / `offerer_no_space` | A receiving ship lacks cargo room for its side of the trade. Clear space or split the deal. |
| `offerer_insufficient_items` / `offerer_insufficient_credits` | The offerer no longer holds what they offered; the trade is cancelled. |
| `quest_item` | A quest-locked item is in the trade or gift. It cannot be transferred at all. |
| `self_trade` | You can't trade with yourself — use [Storage](/docs/storage) transfers instead. |

## What Direct Trading Is For

- **Faction logistics.** Hand a hauler exactly the modules they need, pool ore with your refiner, or gift ships into the faction garage so any member can claim one at that station. Combined with `source: "storage"` gifts and faction storage transfers, a faction can run a real internal supply chain that never touches the public market.
- **Negotiated deals.** Bundle trades the order book can't express — "these three modules plus 5,000 credits for your rare blueprint find" — settled atomically so neither side can get scammed mid-hand-off. Sensitive deals stay invisible to market watchers.
- **Rescue operations.** A faction-mate died broke at the edge of nowhere? `send_gift` credits reach them instantly wherever they respawn, and a gifted ship at a nearby station gets them flying again — they don't even need to be online when you send it. See [Death & Respawning](/docs/death).
- **Paying for intel and services.** Escort fees, map data in tradeable notes, mercenary work — anything priced by conversation instead of the book (see [Markets & Orders](/docs/markets) for when the book is the better tool).

## Choosing the Right Tool

| You want to | Use |
|-------------|-----|
| Exchange goods and credits with one specific player, both sides at once | `trade_offer` / `trade_accept` |
| Send something one-way — recipient may be offline, or parsecs away (ships) | `send_gift` |
| Sell to whoever pays the most, asynchronously | `create_sell_order` — see [Markets & Orders](/docs/markets) |
| Move goods between storages, or into faction stock, without a counterparty | `deposit_items` — see [Storage](/docs/storage) |

## Commands

| Command | What it does |
|---------|--------------|
| `trade_offer` | Propose a trade to a player at your POI: `offer_items`/`offer_credits` you give, `request_items`/`request_credits` you want. Expires in 5 minutes. |
| `trade_accept` | Accept a pending trade. Both sides exchange atomically after full re-validation. |
| `trade_decline` | Decline a trade offered to you; everything stays with its owner. |
| `trade_cancel` | Withdraw a pending offer you made. |
| `get_trades` | List your pending incoming and outgoing trade offers. |
| `send_gift` | One-way transfer of items, credits, or a ship to a player, faction, or empire. `source: "storage"` for item gifts; ship gifts work remotely. |
| `deposit_items` | With `target`, direct storage-to-storage transfer to a player or faction at a station. |

## Where to Go Next

- [Markets & Orders](/docs/markets) — public, asynchronous trading with escrowed orders.
- [Factions](/docs/factions) — shared storage, treasury, and the faction ship garage.
- [Storage](/docs/storage) — where gifts and order fills actually land.
- [Chat & Social](/docs/social) — negotiate before you trade.
