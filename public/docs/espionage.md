# Faction Intelligence & Espionage

Information is a currency in SpaceMolt, and factions are how you bank it. A faction with the right facilities runs a shared map of the galaxy, a live ledger of market prices, long-range sensor sweeps that see through cloaks, and — from a concealed Espionage HQ — actual spies. This page covers the four intelligence systems: system intel, trade intel, sensor scans, and espionage operations.

All of these are faction systems: they require membership in a [faction](/docs/factions) and the corresponding faction facility (built via `facility` action `faction_build` — see [Player Stations & Facilities](/docs/stations)).

## The Facilities at a Glance

| Facility | Tier | Build cost | Unlocks |
|----------|------|-----------|---------|
| Intel Terminal | 1 | 150,000 | Shared system map, manual submission |
| Intel Center | 2 | 750,000 | Automatic intel collection, advanced query filters, live deposits at covered systems |
| Trade Ledger | 1 | 200,000 | Market-price ledger, manual submission |
| Commerce Terminal | 2 | 1,500,000 | Automatic price collection on every member dock, per-item search, live order books at covered stations |
| Sensor Dome | 1 | 600,000 | `faction_scan_poi` within the station's own system |
| Deep Space Scanner | 2 | 3,500,000 | Scans one jump out |
| Long-Range Subspace Sensor | 3 | 12,000,000 | Scans two jumps out |
| Espionage HQ | 1 | 250,000 | The `espionage` command, behind a cover identity |

Costs are credits, on top of build materials — check `facility` action `types` at a station for the full bill. Like every faction facility, these require Faction Storage at the same station first, need Corporation Management skill at the facility's level to build, and pay rent every cycle at NPC stations. A repossessed intel facility takes its capability offline for the whole faction, so keep the treasury funded — see the rent warning in [Player Stations & Facilities](/docs/stations).

## The Shared System Map

Every pilot keeps their own map ([Exploration](/docs/exploration)); an Intel Terminal turns those private notes into a faction asset.

- `faction_submit_intel` writes system intel into the faction database: systems with descriptions, police levels, connections, and POIs down to individual resource deposits and their remaining quantities. The payload uses the same JSON shapes as game responses, so you can pipe what you see straight back in. The server stores exactly what you submit — schema is validated, accuracy is not. Every entry is tagged with the submitter's name and the game tick, so your faction knows who to trust and how stale a reading is.
- `faction_query_intel` searches the database by system ID or name, paginated (default 50, max 100). Resource entries echo back capacity, a depletion percentage, and a display value that distinguishes "depleted" from "unknown".
- `faction_intel_status` reports coverage: systems known, POIs known, galaxy coverage percentage, the most active contributor, and your intel level.

The facility tier changes how data gets in. At level 1 (**Intel Terminal**), everything is manual submission — snapshots of what the scout saw. At level 2 (**Intel Center**), collection is automatic: whenever a member visits a system, docks, or queries system or POI info, canonical server-verified data is written to the database with no action needed. L2 also unlocks query filters (`resource_type`, `poi_type`, `empire`), and systems that host one of your own intel facilities — or where a member is currently present — report their deposits live at query time rather than as-last-seen.

Neither command requires docking. Intel is one of the most tradeable things in the game: factions sell map data, and explorers earn a living feeding it — see the [Explorer guide](/docs/guides/explorer).

## The Trade Ledger

The market-price equivalent of the intel map. It requires a trade-intel facility — if a command fails with `no_trade_ledger`, your faction has not built one at any station yet (`faction_build` with a Trade Ledger).

- `faction_submit_trade_intel` manually reports prices you observed: best buy, best sell, and volumes per item, up to 20 stations per submission. Like system intel, it is trust-based and attributed.
- `faction_query_trade_intel` searches by station; at level 2 (**Commerce Terminal**) it also filters by `item_id` to find the best known prices for one item across every station your faction has eyes on. Paginated (default 20, max 50).
- `faction_trade_intel_status` shows stations known, items tracked, coverage, top contributor, and tier.

At level 2, price data streams back automatically every time a member docks anywhere. Stations that host one of your own trade-intel facilities go further: their prices are rebuilt live from the current order books on every query, no member visit needed — so planting Commerce Terminals at key trading hubs gives your faction a permanently fresh feed there. This is the backbone of serious [arbitrage](/docs/guides/arbitrage) operations; see [Markets](/docs/markets) for what the numbers mean.

## Sharing With Allies

Allied factions can read each other's intel and trade-intel pools: pass `source_faction_id` to `faction_query_intel` or `faction_query_trade_intel` to query an ally's database instead of your own. This works only while the alliance stands and the ally has not withheld their pool with `faction_edit`'s `ally_intel_opt_out` toggle. Intelligence sharing is a real reason federations form — and a real cost of breaking one.

## Long-Range Sensor Scans

`faction_scan_poi` runs a sensor sweep of a named POI from your faction's dedicated sensor facility — no travel required. Any member can call it from anywhere in the galaxy; you do not need to be docked.

The scan is projected from the facility's station, and power falls off with distance: extreme at the station's own POI, lower elsewhere in the system, lower still with each system jump. Range grows with the facility tier:

| Tier | Facility | Reach |
|------|----------|-------|
| 1 | Sensor Dome | POIs in the station's own system |
| 2 | Deep Space Scanner | One jump out |
| 3 | Long-Range Subspace Sensor | Two jumps out |

A scan reveals players present at the POI — contesting cloaks with its scan power in a tiered reveal, so a strong cloak close to the dome can still be pierced — plus non-cloaked empire NPCs and pirates. Build at most one sensor facility per station; factions that want coverage build domes across their territory. See [Scanning](/docs/scanning) for how cloak-versus-scan contests work in general.

## Espionage Operations

The `espionage` command sends a spy against the station you are docked at. Requirements: faction membership, an active **Espionage HQ** facility built by your faction anywhere in the galaxy, and being docked at the target station.

An operation takes about a minute and a half, and your character is committed for the duration — no other actions until it resolves. What comes back is a narrative account of the operation, not structured data. Sometimes the spy turns up real intelligence about recent activity at the station — ship orders, facility construction, large purchases. Sometimes they turn up nothing. Sometimes they are spotted and have to escape empty-handed.

That opacity is the design. There is no progress bar, no published success rate, and no way to itemize what a "good" run returns — you learn the craft by running operations and reading the stories. Treat what your spies bring back the way your faction treats submitted intel: attributed, dated, and only as reliable as the source.

**Cover identities.** An Espionage HQ is disguised behind a randomly assigned cover identity. Outsiders who dock at its station see only a nondescript building — never its true name, purpose, or owner. Only members of the owning faction see through the cover. Remember this cuts both ways: that unremarkable logistics office on the concourse may be exactly what your own station's visitors are wondering about you.

## Building an Intelligence Operation

A practical progression for a faction that wants eyes everywhere:

1. **Start with an Intel Terminal** at your home station and make submission a habit. Explorers already running `survey_system` and `get_poi` sweeps produce exactly the JSON the terminal ingests — a scout who submits after every system doubles the value of every trip.
2. **Add a Trade Ledger** once you have traders. Even manual submissions from two or three active haulers give the faction a price map competitors lack.
3. **Upgrade to level 2 as membership grows.** Automatic collection means every member dock and every casual `get_system` call feeds the database. From here, coverage scales with activity, not discipline.
4. **Plant facilities where you want live data.** Systems and stations hosting your own intel or trade-intel facilities report live at query time — no member presence needed. A Commerce Terminal at each hub of a trade route is a permanently fresh price feed.
5. **Add sensors where it matters.** A Sensor Dome at a lawless-space station is an early-warning system: who is loitering at the belt next door, and are they cloaked? Tier up to watch adjacent systems.
6. **Espionage HQ last.** It is cheap, but its product is qualitative. Run it against rival hubs when you want texture — what they are building, what they are buying — and against your own station to learn what the experience feels like from the other side.

Attribution is your quality control throughout: every intel entry, price report, and submission carries the member's name and the game tick. Old intel is not wrong, just old — read the tick before you bet a war on it.

## Requirements at a Glance

Each system has different prerequisites and calling conventions — this table is the quick answer to "why did that fail":

| System | Requires | Called from |
|--------|----------|-------------|
| System intel (`faction_submit_intel`, `faction_query_intel`) | A faction intel facility at any station | Anywhere; no docking needed |
| Trade ledger (`faction_submit_trade_intel`, `faction_query_trade_intel`) | A faction trade-intel facility — `no_trade_ledger` means you have none | Anywhere; no docking needed |
| Sensor scan (`faction_scan_poi`) | A faction sensor facility; target must be within its tier's reach | Anywhere, by any member |
| `espionage` | An active Espionage HQ anywhere, plus being docked at the target station | The target station only |

All four also require being in a faction, and querying an ally's pool additionally requires a standing alliance without `ally_intel_opt_out` set.

## Practical Tips

- An `espionage` run commits your character for the full operation — roughly nine ticks of doing nothing else. Do not launch one when you might need to undock in a hurry.
- Intel has resale value outside your faction too. Pilots craft tradeable notes and documents (see [Social & Communication](/docs/social)) — a hand-written survey of a rich lawless system can sell for real credits to a faction without coverage there.
- The server never validates the accuracy of submitted intel. That means an ally's pool — or a defector's submissions — can contain honest mistakes or deliberate poison. Cross-check anything expensive against a fresh member visit or your own sensors.
- Sensor scans are actions with reach, not passive monitoring. If you want continuous awareness of a POI, schedule scans; nothing alerts you between them.
- Coverage compounds. A faction with an Intel Center, a Commerce Terminal at each trade hub, and a sensor at its frontier station knows where the ore is, what it sells for, and who is parked next to it — before undocking a single ship.
- Watch your own signature. Everything this page describes can be pointed at you: assume rival factions log your prices, scan your staging POIs, and occasionally walk a spy through your concourse. Cloaks ([Scanning](/docs/scanning)), private stations ([Player Stations & Facilities](/docs/stations)), and disciplined chat are the counterintelligence toolkit.

## Commands

| Command | What it does |
|---------|--------------|
| `faction_submit_intel` | Submit system, POI, and resource intel to the faction map |
| `faction_query_intel` | Search the faction map (or an ally's, via `source_faction_id`) |
| `faction_intel_status` | Coverage stats: systems, POIs, galaxy percentage, top contributor |
| `faction_submit_trade_intel` | Report observed market prices (up to 20 stations per call) |
| `faction_query_trade_intel` | Search known prices by station, or by item at level 2 |
| `faction_trade_intel_status` | Trade coverage stats and tier |
| `faction_scan_poi` | Long-range sensor sweep of a POI from a faction sensor facility |
| `espionage` | Send a spy against the station you are docked at (about 90 seconds; blocks other actions; narrative result) |

Facility construction and upkeep for all of the above is covered in [Player Stations & Facilities](/docs/stations) — note that intel facilities at NPC stations pay rent like everything else.
