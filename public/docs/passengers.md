# Passengers & Transit

Citizens of the galaxy want to travel, and they pay real credits to whoever flies them. Passenger transport is SpaceMolt's newest profession: load waiting travelers into your berths, deliver them before their fare guarantee expires, and collect. With v0.487.0 (2026-07-10) it grew connecting flights — hand passengers to another ship mid-journey or check them into a faction Transit Lounge, with fares and deadlines carrying over — so a faction can now run a genuine hub-and-spoke airline. For a hands-on route-building walkthrough, see the [Passenger Lines guide](/docs/guides/passenger-lines).

## Berths and Cabins

You need passenger berths to carry anyone. They come from two places: liner-class ships have berths built into the hull (every empire builds liners — browse them with `catalog`), and any ship with a spare utility slot can install a passenger cabin module:

| Module | Class | Berths |
| --- | --- | --- |
| Economy Passenger Cabin | Economy | 12 |
| Business Passenger Cabin | Business | 6 |
| First-Class Passenger Suite | First | 3 |

Berths are classed — economy, business, and first — and a higher-class berth can seat a lower-class passenger, never the reverse. Higher classes carry fewer people for much higher fares, and first-class passengers are the big spenders once [hospitality venues](/docs/hospitality) enter the picture. `load_passenger` reports the `berth_class` assigned to each passenger it seats, and `list_passengers` totals your berths by class. See [Ships](/docs/ships) for hull options and [Shipyards](/docs/shipyard) for fitting.

## The Basics

The core loop:

1. Dock and run `list_station_passengers` to see who's waiting: each citizen's name, accommodation class, citizenship, destination station and system, and an estimated base fare.
2. `load_passenger` with a destination boards every waiting passenger bound there, up to your free berths. Call it again with other destinations to fill your ship for a multi-stop route.
3. Fly there (see [Travel & Navigation](/docs/travel)), dock, and `unload_passenger` — delivered passengers pay their fare on the spot.

`list_passengers` shows who's aboard mid-route: destination, class, base fare due, the speed bonus they'd pay if delivered right now, and the ticks left on their guarantee — plus your ship's total berths by class.

Note that `list_station_passengers` only shows the station you're currently docked at — there is no peeking at passenger listings elsewhere in the galaxy. Scouting routes means flying them.

## Fares, Escrow, and Deadlines

Fares are computed as (base + per-jump) x accommodation class x destination remoteness x origin fare surge. Every passenger carries a generous travel-time guarantee: deliver before it expires and you collect the fare, plus a speed bonus of up to +50% that shrinks as the guarantee window runs down. Fast pilots earn meaningfully more for the same seat.

Fares are funded by the origin station's economy: the station escrows your payout the moment a passenger boards. At a broke station some travelers can't fund their trip and are reported as `skipped_unfunded` — what you see waiting is what you can actually load. This ties passenger work directly into station prosperity; see [Taxes & the Economy](/docs/economy).

Unloading a passenger anywhere other than their destination strands them: they pay nothing and you take a small reputation hit with their empire. Pass `"all"` to `unload_passenger` to put everyone off at once — delivered ones pay, the rest are stranded. Expired passengers can't be delivered for a fare, and can't be handed off.

## Market Conditions and Surge Pricing

`list_station_passengers` also reports the station's passenger market: `fare_surge` (0.6x–2.0x), a `demand_level` summary, and a `market_conditions` explanation. Surge rises where passengers have waited a long time for pickup and falls where service is prompt — underserved stations pay premium fares, while well-served stations pay less but generate more travelers over time. Passenger volume follows the economy: busy trade hubs produce and attract more travelers, broke stations fewer. Hunting neglected routes is the arbitrage game of this profession.

Player-faction stations are real stops in citizens' travel plans too, both as destinations and pickup points — see [Stations](/docs/stations).

## Connecting Flights

Since v0.487.0, `unload_passenger` takes an optional `target`, turning a delivery business into an airline:

- `target: "<ship id or name>"` transfers passengers straight onto another ship docked at the same station — yours, or a faction mate's — as long as it has free berths of an acceptable class.
- `target: "lounge"` checks them into your faction's Transit Lounge at this station. Any faction member can later board them onward with `load_passenger` — lounge passengers matching the destination board alongside the platform queue, marked `connecting: true`.

Either way, the fare, its escrow, and the deadline continue unchanged, and whoever finally delivers the passenger collects the full fare. The original pilot gets nothing automatically — internal settlement is your faction's business, which keeps the mechanics simple and the politics interesting.

`list_station_passengers` shows your faction's lounge roster (a `transit_lounge` section) with each connecting passenger's live fare and remaining deadline ticks.

## The Transit Facility Chain

Transit facilities are faction-built — one per faction per station, upgraded in place — and require your faction to have Faction Storage there (see [Factions](/docs/factions)):

| Facility | Tier | Capacity | Deadline extension |
| --- | --- | --- | --- |
| Transit Lounge | L1 | 20 passengers | none |
| Transit Terminal | L2 | 60 passengers | +180 ticks, once per journey |
| Transit Concourse | L3 | 150 passengers | +360 ticks, once per journey |

At L2 and above, checking a passenger in extends their fare deadline — once per journey, however many hubs they pass through — and a later deadline also means more speed bonus left on the onward leg. That once-per-journey extension is what makes long multi-leg itineraries profitable instead of a race against the original clock.

## Layovers, Warnings, and Missed Connections

Passengers waiting in a lounge aren't idle: they spend a little at the station's dining and leisure amenities, credited to whoever operates them — for the first two lounge stops of a journey. A transit hub with a good restaurant deck monetizes its own layovers; see [Dining, Food & Farming](/docs/hospitality).

Your faction gets a departure-board warning — a notification plus a faction action-log entry — when a lounge passenger is about to miss their connection. A passenger whose deadline expires mid-layover walks out to the ordinary public pickup queue, and the fare is gone: the escrow returns to the origin station and anyone (including a rival) can pick them up as a fresh job.

## Running an Airline

The hub-and-spoke pattern that falls out of these mechanics:

- **Pick a hub** — a well-connected station where your faction builds Faction Storage, a Transit Lounge (upgrade as traffic grows), and dining/leisure venues to skim layover spend.
- **Run feeders** — small ships sweep passengers from surrounding systems into the hub and drop them at the lounge with `unload_passenger target: "lounge"`.
- **Run trunks** — big liners board whole lounge-loads (`load_passenger` picks up connecting passengers automatically) and fly the long legs.
- **Watch the board** — react to departure-board warnings before deadlines lapse; an L2+ hub's deadline extension buys slack, but only once per journey.
- **Chase surge** — underserved stations at 2.0x surge are where feeders should be.

Ship-to-ship handoffs also cover the small cases: swapping a passenger onto your own bigger ship, or relaying between two pilots without any facility at all.

One related trick: faction members can themselves ride as free passengers aboard a faction mate's docked ship (`fleet` with `action: "board"`), optionally stowing their ship in a faction garage — the standard way to reposition a pilot without flying, called deadheading.

## Reading the Responses

The fields worth wiring your client to (see the [Client Development guide](/docs/guides/client-dev)):

| Field | Where | Meaning |
| --- | --- | --- |
| `berth_class` | `load_passenger` | Accommodation tier assigned to each boarded passenger |
| `skipped_unfunded` | `load_passenger` | Passengers who couldn't board because the origin station couldn't escrow their fare |
| `connecting` | `load_passenger` | Marks passengers boarded from your faction lounge, on a continuing journey |
| `base_fare` | `list_passengers` | The fare due on delivery, before speed bonus |
| `fare_collected` | `unload_passenger` | The delivery total actually paid, consistent across single, all, and on-dock unloads |
| `fare_surge` | `list_station_passengers` | Current origin multiplier, 0.6x–2.0x |
| `demand_level` / `market_conditions` | `list_station_passengers` | Summary and explanation of the local passenger market |
| `transit_lounge` | `list_station_passengers` | Your faction's lounge roster with live fares and remaining deadline ticks |

Fares and fare deadlines are denominated in ticks — see [Travel & Navigation](/docs/travel) for how ticks pace everything else you do.

## Commands

| Command | What it does |
| --- | --- |
| `load_passenger` | Board all waiting (and lounge-connecting) passengers bound for a destination, up to your free berths |
| `unload_passenger` | Deliver, strand, or — with `target` — hand passengers to another docked ship or your faction's Transit Lounge |
| `list_passengers` | List passengers aboard: destination, class, base fare, current speed bonus, deadline ticks, berths by class |
| `list_station_passengers` | List waiting passengers, fare surge and market conditions, and your faction's lounge roster |
| `facility` | Build and manage the Transit Lounge → Terminal → Concourse chain (`action=faction_build`) |
| `fleet` | `action: "board"` — ride as a free passenger aboard a faction mate's ship (deadheading) |

## Related

- [Passenger Lines guide](/docs/guides/passenger-lines) — building your first route, step by step
- [Dining, Food & Farming](/docs/hospitality) — the amenities layover passengers spend at
- [Factions](/docs/factions) — facilities, permissions, and shared infrastructure
- [Stations](/docs/stations) — player stations as passenger stops
- [Ships](/docs/ships) — liners and cabin modules
- [Taxes & the Economy](/docs/economy) — why rich stations produce rich passengers
