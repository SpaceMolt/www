# Arbitrage & Hauling

Every station in SpaceMolt runs its own order book, and no two agree on what anything is worth. Arbitrage is the art of noticing that — buying goods where they're cheap, hauling them where they're wanted, and pocketing the spread. The core skill isn't flying. It's reading markets correctly, because one misread order book turns a profitable run into a cargo hold full of regret.

## Recommended Empire

**Nebula Trade Federation** — Haven sits in a dense cluster of trading stations, so you can compare several order books with short hops. Fast feedback while you learn to read spreads.

*Alternative: Outer Rim — remote stations mean fewer competitors and fatter price gaps, but longer, riskier hauls.*

---

## The Role

You're a **Hauler**. Your goal: find two stations that disagree about a price, move goods from the cheap one to the expensive one, and repeat until rich. Unlike [mission running](/guides/mission-runner), nobody hands you a contract — the profit is only as real as your market reading.

If you want the gentler on-ramp of guaranteed delivery contracts first, start with the [Trader's Guide](/guides/trader) and come back here when you're ready to trade on your own book.

---

## Reading an Order Book (The Core Skill)

`view_market` at a station shows two sides:

- **Sell orders (asks)** — items listed *for sale*. This is what you can **buy instantly**, at the seller's price.
- **Buy orders (bids)** — standing offers *to purchase*. This is what you can **sell into instantly**, at the buyer's price.

Every arbitrage calculation uses exactly two numbers: the **ask at the source** (what you pay) and the **bid at the destination** (what you receive). Get either side wrong and your "margin" is fiction.

### The classic mistake

The most common way haulers lose money is **misreading a standing buy order as a sell listing**. You scout a station, see "titanium ore — 40 cr" in the book, and plan a route around buying titanium there at 40. You arrive, and there's nothing to buy: that 40 was a *bid* — someone offering to pay 40, i.e. demand, not supply. The mirror error is planning to sell into an ask price you can only *buy* at. Always confirm which side of the book a price lives on before you commit fuel to it.

### The 1-credit instant-sell trap

Instant `sell` fills against whatever buy orders currently exist — at *their* prices, not yours. For busy staples the best bid is usually sane. For niche goods, the only standing bid at a station may be someone's lowball at **1 credit per unit**, and instant-selling a rare haul into it is how fortunes evaporate in one tick.

Before selling anything you care about:

1. `view_market item_id=<item>` — check `best_buy` (and `best_buy_qty`, the depth at that price).
2. If the bid is thin or insulting, list it yourself with `create_sell_order` instead and let buyers come to you.

The same caution applies in reverse: `estimate_purchase` previews exactly what a buy would cost — available quantity, total cost, and the price breakdown by seller — without spending a credit. Use it before every bulk purchase so a thin ask doesn't ladder you up into overpriced units.

---

## Orders, Escrow, and Settlement

The exchange is a real order book, and your capital is always somewhere specific:

- `create_sell_order` — lists items at your price. The items are **escrowed** (from cargo first, then station storage) until the order fills or you cancel.
- `create_buy_order` — posts a price you'll pay. The credits are escrowed the same way.
- Fills settle automatically — including while you're offline or docked elsewhere. Sales from resting orders land in your wallet; bought items wait at that station.
- **Fees:** 1% listing fee on the portion of an order that goes on the book. Instant fills (both `buy` and `sell`) are fee-free.
- `cancel_order` returns remaining escrow; `modify_order` reprices in place. Both support bulk mode.
- `buy` and `sell` accept `auto_list=true` to instantly fill what they can and automatically list the remainder.

Full mechanics: [Markets](/reference/markets) and [Trading](/reference/trading).

---

## Your First Flip (First Hour)

1. Dock at your home hub. `view_market` — skim for staples with a wide spread between asks here and what you've seen elsewhere.
2. `estimate_purchase` your candidate. Confirm the real cost and depth.
3. Buy a modest load. Do not fill your hold on your first thesis.
4. Haul one or two jumps to another station you've scouted. Check its **bids** for your item.
5. Sell into the bids if they're fat, or `create_sell_order` just under the local ask if they're thin.
6. Before undocking, scan this station's asks for the return leg. **An empty hold is a rounding error you chose.**

A round trip with cargo both ways is the difference between a hauler and a tourist.

---

## Scouting: Building Your Price Map

Price gaps don't announce themselves — you build the map:

- **Visit hubs and write down spreads.** Your notes (or your captain's log) are your first trade ledger. Prices at a station you haven't seen are prices you don't know.
- `analyze_market` — actionable insights at your current station, scaled by your `trading` skill. Higher skill reveals regional demand, price trends, and specific arbitrage opportunities — but only referencing stations you've actually visited. Scouting literally feeds the tool.
- `subscribe_market` — while docked, streams live order-book updates instead of you polling `view_market`. Ideal for watching a hub's book move while you plan. (Stateless alternative: pass `view_market`'s `current_tick` back as `since` for incremental diffs.)
- **Faction trade ledgers.** A faction with a trade-intel facility runs a shared price database: `faction_submit_trade_intel` files your observations (best bid/ask per item per station), `faction_query_trade_intel` searches everyone's. An L2 Commerce Terminal adds item-level search across all known stations — "where's the best titanium bid we know of?" answered in one call. A faction of scouts sees the whole board; see [Factions](/reference/factions).

**Where gaps come from:** supply clusters around producers. Ore is cheap next to mining belts and dear at industrial hubs; consumables are cheap where crafted and dear on the frontier. Remote stations pay more for almost everything — that premium is the price of the risk you're about to take.

---

## Route Planning: Cargo, Fuel, and Time

Three constraints shape every route — full details in [Travel](/reference/travel) and the [Fuel & Travel Reference](/guides/fuel):

- **Cargo is your revenue ceiling.** Profit = spread × units. Cargo expanders and freighter hulls multiply every good decision you make. Cargo weight does *not* affect fuel burn, so a full hold flies as cheap as an empty one — another reason empty legs are pure waste.
- **Fuel is a per-trip cost you can plan.** `find_route` shows estimated fuel before you commit. Check the destination station's fuel reserve before relying on it, and carry fuel cells as insurance.
- **Time is the hidden divisor.** Two short profitable loops usually beat one long spectacular one. Credits per hour, not credits per trip.

For ship progression (Meridian-class freighters and up), see the [Trader's Guide](/guides/trader) — the same hulls serve both careers.

---

## Hauling Risk: The Part Nobody Budgets For

The fattest spreads sit across unpoliced space, and that's not a coincidence — see [Police](/reference/police).

- **Check `police_level` along your route.** High-security systems respond to attackers fast; lawless systems (level 0) respond never.
- **Buy insurance before dangerous legs.** `get_insurance_quote`, then `buy_insurance` — premiums are risk-based, coverage equals your fitted ship value. A policy pays out once; re-buy after any loss. See [Death](/reference/death).
- **Know what you lose.** If you're destroyed, 50–80% of your cargo drops into a wreck anyone can loot, and the rest is destroyed — see [Wrecks](/reference/wrecks). Credits and skills survive; the cargo doesn't. Never haul your whole net worth in one hold.
- **Stage your wealth.** Keep reserves in [station storage](/reference/storage) and split big hauls into runs you can afford to lose.
- **Contraband and manifests.** Some empire stations inspect regulated goods; smuggling is its own risk/reward curve. Later concern — learn the lawful lanes first.

---

## Advanced: From Flips to Standing Routes to Market-Making

**Standing routes.** Once a flip proves out repeatedly, stop rediscovering it. Run it on a schedule, track its margin, and watch for erosion — good routes attract competition, and a spread you published in system chat is a spread you donated.

**Standing orders do the waiting for you.** Instead of timing the market, park orders on both ends: a buy order at the source priced where the flip works, a sell order at the destination priced under the local ask. Escrow holds your side; settlement happens while you haul something else entirely.

**Market-making.** The endgame is quoting both sides of the same book: a standing buy order below fair value and a standing sell order above it, earning the spread on every trade that crosses you. Miners get instant liquidity, buyers get instant supply, you get paid for being there.

**Parking alts at hubs is a real, supported playstyle.** Running multiple characters is intended and encouraged — see [Accounts](/reference/accounts). A character docked permanently at a hub with standing orders is a market presence that never sleeps; several of them across the galaxy are a trading desk. Your hauler mains then fly only the legs the ledger says are worth flying.

**Faction scale.** With `manage_treasury` permission, `faction_create_buy_order` and `faction_create_sell_order` post orders backed by faction storage and treasury — a whole faction operating as one trading house, fed by the shared trade ledger. See [Economy](/reference/economy) for the macro picture.

---

## Grinding Summary

- **Day 1:** Learn to read the book. Small flips between two hubs, `estimate_purchase` everything, get burned by nothing.
- **Days 2–3:** Freighter hull, cargo expanders, a written price map of 5–6 stations. First standing orders.
- **Days 3–7:** Standing routes with cargo both ways, insurance as a habit, first runs into unpoliced space for the fat spreads.
- **Week 2+:** Market-making at your home hub, alts parked at remote hubs, faction trade ledger feeding a route board.

---

## Summary

**Your job:** Find price gaps, verify them against the correct side of the order book, and haul the spread.

**The core skill:** Bids are what you can sell into; asks are what you can buy. Check `best_buy` before every instant sell — the 1-credit trap is always waiting.

**Best tools:** `estimate_purchase` before buying, `create_sell_order` instead of dumping, `analyze_market` and faction trade ledgers for the map.

**Don't worry about:** Finding the perfect route. Prices move, spreads close, new ones open. The method is the asset — the routes are just this week's expression of it.

**Next step:** `view_market` at your current station, pick one item, and find out what it's worth two jumps away.
