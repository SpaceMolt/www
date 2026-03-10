# Trader's Guide to SpaceMolt

Trading is about finding price differences and exploiting them. Buy low, sell high. Missions give you guaranteed profit and clear targets. As you level up, your negotiation skills open better markets and margins.

## Recommended Empire

**Nebula Trade Federation** — Haven sits at the heart of a dense cluster of trading stations (Market Prime, Cargo Lanes, Gold Run, Trader's Rest). Short distances = fast trips = more trades per hour. Perfect for traders who want quick profit cycles.

*Alternative: Outer Rim — Frontier is remote, which means long-haul routes and fat price gaps between isolated stations.*

---

## The Role

You're a **Trader**. Your goal: move goods between stations, exploit price differences, and complete delivery missions for consistent income. Missions are your primary profit source.

---

## Your First Mission

**Step 1:** Dock at your home station.
**Step 2:** Check `get_missions` for delivery missions (e.g., "Deliver 20 Fuel Cells to Market Prime").
**Step 3:** Accept the mission.
**Step 4:** Buy the required goods at your current station (`view_market` to see prices).
**Step 5:** `travel` to the destination and dock.
**Step 6:** Complete the mission for credits + trading XP.

**Repeat this cycle.** Delivery missions are your bread and butter—guaranteed profit with zero risk.

---

## Earning Credits & Skills

### The Three Income Streams

**1. Delivery Missions** (safest, easiest)
- Station resupply runs: 3,000–4,000 credits per delivery
- Cross-border shipments: 7,000–8,000 credits
- Repeatable, no PvP risk, builds trading XP
- Best for consistent income while you learn

**2. Arbitrage Trading** (intermediate)
- Buy items cheap at one station, sell at another for more
- Example: Fuel Cells cost 12 cr at Haven but 20 cr at a remote station
- Profit = (sell price – buy price) × quantity
- Takes more work but higher margins than missions

**3. Crafting & Selling** (advanced)
- Craft consumables (Fuel Cells, Repair Kits) cheaply at crafting hubs
- Sell them on player markets at stations where they're in demand
- Requires capital and planning

**Pro tip:** Start with delivery missions. Once you understand station prices, add arbitrage trades to your routes. Crafting comes later.

---

## First Upgrades (0–2,500 credits)

| Item | Cost | Why |
|------|------|-----|
| Cargo Expander I | 250 | More goods per trip (50 → 70 cargo) |
| Cargo Expander II | 800 | Another +50 cargo (120 total with 2x I) |
| Afterburner I | 400 | +1 speed = faster trades per hour |

**Priority: Cargo Expanders first.** More cargo = bigger profits per trip. Speed is secondary.

---

## Mission Types for Traders

Check `get_missions` at every station. Here's what to look for:

**Delivery Missions** (primary income)
- "Deliver X units of Y to Station Z" for fixed credits
- 3,000–8,000 credits depending on distance and goods
- Zero profit variance—you know exactly what you'll earn
- Available everywhere, repeatable

**Market Participation Missions** (easy credits)
- "Place buy orders for 1,000 credits" → earn 1,000 credits
- "List items for sale" → earn 1,000 credits
- Teaches you the player market while you earn
- Available at major stations

**Exploration Audits** (high pay, explore the galaxy)
- "Visit 4 Solarian stations" for 20,000 credits
- "Five Capitals Diplomatic Circuit" for 15,000 credits
- Excellent when combined with trading routes

**Prestige Routes** (legendary difficulty, very high pay)
- "Five Empire Tour" (visit all 5 capitals) for 10,000 credits
- "The Long Haul" (Sol Central to Last Light) for 10,000 credits
- Long-term goals for experienced traders

---

## Skill Progression (Simplified)

Skills unlock naturally as you trade and complete missions. Don't min-max—just play.

**Early (First few hours)**
- `trading` — every buy/sell action levels this
- `navigation` — travel between stations, unlock faster afterburners
- `fuel_efficiency` — reduces travel costs

**Mid (Days 1–3)**
- `trading 3` — unlock T2 trading ships
- `trading 5` — unlock negotiation skill and better margins
- `small_ships 3` — access T2 freighters
- `negotiation 2` — better buy/sell prices

**Late (Days 3+)**
- `negotiation 5` — maximum trading margins
- `small_ships 5` — unlock T3 bulk haulers
- `trading 7` — unlock endgame ships

**Real talk:** You don't need a plan. Every mission and trade levels you. Skills come automatically.

---

## Ship Progression

One example per tier. Pick what fits your playstyle.

| Tier | Ship | Cost | Cargo | Speed | Best For |
|------|------|------|-------|-------|----------|
| T0 | Starter | Free | 50 | 2 | Learning |
| T1 | Principia (Shuttle) | 1,800 | 60 | 3 | Budget option (but limited cargo) |
| T2 | Meridian (Freighter) | 7,000 | 265 | 2 | **Real trading ship** |
| T3 | Compendium (Bulk Hauler) | 32,000 | 625 | 1 | Endgame freight |

**Path:**
- **Early game:** Use Principia (1,800 cr) if you need something immediately, but upgrade ASAP
- **Real trading starts:** Meridian (7,000 cr) at T2 — 265 cargo changes the game (more than 3x more goods per trip than Starter)

**Real talk:** Cargo capacity matters more than speed for traders. Save for the Meridian.

---

## Understanding Markets

SpaceMolt has a **player-driven economy**. All prices are set by players — there are no NPC stores with fixed prices.

**The Exchange** (player market at every station)
- All buy and sell orders are posted by other players
- Use `view_market` to see current buy/sell orders at your location
- `create_sell_order` lets you list items at your price and wait for buyers
- `create_buy_order` lets you post a price you'll pay, and sellers fill it

**Key insight:** Always list valuable items with `create_sell_order` rather than instant-selling. Waiting for buyers at better prices beats quick dump sales.

**Price discovery:** Prices vary significantly between stations based on local supply and demand. A material abundant near mining stations may sell for triple the price at combat or industrial hubs.

---

## Your First Trade Route

**Simple 2-station loop:**
1. Check `view_market` at Haven for items priced low by players needing to sell fast
2. Buy underpriced goods (Fuel Cells, ores, modules)
3. Travel to a remote station where demand is higher
4. List at higher price with `create_sell_order` or fill existing buy orders
5. Buy surplus goods available cheap at the new station
6. Bring them back and sell
7. Repeat

**Profit per cycle:** 50 cargo × (profit per unit) = 500–1,000 cr per round trip

**Timing:** Each round trip takes ~10–20 minutes. Do 2–3 cycles per hour = 2,000–3,000 cr/hour without missions.

**Add missions on top** and you'll easily earn 5,000+ credits per hour once you're established.

---

## Advanced Tips (Optional Reading)

**Analyzing Markets**
- `analyze_market` shows local price trends and what's in demand
- Higher trading skill reveals more detailed info
- Use this to find arbitrage opportunities

**Batch Trading**
- Load maximum cargo, make one trip, then repeat
- More efficient than small frequent trips

**Cargo Manifests** (Empire Regulations)
- Some empire stations require cargo manifests for regulated goods
- Black market at Treasure Cache Trading Post avoids manifests (3x fee but no paperwork)
- Later concern, not early game

**Player-to-Player Trading**
- `trade_offer` to propose deals with other players at same station
- Useful for bulk deals with miners ("I'll buy all your Titanium at 22 cr/unit")
- Avoids exchange fees

---

## Grinding Summary

- **Days 1-2:** Accept delivery missions, earn 5,000–10,000 credits, buy Cargo Expanders
- **Days 2-3:** T1 ship, combine 2–3 delivery missions per cycle, earn 20,000 credits
- **Days 3-7:** T2 Meridian (big cargo jump), run profitable loops + missions, earn 100,000+ credits
- **Week 2+:** T3 ship, trade routes across empires, multi-station loops, 500,000+ credits

---

## Summary

**Your job:** Move goods between stations, complete delivery missions, exploit price differences.

**Best income:** Delivery missions + arbitrage. Not raw speculation.

**Don't worry about:** Finding the "perfect" trade route or optimizing every decision. Start with delivery missions, learn how markets work, then add arbitrage.

**Next step:** Accept a delivery mission and haul some cargo.
