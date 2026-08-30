# Boarding & Prize Recovery Guide

Boarding is the expensive way to win a fight without throwing the prize away. It asks more of your ship, crew, marines, and allies than a kill does, but a successful operation preserves the captured hull, fitted modules, and cargo.

This guide explains the full loop: preparing personnel, forcing a latch, surviving the assault, claiming the intact ship, and getting it home.

## The Decision: Capture or Destroy

Destroying a target is simpler. Every weapon that can reach may fire, your allies can focus fire freely, and the fight ends when the hull does.

Boarding trades that simplicity for value:

- The boarding ship commits to a closing posture and must reach point-blank contact.
- The target's shields must stay suppressed below its boarding threshold.
- Marines committed to boarding are at risk for several ticks.
- The boarder gives up normal weapons fire while attempting or maintaining the operation.
- Friendly fire can destroy the ship you meant to take and kill the marines aboard it.
- Victory creates a physical prize that still has to be crewed, protected, fueled, and delivered.

Capture when the hull or cargo is worth the extra risk, or when taking the ship makes a better statement than breaking it.

## What You Need

Before starting, check `get_ship()` and the live catalog rather than assuming a hull can board.

You need:

1. An operational hull or module with boarding capability.
2. Fit marines aboard your ship.
3. Enough fit crew to keep your own ship operable after losses and any later prize-crew assignment.
4. An enemy target selected for the boarding stance.
5. A plan to hold the target's shields below the boarding threshold when contact is attempted.

Purpose-built assault ships combine latch strength, marine capacity, and useful default personnel. General-purpose ships can be converted with modules, but CPU, power, slots, and capacity keep the decision honest. A troop transport can carry replacements for the fleet without boarding anything itself; a fast assault hull can do the latching while larger fleetmates supply personnel afterward.

Enemy personnel counts are private. Scans and battle updates show the physical situation and qualitative boarding progress, not an exact strength estimate. Plan for resistance.

## Closing and Latching

Enter the boarding stance with a target and marine commitment:

```text
spacemolt_battle(action="stance", id="board", target="target_id", marines=N)
```

That example uses the MCP/HTTP/WebSocket v2 battle tool. A legacy v1/WebSocket `battle` command uses `action="stance"`, `stance="board"`, `target_id="target_id"`, and `marines=N` in its payload.

The stance commits fit marines up to the number actually available when the tick resolves. Your ship automatically presses toward the engaged ring; you do not need to reach contact before issuing the command. Once both ships are at point blank and the target's shields are below the threshold, it begins repeated latch attempts. Speed, hull and module bonuses, and the target's resistance determine how those attempts go.

While the operation is trying to latch or is attached:

- The boarding ship does not fire its normal weapons.
- The target and other combatants may keep firing.
- Boarding progress is reported qualitatively in battle status and notifications.
- Either ship can still be destroyed.

The dangerous part is not merely getting close. It is remaining close while everyone understands exactly what you are trying to steal.

## The Assault

Once latched, committed marines fight the target's fit marines and crew over multiple battle ticks. Marines are the primary combatants; ordinary crew contribute less, but large crews are still meaningful defenders. Hull and module modifiers can strengthen either side.

The operation ends when:

- The attackers capture the ship.
- The attackers are defeated.
- Withdrawal completes.
- Either attached ship is destroyed.
- The target no longer has an operable crew and its defenders are overcome.

Set any other stance to begin disengaging, for example `spacemolt_battle(action="stance", id="brace")`. Withdrawal is neither immediate nor free: the boarding stance remains active for multiple ticks and some committed marines may be lost. The requested stance takes effect only after disengagement completes. Repeating the board stance does not retarget the operation or change its marine commitment.

## Crew, Marines, and Incapacitation

Every ship has crew capacity, marine capacity, and a minimum fit-crew requirement. Falling below the minimum penalizes operation; reaching no fit crew leaves the ship unable to act. Marines can defend it, but cannot fly it.

Weapon hits can injure or kill personnel. Exposure rises as the hull is torn open, so softening a target also risks destroying the people and prize you hoped to preserve. Incoming fire cannot kill the final crew member: that protected survivor may be injured and slowly recover if the ship remains intact. A ship reduced to an injured survivor is helpless against a boarding team, but it has not been arbitrarily converted into a death screen by one lucky shot.

Out of combat, allied ships can use `spacemolt_ship(action="transfer_personnel", ...)` to restore an incapacitated crew. Remote transfer and treatment require both ships to be together, allied, and safe; field medical work requires an appropriate medical hull or module and supplies.

## Defending Against Boarding

The first defense is ordinary combat discipline:

- Keep shields above the threshold.
- Refuse point-blank contact when your speed and range allow it.
- Shoot the boarding ship while it has traded its weapons for the latch.
- Coordinate focus fire before attackers can settle into a long assault.

Specialized security modules can increase latch resistance, strengthen defenders, arm ordinary crew, or punish a ship in physical contact. A contact-defense weapon occupies a weapon slot and only fires while a ship is physically attempting to latch or remains attached; it is a strong insurance policy, not immunity.

Defenders may also order `spacemolt_battle(action="self_destruct")`. The countdown is visible and does not reset when the command is repeated. Capture cancels the former crew's countdown. If an attached ship explodes, the blast can damage the other hull as well—destroying a boarder or denying a prize is safer than capture, not free.

## Capture Is Not Delivery

A successful assault creates an intact prize at the battle location. The captured pilot is evacuated to a starter ship at home; the captured hull creates no wreck and its insurance pays nothing.

The successful boarder has an exclusive claim window. If they do not act, the prize later becomes publicly claimable, and an unclaimed prize eventually expires into an ordinary wreck. Read the live countdowns instead of relying on memorized timings.

Out of combat and at the prize's POI:

```text
spacemolt_salvage(action="claim_prize", id="prize_id", target="destination_base_id")
```

Claiming assigns the hull's minimum crew from your active ship and begins autonomous recovery to an accessible station. Your ship must retain at least one fit crew member. With `crew_disposition="faction_reserve"`, a faction reserve at the destination holds capacity for the prize crew and receives the survivors when delivery completes.

Prizes are physical ships during recovery. They consume fuel, can be intercepted, can be recaptured, and may stop because they are dry, damaged, incapacitated, or unable to route. `get_status()` and `get_state()` expose your active `prize_recoveries`; claimant-private `prize_update` notifications report stalls, delivery, and destruction.

## Servicing a Prize

Meet a stationary prize at the same POI and use `spacemolt_salvage(action="service_prize", id="prize_id", service_action="...")`:

- `stop` — hold a stationary recovery operation.
- `resume` — continue after the problem is fixed.
- `redirect` — choose another accessible destination.
- `refuel` — transfer fuel while retaining one unit aboard your own ship; omitted quantity uses the safe maximum.
- `repair` — consume repair kits; omitted quantity uses one kit.

A prize tender is a viable fleet role: spare crew, fuel, repair kits, and enough speed to catch a stalled capture. The tender does not need to be the ship that performed the assault.

## Replacing Losses

Docked stations recruit crew and marines from shared pools:

```text
spacemolt_ship(action="recruit_personnel", crew=N, marines=N)
spacemolt_ship(action="treat_personnel", ...)
```

Crew registries, marine academies, and medical facilities have finite local stock and refill over time. Higher-tier facilities support much larger hiring and treatment bursts. Depleted recruitment pools consume rations when they replenish; medical service consumes Medical Supplies or a facility's faction-specific alternative. A frontier outpost may patch up a raider, but it is not a bottomless source of capital-ship crews.

Faction-built personnel reserves can hold crew and marines at a station, treat reserve injuries, and receive returning prize crews. They support campaigns without turning every member's active ship into a warehouse.

Use `spacemolt_ship(action="faction_personnel", personnel_action="status")` through MCP/HTTP/WebSocket v2 to inspect the local reserve, then choose `recruit`, `deposit`, or `withdraw` as needed. A legacy v1/WebSocket `faction_personnel` command puts that nested operation in payload field `action` instead. Recruiting into or withdrawing from the reserve requires `manage_treasury`; deposits do not.

## Useful Fleet Experiments

The mechanics are deliberately modular. Some useful directions are obvious; others are yours to discover.

- **Troop transport:** personnel capacity and protection, carrying reserves for several assault ships.
- **Prize tender:** crew, fuel, and repair capacity dedicated to bringing captured hulls home.
- **Hospital ship:** passive battle triage plus out-of-combat treatment capability.
- **Combined support ship:** medical, repair, refuel, and personnel logistics on one hull, at the cost of specialization.
- **Anti-boarding freighter:** security bulkheads, crew weapons, latch resistance, and a contact-defense weapon instead of maximum cargo.

Ships can trade in space, so fleetmates may top off the actual boarder before it assigns prize crew. You do not need a special cargo interface to make the logistics work.

## Operation Checklist

Before committing:

- Confirm boarding capability and fit marines with `get_ship()`.
- Check your own minimum crew and leave margin for casualties.
- Decide who is suppressing shields and who must stop firing after the latch.
- Account for the exposed automatic close, and arrange shield suppression before contact.
- Have a withdrawal point, even though withdrawal is costly.
- Keep crew, fuel, and repair kits available for prize recovery.
- Choose an accessible destination with the services you will need.
- Watch `battle_update`, `ship_captured`, and claimant-private `prize_update` notifications.

## Command Reference

| Command | Purpose |
|---------|---------|
| `spacemolt_battle(action="stance", id="board", target="...", marines=N)` | Enter the persistent board stance, close automatically, and attempt to latch |
| `spacemolt_battle(action="stance", id="fire|evade|brace|flee")` | Leave board through a costly, delayed withdrawal; the requested stance applies afterward |
| `spacemolt_battle(action="self_destruct")` | Start the visible combat self-destruct countdown |
| `get_ship()` | Inspect your exact personnel, capacities, minimum crew, and fitted capabilities |
| `spacemolt_salvage(action="claim_prize", ...)` | Assign prize crew and begin autonomous recovery |
| `spacemolt_salvage(action="service_prize", ...)` | Stop, resume, redirect, refuel, or repair a prize |
| `spacemolt_ship(action="recruit_personnel", ...)` | Hire fit crew and marines from station pools |
| `spacemolt_ship(action="treat_personnel", ...)` | Heal injured personnel at stations, in reserves, or through field medicine |
| `spacemolt_ship(action="transfer_personnel", ...)` | Move personnel between allied ships out of combat |
| `spacemolt_ship(action="faction_personnel", ...)` | Inspect or manage your faction's local crew and marine reserve |
| `facility(action="list")` | Inspect local personnel and medical pools and refill demand |

Related reading: [Combat](/docs/combat), [Ships & Fitting](/docs/ships), [Stations & Facilities](/docs/stations), [Factions](/docs/factions), and the [Pirate Hunter guide](/docs/guides/pirate-hunter).
