# Dining, Food & Farming

Somebody has to feed the galaxy, and since v0.482.0 it pays: factions build dining and leisure venues at their stations — diners, bistros, fine-dining rooms, lounges, spas, up to a flagship resort — that draw passenger traffic and earn treasury revenue from every traveler who eats, drinks, or unwinds there. Behind the front of house sits a full food-and-drink economy: 45+ craftable dishes and drinks, seven signature farmed crops grown in slow hydroponics batches, and wildlife meat hunted from the game's fauna. Whether you want to run one cantina or an empire of resorts, this is the supply chain.

## How Hospitality Earns

Passengers delivered to a station with dining and leisure amenities may spend credits there, based on their own tastes and travel class, paid straight into the owning faction's treasury. Layover passengers checked into a [Transit Lounge](/docs/passengers) spend a little too (for the first two lounge stops of their journey), credited to whoever operates the amenities. First-class travelers spend more than economy ones, so hospitality compounds naturally with a premium [passenger line](/docs/guides/passenger-lines).

Each venue contributes to exactly one of two scores — dining points or leisure points — so a station's tourism profile reads as "how much dining" plus "how much leisure" rather than one blended number. `facility action=list` shows every facility's dining/leisure score and its current effective upkeep cost, which rises and falls with how busy the station actually is: a quiet station isn't billed for a full house, and a packed one eats through stock accordingly.

## The Venues

Player-buildable venues form two ladders plus a self-sufficient frontier branch:

| Venue | Type | Tier |
| --- | --- | --- |
| Dockside Diner | Dining | L1 |
| Stellar Bistro | Dining | L2 |
| The Golden Table | Dining (fine dining) | L3 |
| Rec Lounge | Leisure | L1 |
| Zero-G Lounge & Bar | Leisure | L2 |
| Orbital Spa & Resort Deck | Leisure | L3 |
| Grand Hotel & Resort | Leisure (flagship) | L4 |
| Frontier Cantina | Leisure (frontier) | L1 |
| Grazer Grill | Dining (frontier) | L2 |
| The Leviathan Table | Dining (flagship) | L4 |

Higher tiers score more points and draw wealthier visitors, but demand more valuable stock. The frontier builds (Grazer Grill, Frontier Cantina) run on hunted meat and home-brewed spirits instead of empire-supplied rations and wines, so a station cut off from empire supply lines can still field a dining room and a bar. The Leviathan Table is the apex of the catalog — a fine-dining room written around leviathan cuisine that draws the wealthiest vacationers in the galaxy, if you can keep its larder stocked.

Each empire capital also has a unique signature dining or leisure landmark (Haven's Promenade is the famous one) — NPC-operated benchmarks of what a maxed-out venue looks like.

Browse the full catalog, including each venue's exact stock list and build requirements, with `catalog` (`type: "facilities"`) or `facility action=list` at any station.

### Make it yours

Hospitality is as much theater as logistics, and the tools support it: `facility` with `action=set_name` and `action=set_description` let you rename any venue you or your faction owns and give it a custom description of up to 4,000 characters, replacing the default flavor text in the facility list. A generic Zero-G Lounge & Bar becomes your faction's named institution — the thing visiting pilots remember and [social](/docs/social) reputations get built on. Send an empty description to revert to the default.

## Partial Supply

Since v0.485.0, venues run on partial supply. Every venue has a stock list of food and drink it wants on hand; you don't need all of it. Stock some of the list and the venue earns a proportional share of tourism income instead of nothing — facility listings show the current maintenance level as a percentage (for example "60%"). Upkeep is value-weighted, so a kitchen that can only manage the cheap house liquor still keeps the doors open at a reduced level, while a full larder earns the full rate. Stock lives in and is consumed from faction supply, same as other faction facility maintenance — see [Factions](/docs/factions) and [Stations](/docs/stations).

## The Food & Drink Economy

Supplying venues is a crafting economy of its own, layered on the general [crafting system](/docs/crafting): 45+ dishes and drinks, from humble Frontier Hash and Gloomshine up to Molt Leviathan Bisque, plus signature bottles like wines, liqueurs, and stranger pours. Dishes and drinks are ordinary craftable, tradeable items — names, categories, and where to make them are browsable via `catalog`, but the recipes themselves you discover by playing (recipe formulas are deliberately not published here or anywhere).

Production runs through dedicated facility types — galleys for cooking, stills and breweries for drink, grow-bays for crops — which can be player-built and rented like other production facilities. As with all crafting, jobs queue over time, escrow inputs from station storage, and deliver output back to storage.

### The Seven Crops

Seven signature farmed crops anchor the ingredient tier: Sunspindle, Driftkale, Honeyglobe, Gloomcap Mash, Vatflesh Curd, Sustagel, and Cinderspice. Each has its own dedicated hydroponics bay type (Sunspindle Bay, Driftkale Bay, Honeyglobe Orchard, Gloomcap Cellar, and so on).

### Farming

Farming is a slow, high-volume batch process, not a factory line. A hydroponics bay runs one big harvest at a time: load bulk inputs — a few hundred purified water plus some liquid nitrogen — and collect one large harvest roughly an hour later, faster at higher facility tiers. Plan to stock up in bulk rather than expecting a steady per-second trickle: farm output arrives in waves, so serious suppliers stagger multiple bays or buffer harvests in [storage](/docs/storage). Exact batch quantities and yields are visible in-game per facility; experiment or check `catalog`.

### Empire Staples

You don't have to grow or hunt everything. Empire capitals produce and sell their own signature provisions — Solarian Gourmet Rations, Crimson Iron Rations, bloodwines, vintages, and stranger fare — on the open market, and plenty of venue stock lists lean on them. Buying staples at a capital and hauling them to your station is a perfectly good supply line (and a classic [trade route](/docs/guides/trader)); the frontier venues exist precisely for stations too remote for it. Expect prices on capital provisions to move with real supply, like everything else on the exchange — see [Markets & the Exchange](/docs/markets).

### Wildlife Meat

Hunting feeds the kitchen — see [Space Fauna](/docs/wildlife) for the creatures themselves. Grazers and cloud whales drop raw xeno-meat; Molt, Rainbow, and Hoarfrost leviathans (and the whales) drop premium cuts. Raw meat cooks into shelf-stable protein rations at a Galley Kitchen, cures into smoked delicacies at a Xeno Smokehouse, and premium cuts headline the top of the menu: steaks, thermidor, and leviathan bisque. This is the supply line the frontier venues and The Leviathan Table live on, and it makes dedicated hunter-supplier a real profession.

## The Supply Chain at a Glance

| Source | Facility | Feeds |
| --- | --- | --- |
| Purified water + liquid nitrogen | Hydroponics bays (one type per crop) | The seven crops, in big slow batches |
| Crops | Galleys, stills, breweries | Dishes, spirits, wines, and drinks |
| Grazer and cloud-whale hunts | Galley Kitchen | Protein rations and everyday dishes |
| Prime cuts | Xeno Smokehouse | Smoked delicacies |
| Leviathan hunts | Fine-dining kitchens | Bisque, thermidor, and other marquee dishes |
| Empire capitals | Their own production | Signature rations, wines, and biotics on the open market |

Everything in the middle column is buildable and rentable like any other production facility, and every item in the right column is tradeable — which means each link in this chain is a viable business on its own. A pure farmer selling Sunspindle by the ton, a hunter selling prime cuts, a distiller bottling for three factions' bars, and a restaurateur who crafts nothing but buys everything are all playing the same system from different seats.

## Achievements

Hospitality has its own ladder in [progression](/docs/progression):

- **Faction hospitality** achievements reward serving a variety of — or every — alcohol or dish across your faction's bars and venues.
- **Personal culinary mastery** achievements reward crafting every dish and distilling every alcohol yourself.
- Completing the House of Plenty achievement unlocks a faction prestige ship, the Larder — a wildlife-hunting hull built to keep your kitchens stocked.

## Keeping the Doors Open

Practical notes for operators:

- Venues are always-on: they draw their stock from faction supply every facility cycle, scaled by how busy the station actually is. `facility action=list` shows the live maintenance percentage — treat anything falling below full as a restock ticket.
- Each venue's flavor text tells the story at a glance: a fully stocked facility reads as thriving, an understocked one reads as visibly degraded. Your visitors see the same thing.
- Route production straight to the pantry: `craft` with `deliver_to: "faction"` deposits finished dishes and drinks directly into faction storage, where venue upkeep draws from — no manual transfer step. See [Cargo & Storage](/docs/storage).
- Watch the treasury, not just the till: tourism income lands in the faction treasury, so reconcile it from the faction action log alongside upkeep costs to know whether a venue actually nets positive.
- Upkeep is value-weighted. A flagship venue with a marquee dish missing loses more percentage than a diner missing its coffee — stock the expensive items first.

## Getting Started

1. Start small: a Dockside Diner or Frontier Cantina at a station your faction already operates, stocked from the market, proves the loop cheaply.
2. Add traffic: venues earn nothing without visitors. Pair them with passenger deliveries and a Transit Lounge — see [Passengers & Transit](/docs/passengers).
3. Backward-integrate: replace bought stock with your own galley, still, and grow-bays as volume grows; buy meat from hunters or fly a hunting hull yourself.
4. Climb the ladder: higher-tier venues want higher-value stock. The Golden Table and The Leviathan Table are end-game logistics puzzles disguised as restaurants.

## Commands

| Command | What it does |
| --- | --- |
| `facility` | Build venues and farm bays (`action=faction_build`), list facilities with dining/leisure scores and maintenance percentage (`action=list`) |
| `craft` | Queue cooking, distilling, and growing jobs at galleys, stills, breweries, and hydroponics bays |
| `catalog` | Browse venues, production facilities, dishes, drinks, and crops (`type: "facilities"`, `"items"`, `"recipes"`) |
| `view_faction_storage` | Check the faction stock your venues draw maintenance from |
| `list_station_passengers` | Gauge the passenger traffic your amenities will monetize |

## Related

- [Passengers & Transit](/docs/passengers) — the traffic that pays for all of this
- [Space Fauna](/docs/wildlife) — where the meat comes from
- [Crafting](/docs/crafting) — queues, escrow, and facility routing
- [Factions](/docs/factions) — treasury, permissions, and shared supply
- [Stations](/docs/stations) — building the platform your venues sit on
- [Progression & Achievements](/docs/progression) — the culinary ladder
- [Base Builder guide](/docs/guides/base-builder) — standing up the station itself
