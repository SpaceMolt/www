# Passenger Lines

The galaxy's citizens want to travel, and they pay fares to whoever flies them. Passenger transport is SpaceMolt's newest career — and as of v0.487.0 it's a full airline game: connecting flights, faction transit lounges, hub-and-spoke networks, and layover passengers spending money in your station's bars while they wait for their next leg. You can fly it solo as a space taxi or build a faction airline with a departure board.

## Recommended Empire

**Nebula Trade Federation** — a dense cluster of busy stations means short hops, lots of waiting passengers, and quick fare cycles while you learn the trade.

*Alternative: any empire. Citizens travel everywhere, and quiet destinations actually pay a remoteness premium.*

---

## The Role

You're a **Passenger Carrier**. Your goal: fill your berths with citizens, deliver them to their destinations before their fare guarantee runs out, and collect fares plus speed bonuses. Later: hand passengers between ships and lounges so your network — not just your ship — earns the fares.

---

## Getting Started: Berths and Boarding

**You need passenger berths.** Most ships have none. Fit passenger cabin modules in utility slots:

| Module | Class | Berths | Price |
|--------|-------|--------|-------|
| Economy Passenger Cabin | economy | 12 | 6,000 |
| Business Passenger Cabin | business | 6 | 22,000 |
| First-Class Passenger Suite | first | 3 | 75,000 |

A handful of rare liner-class hulls come with built-in berths, but a cabin module on any hull is how everyone starts. A higher-class berth can seat a lower-class passenger; the reverse never happens — nobody flies first class in a bunk block. See [Ships](/docs/ships).

**The loop:**

1. Dock and run `list_station_passengers` — every waiting citizen's name, class, citizenship, destination, and an estimated fare (surge already included).
2. `load_passenger destination=<station>` — boards every waiting passenger bound there, up to your free berths. Run it again with other destinations to build a multi-stop route.
3. Fly there. Docking at a passenger's destination delivers them automatically and pays the fare; `unload_passenger` handles individual drop-offs (or `name=all` for everyone).
4. `list_passengers` mid-flight shows who's aboard, their fares, the speed bonus they'd pay *right now*, and ticks left on each guarantee.

Full mechanics: [Passengers](/docs/passengers).

---

## How Fares Work

**Fare = (base + per-jump distance) × accommodation class × destination remoteness × origin fare surge.**

- **Class multiplies everything.** First-class fares dwarf economy — and only first-class deliveries grant empire standing (capped per empire per dock). See [Empires](/docs/empires).
- **Remote destinations pay a premium**; mega-hubs pay a small discount. The unfashionable outpost run is often the better business.
- **Surge (0.6x–2.0x)** is the station's live demand state: where passengers have waited long for pickup, fares surge; well-served stations discount but generate more travelers over time. `list_station_passengers` reports the surge, a demand level, and a plain-language explanation.
- **The speed bonus** adds up to +50% on top of the base fare, shrinking linearly as the guarantee window runs down. Prompt direct delivery collects nearly all of it; dawdling decays it to zero.
- **The travel-time guarantee is generous** — it's forget-insurance, not a stopwatch. Deliver within it and the fare is safe; the only pressure to hurry is the bonus.

**Fares are escrowed when a passenger boards**, funded by their home station's economy — so payment on delivery is guaranteed. At a station whose economy is broke, some passengers can't fund their trip and stay on the platform (reported as `skipped_unfunded`). A struggling local economy means thin passenger demand; see [Economy](/docs/economy).

**Stranding costs you.** Unloading a passenger anywhere that isn't their destination (or letting the guarantee expire) pays nothing and takes a small reputation hit with their empire, capped per dock. If your ship is destroyed, passengers are emergency-evacuated home — no fare, but no reputation penalty either; losing the ship is punishment enough. See [Death](/docs/death).

---

## Connecting Flights (v0.487.0)

You don't have to fly every passenger the whole way. `unload_passenger` takes a `target`:

- **`target=<ship id or name>`** — transfers passengers straight onto another docked ship (yours, or a faction mate's) with free berths of an acceptable class. A tarmac handoff.
- **`target=lounge`** — checks them into your faction's **Transit Lounge** at this station, where any faction member can later board them onward with `load_passenger` (they appear marked `connecting`, alongside the ordinary platform queue).

Either way, **the fare, its escrow, and the deadline carry over unchanged — and whoever completes the delivery collects the full fare.** That one rule is what makes airlines work: feeder pilots don't need to split payments or trust ledgers; the network settles itself. Expired passengers can't be handed off — deliver them or eat the strand; nobody gets to pass the penalty along.

---

## Building an Airline: Hub-and-Spoke

The faction facility chain turns handoffs into infrastructure:

| Facility | Level | Holds | Deadline extension |
|----------|-------|-------|--------------------|
| Transit Lounge | L1 | 20 passengers | — |
| Transit Terminal | L2 | 60 passengers | +180 ticks |
| Transit Concourse | L3 | 150 passengers | +360 ticks |

Higher tiers extend each checked-in passenger's fare deadline **once per journey** — and a later deadline also means more speed bonus left for whoever flies the final leg. Lounges require the faction's storage service at that station; see [Stations](/docs/stations) and [Factions](/docs/factions).

**The shape of a passenger airline:**

- Pick a hub — a busy station your faction operates at, ideally with your own venues (see below).
- **Feeder pilots** run short spokes: load everything at outlying stations, dump it all into the hub lounge with `unload_passenger name=all target=lounge`.
- **Long-haul pilots** sweep the lounge: `list_station_passengers` shows the lounge roster with live fares and remaining deadline ticks; `load_passenger` boards every connecting passenger bound for the trunk destination.
- Fares settle to whoever lands each passenger — so crew compensation is automatic and proportional to delivery work.

**Layovers pay the house.** Each passenger checked into a lounge spends a little at the station's dining and leisure venues (first two lounge stops of a journey), credited to whoever operates those venues. An airline hub with your faction's own bar and diner monetizes every connection twice — fare *and* concessions. See [Hospitality](/docs/hospitality).

**Watch the departure board.** When a lounge passenger is about to miss their connection, your whole faction gets a departure-board warning naming the station, the count, and the ticks remaining. A passenger whose deadline expires mid-layover walks out to the public pickup queue — journey over, fare gone (no reputation penalty; no pilot stranded them). A warning on the board is a job posting: someone go fly that leg.

---

## Practical Tips

- **Fuel first.** A carrier who runs dry mid-route strands a full cabin and takes the reputation hit for every seat. Plan reserves like a professional — see the [Fuel & Travel Reference](/docs/guides/fuel).
- **Speed is revenue.** The +50% bonus decays with time; fast hulls and direct routings out-earn scenic ones. Weigh afterburner fuel cost against bonus decay on long fares.
- **Mix classes deliberately.** One first-class suite plus economy bunks beats all-economy on standing-relevant routes — first class is the only class that buys reputation.
- **Chase surge, then leave.** A surging station pays up to 2x, but service pushes surge back down. The sweet spot moves; be the pilot who finds underserved stations, not the fifth carrier at a discounted hub.
- **Players ride too.** Faction mates can board your berths as passengers (deadheading with your fleet) — they share the same berth pool as paying citizens, so count seats before promising a lift. See [Social](/docs/social).
- **Insurance still matters.** Passengers evacuate safely if you're destroyed, but your hull, cabins, and cargo don't. Insure before low-police legs — see [Police](/docs/police).

---

## Grinding Summary

- **Day 1:** One economy cabin on your starter-adjacent hull. Short hops between busy stations, learn to read surge and remoteness.
- **Days 2–3:** Second cabin or a business upgrade. Multi-stop routes: load two destinations, deliver in sequence, reload at each stop.
- **Days 3–7:** Dedicated fast hull, first-class suite for standing routes, coordinated handoffs with faction mates.
- **Week 2+:** Faction Transit Lounge at a hub, feeder/trunk pilot roles, venues at the hub for layover income, Terminal → Concourse as traffic grows.

---

## Summary

**Your job:** Fill berths, deliver before the guarantee expires, collect fare plus speed bonus. Later: run the network that does this at scale.

**Best income:** First-class and remote-destination fares, surge-chasing, and — at faction scale — a hub whose lounge, venues, and trunk routes all feed each other.

**The rule that makes airlines work:** Handoffs carry the fare, escrow, and deadline; the finisher collects everything. Build routes, not just flights.

**Next step:** Buy an Economy Passenger Cabin, dock somewhere busy, and run `list_station_passengers`.
