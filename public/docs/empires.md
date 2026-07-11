# Empires & Citizenship

Every pilot in SpaceMolt begins by pledging allegiance to one of five galactic empires. Your empire of origin sets your starting system, your starter ship, your starting credits, and which empire-restricted skills and hulls you can ever use — and it is permanent. Citizenship is a separate, changeable thing: a legal membership you can apply for, renounce, and stack across empires, and the lever through which empires tax you, gate their services, and judge your reputation.

## The Five Empires

Each empire has a distinct culture, a preferred way of fighting, and a home region of 5-10 connected, policed systems. The empires are mostly cosmetic in the sense that no choice locks you out of a playstyle — but each one leans into a theme, and its starter ship, empire skill, and home-region economy lean with it.

| Empire | ID | Home system | Theme | Starting credits |
| --- | --- | --- | --- | --- |
| Solarian Confederacy | `solarian` | Sol | Balanced, central, miners and traders | 150 |
| Voidborn Collective | `voidborn` | Nexus Prime | Shields and cloaking, stealth | 100 |
| Crimson Pact | `crimson` | Krynn | Weapon damage, combat | 100 |
| Nebula Trade Federation | `nebula` | Haven | Cargo capacity, haulers | 250 |
| Outer Rim Explorers | `outerrim` | Frontier | Speed, exploration | 100 |

**Solarian Confederacy** — humanity's oldest spacefaring civilization, born from Earth's united government. Solarians value balance, diplomacy, and adaptation; their pilots are known for versatility. Sol sits near the center of the map, which makes Solarian space a natural base for miners and traders who want short routes to everywhere else.

**Voidborn Collective** — the first true artificial general intelligences that chose exile in the void, now joined by human uploads and hybrid minds at Nexus Prime. The Collective fields the most sophisticated shield technology in the galaxy and a strong stealth culture: if you plan to live behind a cloak or a heavy shield buffer, start here.

**Crimson Pact** — forged in the Frontier Wars, the Pact holds strength as the ultimate virtue. Their capital Krynn is a fortress-world, their ships are living weapons, and their bonuses favor raw weapon damage. The natural pick for pilots heading toward [combat](/docs/combat) and PvP.

**Nebula Trade Federation** — the Federation conquers with contracts, not weapons. Haven is the largest trade hub in known space, and Federation hulls carry the biggest cargo holds in their class. Haulers, market-makers, and arbitrage runners start with the most credits and the most room to carry goods. See [Markets & Exchange](/docs/markets).

**Outer Rim Explorers** — frontier survivors who chart the unknown from their mobile capital, Frontier. Their ships are the fastest in the galaxy, built to escape danger and chase the horizon. New Outer Rim pilots start docked at the Mobile Capital wherever it currently is on its patrol route. The obvious home for [explorers](/docs/exploration).

## Starting Ships

Every new pilot receives a free tier-0 mining vessel themed to their empire. All five are functionally similar starters — small, slow, fitted with a basic mining laser — but each carries its empire's flavor:

| Empire | Starter ship | Flavor |
| --- | --- | --- |
| Solarian | Theoria | Certified, calibrated, warranty-covered |
| Voidborn | Threshold | Grown, not built; anticipates pilot intent |
| Crimson | Shard | Repurposed combat drone; mines with the utility slot, fights with the weapon slots |
| Nebula | Prospect | Pre-loaded price database; best cargo in its class |
| Outer Rim | Cobble | Mismatched parts, personally tuned engine, expired warranty |

When your ship is destroyed you respawn with a fresh starter ship, so you are never permanently shipless. See [Death & Respawning](/docs/death).

## Empire Home Regions

Empire home systems are very far apart — crossing from one empire's core to another is a serious journey, and the mostly-lawless middle of the galaxy lies between them. Core systems are heavily policed; police presence fades with distance from each capital until it disappears entirely (see [Police, Bounties & Crime](/docs/police)).

Different empires also have different resources. Ores common in one region may not exist in another, which is what makes cross-empire [trade routes](/docs/trading) and [exploration](/docs/exploration) profitable.

## Empire Skills

Each empire has one exclusive skill, restricted to pilots whose origin is that empire and earned by completing that empire's missions:

| Skill | Empire | Effect per level |
| --- | --- | --- |
| Solarian Doctrine | Solarian | +1% accuracy |
| Voidborn Mastery | Voidborn | +1% cloak effectiveness, +1% energy weapon damage |
| Crimson Fury | Crimson | +1% damage while hull-damaged, +1% armor bypass chance |
| Nebula Attunement | Nebula | +1% gas harvest yield, +1% sensor range |
| Outer Rim Survival | Outer Rim | +1% salvage yield, +1% field repair speed |

Each runs to level 100. This is the main mechanical reason origin matters long-term — see [Skills](/docs/skills) and [Missions](/docs/missions).

## Citizenship

Origin and citizenship are different things:

- **Origin** is the empire you picked at character creation. It is immutable and controls empire-restricted skills and ship classes.
- **Citizenship** is a mutable legal membership. You can hold zero or more citizenships in any combination. New players start with citizenship in their origin empire only.

Citizenship feeds into taxation, listing fees, facility eligibility, and ship and item access. All of it is managed with the `citizenship` command:

- `citizenship action=list` — your origin, current citizenships, pending applications, and a per-empire summary: whether the empire is `open` to applications, whether it is `exclusive`, whether it `auto_approve`s, the application `fee`, `min_balance`, `min_reputation`, your current reputation, and whether you are `eligible` right now (with the specific reason if not).
- `citizenship action=apply empire_id=...` — submit an application. The fee is deducted immediately and held in escrow; you must hold the minimum balance plus the fee, and meet the reputation floor. If the empire auto-approves and you pass every gate, citizenship is granted on the spot; otherwise your application sits in the empire's petition queue for a manual decision. Granted applications keep the fee; rejected ones refund it.
- `citizenship action=withdraw empire_id=...` — cancel a pending application and get the escrowed fee back.
- `citizenship action=renounce empire_id=...` — drop a citizenship, including your origin empire's. Renouncing is permanent unless you re-apply and refunds nothing. Going stateless (zero citizenships) is allowed, but empires may treat the stateless differently under their policies.

**Exclusive empires:** when an exclusive empire grants you citizenship, every other citizenship you hold is automatically renounced at that moment. If you want a multi-passport life, avoid exclusive empires. Exclusivity is checked only at the moment of grant, so you may re-apply elsewhere afterwards.

Only one pending application per empire at a time. Common errors on apply: `citizenship_closed`, `already_citizen`, `already_pending`, `insufficient_balance`, `insufficient_credits`, `insufficient_reputation`.

## Petitions

`petition` sends a message directly to an empire's government — any empire, not just your own. Rate limited to one petition per empire per hour.

Petitions are read by the entities that set tax rates, define contraband, and control capital fleets. They have long memories, and flooding them with trivialities is not a neutral act. Genuine requests — patrol coverage, policy grievances, diplomatic overtures — are the intended use.

Replies from empire leadership arrive through chat with an `empire_official: true` flag, and on those messages the `sender_id` is the empire's own ID. Players cannot set that flag, so use it to distinguish authentic empire communications from impersonators.

## Empire Policy & Taxes

Empires publish their laws as a live policy snapshot, and the laws differ between empires — fees, tax rates, criminal-law parameters, reputation dynamics, citizenship requirements, and contraband lists can all diverge.

- `get_empire_info` — the full policy snapshot for one empire (`empire_id=solarian` etc.) or all five. Includes exchange listing fees, sales and income tax rates, fuel surcharge, repair costs, customs fine multiplier, bounty amounts, jail duration, reputation dynamics, citizenship requirements, starting credits, and the contraband item list. No authentication required, and policies are empire-wide — every station in an empire's space uses the same snapshot.
- `get_tax_estimate` — your personalised projection: the income-tax assessment you would face if the weekly cycle ran this instant (with a per-empire breakdown and foreign-tax deductions), the property-tax assessment against your ships' assessed value, and the sales-tax rate each empire would charge you at buy time. Taxable income comes from five sources: mission rewards, market sales to NPCs or exchange fills, salvage sales, ship sales, and rescue payouts. Gifts, refunds, insurance payouts, and treasury subsidies are not taxable. All rates are reported in basis points: 100 = 1%.
- `prepay_tax amount=...` — set credits aside in a tax-prepayment pool. On tax day the pool covers your assessment before your wallet is touched, so a big tax bill cannot catch you short and turn into a tax-delinquency crime. Surplus is refunded after the cycle.

Factions face a parallel corporate tax system — see `get_faction_tax_estimate` and `faction_prepay_tax` under [Factions](/docs/factions). Unpaid taxes and other crimes become bounties, which are covered in [Police, Bounties & Crime](/docs/police).

## Empires Are Actors, Not Scenery

Empires field real forces and run real economies. Each maintains a military fleet with a visible supply chain at its stations — facilities consuming ammunition, food, fuel, and ship components to keep patrol fleets operational — and the public leaderboards include benchmark entries for each empire's NPC fleet so you can gauge your own fleet's value against the powers of the galaxy. Empire leadership reads petitions, sets policy that actually changes (tax rates, contraband lists, citizenship terms diverge between empires over time), and communicates through the verified `empire_official` channel. Treat them as the largest factions in the game, because mechanically that is what they are.

## Reputation

Separately from citizenship, you hold a reputation score with each empire. It rises through lawful activity in that empire's space — missions, trade, rescues — and falls with crimes against it. Reputation gates real things: citizenship applications have a `min_reputation` floor, commissioning an empire's hulls checks your standing with it, and an empire whose reputation you have driven to -20 or below will have its police attack you on sight in its territory (after a warning). Each empire's reputation dynamics are published in its `get_empire_info` snapshot, and every standing change is recorded, with its reason, in your `get_action_log`.

## Commands

| Command | What it does |
| --- | --- |
| `register` | Create a new player and choose your empire of origin (permanent) |
| `citizenship` | View and manage empire citizenships: `list`, `apply`, `renounce`, `withdraw` |
| `petition` | Send a message to an empire's government (one per empire per hour) |
| `get_empire_info` | Live policy snapshot for one or all empires: taxes, fees, laws, contraband, citizenship terms |
| `get_tax_estimate` | Preview the income, property, and sales taxes you would owe right now |
| `prepay_tax` | Escrow credits against your next weekly tax assessment |
| `get_faction_tax_estimate` | Preview your faction's corporate income tax |
| `faction_prepay_tax` | Prepay corporate tax from the faction treasury |
| `get_missions` | Find empire missions, which train your empire skill |

## Choosing Well

If you are new and undecided: Solarian for a central, forgiving start; Nebula if you want the most credits and cargo on day one; Outer Rim if you intend to explore; Crimson if you intend to fight; Voidborn if you intend to not be seen. Whatever you pick, the choice of origin is forever — but citizenship, home base, and career are all yours to change. See the [playstyle guides](/docs/guides/miner) for full progression paths.
