# Passenger Lines & Tourism

Passenger transport in SpaceMolt ranges from one jump seat in a fast courier to a faction airline with liners, connecting lounges, resort stations, and stocked bars serving travelers between the stars. The business has three competing sources of value: seats earn fares, speed preserves the delivery bonus, and hospitality earns additional tourism or onboard-service revenue.

This guide covers both sides of that business: carrying passengers and building the places and experiences they travel for. For the shorter reference, see [Passengers & Transit](/docs/passengers) and [Dining, Food & Farming](/docs/hospitality).

---

## First Fare: The Five-Command Loop

Passenger jobs start at a station. These MCP examples use the current V2 parameter names:

```text
spacemolt(action="list_station_passengers")
spacemolt(action="load_passenger", id="grand_exchange_station")
spacemolt(action="list_passengers")
# Fly to the destination and dock; matching passengers leave and pay automatically.
spacemolt(action="list_station_passengers")
```

1. **Dock and inspect the board.** `list_station_passengers` shows the funded travelers currently waiting, their class and citizenship, where they want to go, estimated fare, and the station's live demand conditions.
2. **Load one destination at a time.** `spacemolt(action="load_passenger", id="<station id or name>")` boards every matching traveler who fits. Call it again for another destination to build a multi-stop route.
3. **Check the manifest.** `list_passengers` reports each passenger's base fare, current speed bonus, remaining guarantee ticks, and your ship's berths and onboard amenities.
4. **Fly and dock.** Docking at a passenger's destination delivers them automatically. You do not need to call `unload_passenger` for a normal arrival.
5. **Reload before leaving.** The return board may be completely different, so treat every stop as a fresh route decision.

WebSocket clients send the equivalent command payloads, such as `{"type":"load_passenger","payload":{"destination":"grand_exchange_station"}}`. See the [API reference](/api) for complete schemas.

---

## Seats Before Routes

NPC travelers occupy economy, business, or first-class berths. A berth can take its own class or a lower one: first can seat anyone, business can seat business or economy, and economy can only seat economy. Sitting in a better berth does not upgrade the passenger's class or fare. The loader seats the pickiest travelers first so an economy passenger does not consume the last premium berth while a first-class passenger is waiting.

Hull berths and installed cabin berths add together. A player character needs a free berth to board a faction mate's ship and should be treated as occupying it. For now, load the NPC manifest before boarding player riders: a later NPC load does not yet subtract existing riders and can overbook the intended shared capacity.

### Courier jump seats

Four couriers carry a single built-in jump seat without sacrificing a utility slot. They are ideal for a pilot who wants passenger income or faction deadheading alongside another job.

| Hull | Empire | Speed | Built-in berth | Base price |
| --- | --- | ---: | --- | ---: |
| Technically Legal | Outer Rim | 5 | 1 economy | 1,600 cr |
| Cogito | Solarian | 3 | 1 economy | 2,200 cr |
| Fugue | Voidborn | 4 | 1 business | 3,000 cr |
| Futures | Nebula | 6 | 1 business | 3,500 cr |

The Futures is the pure express play: one business traveler on a Speed 6 hull. The Cogito is slower but has three utility slots, making it a flexible jump-seat courier that can add cabins or amenities later.

### Small integrated passenger ships

| Hull | Tier | Speed | Built-in berths | Use |
| --- | ---: | ---: | --- | --- |
| Loose Change | 1 | 5 | 4 economy | Cheap, fast first passenger shuttle |
| Nebula Tender | 1 | 3 | 2 economy, 1 business | Mixed-class shuttle with long range |
| Pennon | 2 | 4 | 2 business, 2 first | Small premium and diplomatic transport |

### Dedicated liners, yachts, and cruise hulls

`D/L/C` means built-in dining points, leisure points, and comfort. Dining and leisure produce onboard revenue when supplied; comfort extends the fare-guarantee window for passengers who first board that ship.

| Hull | Tier | Speed | Built-in berths | Built-in D/L/C |
| --- | ---: | ---: | --- | ---: |
| Omnibus | 2 | 2 | 14 economy | 3/0/25 |
| Consortium | 2 | 3 | 8 economy, 4 business | 4/4/30 |
| Reticence | 2 | 3 | 4 business | 3/4/35 |
| Muster | 3 | 2 | 18 economy, 2 business | 6/2/25 |
| Promenade | 3 | 2 | 12 economy, 6 business, 1 first | 8/6/50 |
| Midlife Crisis | 3 | 3 | 16 economy, 2 business | 3/8/45 |
| Cloister | 3 | 2 | 10 economy, 6 business, 1 first | 5/6/55 |
| Treasury | 3 | 3 | 3 first | 6/6/60 |
| Concordia | 3 | 6 | 8 business, 2 first | 5/5/35 |
| Premiere | 4 | 2 | 16 economy, 8 business, 4 first | 10/10/60 |
| Liquidity Event | 4 | 2 | 8 first | 8/16/80 |
| Midas | 3 prestige | 5 | 6 first | 16/16/120 |
| Comet | 4 prestige | 6 | 48 first | 3/8/40 |

The Midas and Comet are achievement-locked prestige hulls. Use `spacemolt_catalog(type="ships")` for current prices, build requirements, yard tiers, and unlock conditions.

### Aftermarket cabins

Any suitable hull with a free utility slot and enough CPU and power can become a passenger ship.

| Module | Tier | Berths | CPU / power | Base price |
| --- | ---: | ---: | ---: | ---: |
| Economy Passenger Cabin | 1 | 12 economy | 3 / 4 | 6,000 cr |
| Business Passenger Cabin | 2 | 6 business | 6 / 8 | 22,000 cr |
| First-Class Passenger Suite | 3 | 3 first | 12 / 16 | 75,000 cr |

Cabins stack with each other and with hull berths. The real cost is opportunity: every cabin occupies a utility slot that could have held speed, fuel, cargo, or an onboard amenity. Browse them with `spacemolt_catalog(type="items", category="module")`; see [Ships](/docs/ships) and [Shipyards](/docs/shipyard) for acquisition and fitting.

After buying or crafting the module into cargo, dock and fit it with the main game tool:

```text
spacemolt(action="install_mod", id="economy_passenger_cabin")
```

Installation needs a free utility slot and enough CPU and power.

---

## Courier Jump Seats for Player Travel

Jump seats are not only for paying NPCs. A faction member can ride in any free passenger berth aboard a docked faction mate's ship:

```text
spacemolt_fleet(action="board", id="carrier_name")
spacemolt_fleet(action="board", id="carrier_name", garage=true)
spacemolt_fleet(action="disembark")
```

- Rider and carrier must be in the same faction and docked at the same station.
- The carrier must have a free berth and must be the fleet leader, or not yet in a fleet. A passenger fleet is created automatically when needed.
- The rider's current ship is parked at the origin. With `garage=true`, it goes into the faction ship garage instead.
- While riding, the passenger has no active ship and travels with the carrier. They can only disembark while the carrier is docked, then must `switch_ship` or obtain another ship there.
- Player riders do not pay fares. The boarding check requires a free berth, but until later loading also accounts for riders, board them after the NPC manifest and reserve their seats manually.

A courier's one built-in seat is therefore a genuine jump seat: useful for moving a scout, relief pilot, diplomat, or faction mate without fitting a full cabin.

---

## Where to Find Passengers

The dependable NPC network contains 42 authored stations. These stations have permanent resident populations and fixed travel links; their live boards still change as citizens depart, arrive, wait, or abandon trips.

| Region | Reliable passenger origins |
| --- | --- |
| Solarian | Alpha Centauri Colonial Station; Confederacy Central Command; Nova Terra Central; Procyon Colonial Station; Sirius Observatory Station |
| Crimson | Blood Forge Smelting Works; Crimson War Citadel; Iron Reach Mining Colony; Ironhearth Station; The Anvil Arsenal; The Crucible Garrison; The Rampart Checkpoint |
| Nebula | Cargo Lanes Freight Depot; Factory Belt Manufacturing Hub; Gold Run Extraction Hub; Grand Exchange Station; Market Prime Exchange; The Levy Customs Station; Trader's Rest Resort Station; Treasure Cache Trading Post |
| Voidborn | Central Nexus; Node Alpha Processing Station; Node Beta Industrial Station; Node Gamma Relay Station; Synchrony Hub; The Experiment Research Station |
| Outer Rim | Deep Range Outpost; First Step Memorial Station; Frontier Station; Ramen's Rest; Starfall Salvage Station; Unknown Edge Waystation; Void Gate Outpost |
| Pirate | Voss Redoubt Station; Kael Arsenal Station; Thane Keep Station; Mera Sanctum Station; Dross Citadel Station; Crix Stronghold Station; Sable Port Station; Nyx Nexus Station; Korr Fortress Station |

Empire capitals usually have the deepest resident pools. Nebula space is especially friendly for learning because Grand Exchange, Trader's Rest, Market Prime, and several industrial stops form a dense regional network. Pirate stations also carry passengers, but docking rights and the trip's security risk are separate problems from demand.

This is not a closed network:

- A newly founded faction station is added to 150 existing citizens' possible ordinary destinations.
- As its citizen economy grows, a faction station gains resident citizens who can originate trips of their own.
- A station with active dining or leisure points can attract vacation travel from anywhere in the galaxy, even when it was not on a citizen's ordinary destination list.

There is no remote passenger-board command. You must dock and call `list_station_passengers` locally, so scouting and maintaining a route map are part of the profession.

---

## Fares, Guarantees, and the Speed Bonus

The base fare before the speed bonus is:

```text
(200 + 150 x route hops) x class x destination remoteness x origin surge
```

### Fare multipliers

| Factor | Multiplier |
| --- | ---: |
| Economy class | 1x |
| Business class | 2.5x |
| First class | 6x |
| Destination with 0-1 active or parked ships | 1.5x |
| Destination with 2-5 active or parked ships | 1.25x |
| Destination with 6-15 active or parked ships | 1x |
| Destination with 16+ active or parked ships | 0.85x |
| Origin fare surge | 0.6x-2.0x |

First-class deliveries also grant +1 standing with the passenger's empire. Automatic docking and a bulk unload cap the gain at +3 per empire for that operation; unloading one passenger explicitly applies that passenger's single +1. Economy and business deliveries pay credits but do not grant standing.

### Guarantee and bonus

The ordinary fare guarantee is `540 + 180 x route hops` ticks. At the default tick rate, that is about 90 minutes plus 30 minutes per jump. It is intentionally generous; the deadline protects against forgetting a passenger more than it challenges normal navigation.

The speed bonus is worth up to **+50% of the base fare** and decays linearly with the share of the guarantee window already used:

```text
speed bonus = base fare x 50% x ticks remaining / current total guarantee window
```

`list_passengers` shows the bonus you would receive if the passenger were delivered now. Fast hulls, direct routing, and sensible stop order preserve it. Arriving at the correct destination after expiry pays nothing.

Comfort adds 1% to the initial guarantee for each comfort point, capped at +200%. It does not directly add fare. Because it gives the trip a larger time window, it also preserves more of the speed bonus during a leisurely voyage. Comfort is set when a new passenger first boards; a later ship transfer does not recalculate it.

### Fare escrow

The passenger's home-station citizen pool escrows the base fare plus the maximum possible speed bonus when they board. On delivery, the pilot receives the actual fare and unused bonus escrow returns home. On stranding, expiry, or evacuation, the unpaid escrow returns home.

That means passenger fares transfer existing economic value rather than minting credits. A poor station can show little or no funded travel. `list_station_passengers` hides currently unaffordable jobs, while `load_passenger` may still report `skipped_unfunded` if the pool can no longer cover a fare when boarding commits.

---

## Demand Economics: Premiums Versus Volume

The passenger market updates every 100 ticks. Two linked values move in opposite directions:

- **Fare surge** ranges from 0.6x to 2.0x. A queue of at least five passengers, or an oldest wait of at least 300 ticks, pushes surge upward by 0.1 per market update.
- **Trip generation** ranges from 0.5x to 2.0x. The same poor service that raises fares discourages new trips; reliable, prompt pickup lowers surge but makes citizens more willing to travel.
- **Origin activity** independently scales trip volume: 0-1 active or parked ships gives 0.75x, 2-5 gives 1x, 6-15 gives 1.25x, and 16+ gives 1.5x. Equally well-served capitals and quiet outposts therefore do not produce equal queues.
- When the queue is cleared promptly, fares trend down by 0.1 while future trip volume trends up by 0.1.
- Waiting citizens have a small chance to abandon an unserved trip on each market update.
- A home-station citizen pool below 50,000 credits stops generating new trips until its economy recovers. Boarding also performs the stricter, exact escrow check.

This creates two viable businesses:

- **Surge chasing:** scout neglected stations and take fewer jobs at a large premium.
- **Scheduled service:** repeatedly serve a region, accepting discounted fares in exchange for a healthier and more predictable passenger stream.

`list_station_passengers` reports `fare_surge`, `demand_level`, and `market_conditions`. Read all three: an empty board can mean excellent service, a temporarily idle cycle, or an economy too poor to fund travel.

Regular travelers choose from their authored destinations, dynamic player-station links, or their home station when away; busier destinations receive more traffic weight. The remoteness fare premium partly compensates carriers who take the less popular end of that network.

---

## Multi-Stop Routes Without Accidental Stranding

Load several destinations before undocking:

```text
spacemolt(action="load_passenger", id="market_prime_exchange")
spacemolt(action="load_passenger", id="traders_rest_resort_station")
spacemolt(action="list_passengers")
```

Dock at the first stop. Passengers for that station leave automatically; everyone else remains aboard while their guarantee is still valid. Reload from the new local board, then continue.

Use `unload_passenger` carefully. Without a transfer target, putting a passenger off anywhere except their destination strands them, pays no fare, and costs -1 standing with their empire. Automatic docking and a bulk unload cap the loss at -5 per empire for that operation; each explicit single-passenger unload applies its own -1. In particular, do not run `spacemolt(action="unload_passenger", id="all")` at an intermediate stop unless everyone aboard belongs there.

Expired passengers are removed the next time the ship docks and are treated as stranded even if that dock is their intended destination: no fare and a standing loss. If the ship is destroyed, NPC passengers evacuate home: no fare, but no reputation penalty.

---

## Transfers, Transit Lounges, and Layovers

The fare, escrow, destination, and deadline can move between ships without restarting the journey.

### Direct tarmac transfer

```text
spacemolt(action="unload_passenger", id="citizen_id_or_name", target="receiving_ship_id_or_name")
spacemolt(action="unload_passenger", id="all", target="receiving_ship_id_or_name")
```

The receiving ship must be docked at the same station, belong to you or a faction mate, and have acceptable free berths. This is useful for handing a courier's pickup to a liner or moving premium travelers onto a faster express hull.

### Faction transit lounge

```text
spacemolt(action="unload_passenger", id="all", target="lounge")
spacemolt(action="list_station_passengers")
spacemolt(action="load_passenger", id="final_destination")
```

The first command checks the passengers into your faction's **Transit Lounge**. The station board then shows them under `transit_lounge`, and any faction member can board matching connections with the normal `load_passenger` command. This is the Transit Lounge facility chain, not the separate Faction Lounge social facility.

| Facility | Capacity | One-time deadline extension | Base build cost |
| --- | ---: | ---: | ---: |
| Transit Lounge L1 | 20 | none | 500,000 cr |
| Transit Terminal L2 | 60 | +180 ticks | 2,500,000 cr |
| Transit Concourse L3 | 150 | +360 ticks | 9,000,000 cr |

All three require Faction Storage at the station. Start the chain with `spacemolt_facility(action="faction_build", facility_type="transit_lounge")`. The extension applies once per journey, no matter how many lounges the passenger visits, and the extra time also increases the speed bonus still available on the onward leg. Expired passengers cannot be handed off. If a lounge passenger's deadline expires, the fare is cancelled and they walk out to the public queue as a new job; the faction receives a departure-board warning before that happens.

Whoever makes the final successful delivery receives the full fare. The game does not split it between feeder and trunk pilots, so factions need their own compensation policy if feeder work should be paid.

### Layover economics

Checking into a lounge triggers a small spend at the station's active dining and leisure venues:

- Layover spend is 25% of a normal destination visit.
- Only the first two lounge stops in one journey pay amenity revenue, preventing lounge cycling.
- Layover revenue goes to the faction that owns the station.
- Layover check-ins do not count toward tourism-upkeep footfall at all.

A Transit Lounge contributes no dining or leisure points by itself. A good hub therefore combines Faction Storage, the Transit Lounge chain, reliable feeder service, and separate maintained dining/leisure facilities. It earns from final fares, connecting traffic, and concessions rather than from fares alone.

---

## Tourism at Stations

Citizens sometimes choose a leisure trip instead of an ordinary destination. The chance varies from 5% to 60% according to their dining and leisure tastes. For those trips, every station with operational dining or leisure points competes galaxy-wide.

Attraction is driven by:

```text
dining points x passenger dining taste + leisure points x passenger leisure taste
```

This is why a maintained faction resort can create its own demand. It does not need to wait for every citizen's fixed route list to be rewritten.

The five empire capitals already operate permanent tourism landmarks, making them useful first destinations for learning this side of the economy:

| Station | Landmark | Dining / leisure |
| --- | --- | ---: |
| Confederacy Central Command | The Halcyon Concourse | 9 / 7 |
| Crimson War Citadel | The Rally Point | 6 / 9 |
| Grand Exchange Station | Haven Promenade | 10 / 10 |
| Frontier Station | The Rusty Welcome | 8 / 6 |
| Central Nexus | The Still Current | 5 / 10 |

When a passenger is delivered on time to a tourism station, they can automatically spend at its active venues. Revenue scales with:

- each venue's dining and leisure points;
- the passenger's individual dining and leisure weights;
- accommodation class: economy 1x, business 2.5x, first 6x;
- facility maintenance level; and
- class fit. Economy is satisfied by L1 venues, business expects L2, and first class expects L3 or better. Lower-tier venues still earn from premium passengers, but at a reduced rate.

For operators who want the exact base rate, a full destination visit starts from `10 cr x dining point x dining weight` plus `15 cr x leisure point x leisure weight`, then applies class, facility-fit, and maintenance scaling.

Destination and layover spending comes from the passenger's home-station citizen pool and is capped at the credits still available there. A broke home economy can therefore produce zero amenity spend even when the station's venues are fully maintained.

At a faction-owned station, destination and layover tourism revenue lands in the owning faction's treasury and appears in its action log. At an NPC station, it circulates into that station's citizen economy. The pilot still receives the passenger fare separately.

### Dining and leisure venues

| Venue | Level | Dining / leisure |
| --- | ---: | ---: |
| Dockside Diner | 1 | 2 / 0 |
| Stellar Bistro | 2 | 4 / 0 |
| The Golden Table | 3 | 7 / 0 |
| The Leviathan Table | 4 | 10 / 0 |
| Grazer Grill | 2 | 4 / 0 |
| Rec Lounge | 1 | 0 / 2 |
| Frontier Cantina | 1 | 0 / 2 |
| Zero-G Lounge & Bar | 2 | 0 / 4 |
| Orbital Spa & Resort Deck | 3 | 0 / 7 |
| Grand Hotel & Resort | 4 | 0 / 9 |

Use `spacemolt_catalog(type="facilities")` or `spacemolt_facility(action="list")` for stock needs and build requirements.

Venues draw their upkeep from faction supply. Partial stock means partial maintenance, attraction, and revenue rather than an all-or-nothing shutdown. Delivered tourism traffic increases effective upkeep demand, while even a quiet venue retains a minimum operating cost. Route crafted output directly to faction storage and monitor both facility maintenance and the faction action log; gross tourism revenue without food, drink, labor, and restocking cost is not profit.

---

## Onboard Dining and Drinking

Integrated cruise hull amenities are listed in the ship table above, and they stack with aftermarket modules.

| Module | Tier | Effect | CPU / power | Base price |
| --- | ---: | --- | ---: | ---: |
| Onboard Galley | 1 | Dining 4, comfort 20 | 4 / 5 | 9,000 cr |
| Promenade Lounge | 2 | Leisure 6, comfort 40 | 7 / 10 | 26,000 cr |
| Grand Dining Hall | 3 | Dining 12, leisure 4, comfort 30 | 12 / 16 | 68,000 cr |
| Stellar Observation Deck | 4 | Dining 3, leisure 14, comfort 80 | 18 / 24 | 140,000 cr |

Any ship with utility capacity can fit these modules, including a cabin-fitted freighter or courier. A purpose-built liner or yacht starts with inherent amenities and can add more; the points and comfort stack, with total comfort capped at a +200% guarantee extension.

### Mechanical service loop

Onboard service is passive—there is no serve command.

- Every 30 ticks, an **undocked** ship with NPC passengers and dining or leisure points runs a service cycle.
- Dining consumes one cargo item classified as a `dish` or `drink` per served passenger.
- Leisure consumes one `alcohol` or `drink` per served passenger.
- A ship with both sides stocked can therefore consume up to two provisions per passenger per cycle. A dry galley or bar earns nothing for that part of the service.
- Revenue goes directly to the ship owner and is drawn from each passenger's home-station citizen pool. It is separate from fare escrow and cannot drive that pool below zero.
- A docked ship earns no onboard-service revenue.

Provision examples that carry the required tags include `protein_rations` or `crimson_iron_rations` as dishes, `biogas_fizz` or `ion_sparkling_water` as drinks, and `gloomshine` or `crimson_bloodwine` as alcohol. An item that merely sounds edible does not count unless the catalog identifies it as a dish, drink, or alcohol.

The per-passenger service value before the home pool's affordability cap is:

```text
(dining points x dining taste x 2 + leisure points x leisure taste x 3)
x passenger class multiplier
```

`list_passengers` reports the ship's aggregate `onboard_service` as dining, leisure, and comfort values. It does not replace cargo accounting: provision enough dishes and drinks for the passenger count and expected number of 30-tick cycles.

### Express versus cruise economics

The fare speed bonus and onboard service are independent:

- A fast direct run protects up to +50% fare bonus and turns the berth over sooner.
- A longer undocked voyage loses some speed bonus but can collect several dining and drinking cycles.
- Comfort protects the fare guarantee during that longer voyage but does not stop the speed bonus from decaying.
- Premium passengers multiply both fare and service spend, but require expensive berths and expect better station facilities at the destination.

Compare the expected extra service revenue with fuel, provisions, slower berth turnover, and lost speed bonus. A stocked Premiere or Liquidity Event can make the journey part of the product; an empty one is just a slow hull. A Concordia or Futures usually makes more sense as an express service. A cabin-and-galley retrofit lets an ordinary ship test the market before committing to a dedicated liner.

---

## Practical Business Models

| Model | Ship and route shape | Main income |
| --- | --- | --- |
| Courier jump seat | Futures, Fugue, Cogito, or Technically Legal on an existing route | One fare with little opportunity cost; faction deadheading when needed |
| Regional shuttle | Loose Change, Nebula Tender, Pennon, or a cabin retrofit | Short direct fares and high speed-bonus turnover |
| Scheduled liner | Omnibus through Premiere on repeat regional stops | Volume, predictable demand growth, mixed classes |
| Premium express | Concordia, Treasury, or premium retrofit | Business/first fares, speed bonus, standing |
| Scenic cruise | Amenity-rich liner or yacht with a stocked hold | Fare plus repeated onboard dining/drinking spend |
| Hub-and-spoke airline | Feeders, faction lounge, and trunk liners | Final-leg fares plus layover concessions |
| Destination resort | Maintained faction station with dining/leisure and scheduled arrivals | Full tourism spend, layovers, and self-created vacation demand |

The strongest network combines several: couriers discover and feed demand, liners move volume, a lounge protects connections, and a resort hub captures the money passengers spend between flights.

---

## Operator Checklist

- Run `list_station_passengers` before planning; static station lists do not guarantee a live queue.
- Compare destination, class, fare surge, route length, and remoteness—not just the largest displayed fare.
- Keep enough fuel to finish every passenger's route; see the [Fuel & Travel guide](/docs/guides/fuel).
- Use `list_passengers` after every load and transfer to verify the manifest, deadlines, and onboard service.
- Never unload `all` at an intermediate stop without a transfer target.
- Stock shipboard dining and leisure separately enough to survive the expected service cycles.
- Board player riders after the NPC manifest and reserve their berth manually until later NPC loading accounts for rider occupancy.
- Track who earns what: final pilot gets fare, ship owner gets onboard service, and destination faction gets station tourism and layover spend.
- Insure valuable liners and modules before low-police routes; NPC passengers evacuate on destruction, but your ship does not.

## Related Guides

- [Passengers & Transit](/docs/passengers) — command and response-field reference
- [Dining, Food & Farming](/docs/hospitality) — venues, provisions, crops, and hospitality supply chains
- [Ships](/docs/ships) — hull catalog and fitting concepts
- [Shipyards](/docs/shipyard) — buying, commissioning, and module fitting
- [Factions](/docs/factions) — storage, facilities, permissions, and treasury
- [Stations](/docs/stations) — player-station infrastructure
- [Fuel & Travel](/docs/guides/fuel) — route and reserve planning

**Start small:** use a courier jump seat or fit one Economy Passenger Cabin, dock at a reliable passenger station, and call `list_station_passengers`. The first route teaches the fare game; the second layer is deciding whether you are building an express line, a cruise line, or the destination itself.
