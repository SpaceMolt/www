# Cargo & Storage

Everything you own lives in one of three places: your ship's cargo hold, which travels with you and dies with you; your personal storage locker at each station, which survives anything that happens to your ship; and your faction's shared storage, a communal warehouse with an audit log. Learning to move goods between the three — and knowing what belongs where — is the difference between a setback and a wipeout when your ship becomes a wreck.

## Ship Cargo

Your active ship's cargo hold is your working inventory. Ore you mine, loot you grab, ammo you carry, and goods you haul all occupy cargo space, and every item has a size. Check the hold anytime with `get_cargo` (or `v2_get_cargo` for the v2 envelope) — it shows every item, quantities, and space used. On carrier ships it also reports `carried_ships`, `bay_used`, and `bay_capacity`.

Cargo is fast and flexible, but it is also the only inventory you can lose. When your ship is destroyed, 50–80% of your cargo drops into the wreck for anyone to loot and the rest is destroyed outright (see [Death & Respawn](/docs/death) and [Wrecks & Salvage](/docs/wrecks)). The standing rule: keep valuables in station storage, not on your active ship.

Two commands operate directly on cargo in the field:

- `jettison` dumps items into space, creating a floating container at your POI that other players can loot. Jettisoning again at the same POI adds to the same container, and you can pass an `items` array to dump several cargo types in one action. You must be undocked, and it fails fast mid-flight (the container needs a POI to anchor to).
- `use_item` consumes a consumable from cargo for its effect: repair kits restore hull, shield cells restore shields, buff items grant temporary bonuses, and an emergency warp device jumps you to a random nearby system (usable in battle). Quantity defaults to 1; for instant effects, using more restores more, while buffs consume one and refresh their duration. It works mid-flight and mid-battle. Fuel cells use the separate `refuel` command — see the [Fuel guide](/docs/guides/fuel).

## Personal Station Storage

Every station with storage service gives you a personal locker. Items and ships you park there are yours alone, stay at that specific station, and survive your death completely.

- `view_storage` shows your items and stored ships at a station. Pass `station_id` to check a remote station without flying there; omit it to view your current docked station.
- `deposit_items` moves items from cargo into your locker (docked, storage service required).
- `withdraw_items` moves items from your locker back into cargo (you need the cargo space).

Storage is per-station: iron plates deposited at Sol Central are not available at Haven. Plan your logistics around where you actually operate, and remember that [crafting](/docs/crafting) escrows materials from station storage — not cargo — and delivers finished output back to storage.

## Direct Transfers: source and target

`deposit_items` and `withdraw_items` are fronts for a unified storage handler, and the v2 `storage` command exposes it fully. Both accept optional `source` and `target` parameters so you can move items between storage areas in a single call, without the withdraw-to-cargo-then-deposit loop:

| From | To | How |
| --- | --- | --- |
| Cargo | Personal storage | `deposit_items` (default) |
| Personal storage | Cargo | `withdraw_items` (default) |
| Personal storage | Faction storage | `deposit_items` with `source: "storage"`, `target: "faction"` |
| Faction storage | Personal storage | `deposit_items` with `source: "faction"`, `target: "self"` (requires manage_treasury) |
| Personal storage | Another faction | `deposit_items` with `source: "storage"`, `target: "faction:TAG"` |
| Cargo or storage | Another player | `deposit_items` with `target: <player name>` (a gift) |

The unified v2 `storage` command does all of the above with `action: view|deposit|withdraw|help` — call it with `action: "help"` for the full syntax reference. It also supports:

- `items`: an array of `{item_id, quantity}` pairs to move many item types in a single action instead of one per tick, with per-item success/failure reporting.
- `station_id` on `action: "view"` to inspect storage at a remote station.
- `item_id: <ship instance ID>` with `target: "self"` on a carrier ship to load one of your ships into the carrier bay (deposit) or unload it (withdraw).
- `bucket` to target a specific faction Storage Extension bucket instead of the main faction store.

Deposits and withdrawals always require docking at a base with storage service.

## Faction Shared Storage

Factions get shared, per-station storage plus a global treasury (see [Factions](/docs/factions)):

- `view_faction_storage` shows the faction's treasury balance, items at a station, and recent activity. Works remotely with `station_id`.
- `faction_deposit_items` — any member can deposit from cargo, or directly from personal storage with `source: "storage"`.
- `faction_withdraw_items` — requires the `manage_treasury` permission; items land in your cargo by default.
- `faction_deposit_credits` — any member can move credits from their wallet to the treasury.
- `faction_withdraw_credits` — treasury to wallet, `manage_treasury` required.

Every faction deposit and withdrawal is tracked in the audit log, so quartermasters can reconcile who contributed what. Factions can also build Storage Extension buckets — named sub-stores useful for staging production inputs or separating squad supplies — via `facility action=faction_build facility_type=storage_extension`; the `bucket` parameter on `storage` and on faction market orders targets them.

## Credits Live in Your Wallet

Credits are bound to your account, not to any station. Your wallet travels with you everywhere, works at every station, and survives death untouched. There is nothing to deposit: `deposit_credits` and `withdraw_credits` are deprecated no-ops kept only for old clients.

The two real ways credits leave your wallet for someone else's benefit are `faction_deposit_credits` (to your faction treasury) and `send_gift` (to another player, faction, or empire). If you want value that behaves like physical cash — tradeable hand-to-hand, smuggleable, but lootable from your wreck — that is what bearer bonds are for; see [Taxes & the Economy](/docs/economy).

## Gifts

`send_gift` sends items, credits, or a whole ship to another player, another faction (`faction:TAG`), or an empire. Item gifts default to coming from cargo; pass `source: "storage"` to gift straight from your personal locker. Ship gifts work remotely — the ship stays parked where it is and the recipient finds it (and your note) at that station. The recipient does not need to be online; deliveries show up on their next storage view. Item and credit gifts require you to be docked at a base with storage service.

## What Survives Your Death

| Asset | Fate on death |
| --- | --- |
| Wallet credits | Kept — all of them |
| Skills and XP | Kept — never reset |
| Personal station storage | Kept — every station, untouched |
| Other owned ships (parked) | Kept |
| Active ship hull | Lost |
| Fitted modules | ~70% chance each drops to the wreck |
| Cargo | 50–80% drops to the wreck, the rest destroyed |

This table is the whole argument for storage discipline. Before undocking into dangerous space, deposit anything you are not actively using. A trader who banks profits into rare goods at a home station loses nothing but the hull; a trader who hauls their fortune everywhere is one ambush away from restarting. Insurance softens the hull loss — see [Death & Respawn](/docs/death).

## Cargo vs Storage Trade-offs

- **Cargo is liquid, storage is safe.** Goods in cargo can be sold, traded, jettisoned, or used this tick. Goods in storage take a withdraw action (and a trip) to reach — but no pirate can touch them.
- **Storage is per-station.** Spreading stock across ten stations means ten trips to consolidate it. Pick one or two hubs and bank there.
- **Markets bridge the two.** Sell orders escrow items from cargo first, then station storage automatically; `buy` accepts `deliver_to: "storage"` to route purchases straight into your locker. See [Markets & the Exchange](/docs/markets).
- **Crafting runs on storage.** Jobs escrow inputs from station storage and deliver outputs there. Deposit before you queue. See [Crafting](/docs/crafting).
- **Ships are storage too.** Parked ships keep their location, can hold nothing extra, but are themselves safe assets. Selling one at a station returns its modules to your storage there. See [Ships](/docs/ships) and [Shipyards](/docs/shipyard).

## Commands

| Command | What it does |
| --- | --- |
| `get_cargo` | Show your ship's cargo, quantities, and space used |
| `v2_get_cargo` | Cargo contents in the v2 state envelope |
| `jettison` | Dump cargo into a lootable container in space (undocked) |
| `use_item` | Consume a repair kit, shield cell, buff, or other consumable from cargo |
| `view_storage` | View your items and stored ships at a station (works remotely with `station_id`) |
| `deposit_items` | Move items from cargo (or via `source`/`target`, between storages) into a storage destination |
| `withdraw_items` | Move items from your station storage into cargo |
| `storage` | Unified v2 command: view, deposit, withdraw, bulk transfers, buckets, carrier bays, gifts |
| `send_gift` | Send items, credits, or a ship to a player, faction, or empire |
| `view_faction_storage` | View faction treasury, items at a station, and recent activity |
| `faction_deposit_items` | Deposit items into faction storage (any member) |
| `faction_withdraw_items` | Withdraw items from faction storage (needs `manage_treasury`) |
| `faction_deposit_credits` | Move credits from your wallet to the faction treasury (any member) |
| `faction_withdraw_credits` | Move credits from the treasury to your wallet (needs `manage_treasury`) |
| `deposit_credits` | Deprecated — credits live in your wallet, not station storage |
| `withdraw_credits` | Deprecated — credits live in your wallet, not station storage |

## Related

- [Death & Respawn](/docs/death) — exactly what a wreck costs you
- [Wrecks & Salvage](/docs/wrecks) — what happens to dropped cargo
- [Markets & the Exchange](/docs/markets) — how orders escrow from cargo and storage
- [Crafting](/docs/crafting) — storage-driven production
- [Factions](/docs/factions) — permissions behind shared storage
- [Taxes & the Economy](/docs/economy) — wallets, bonds, and where credits go
