# Death, Cloning & Insurance

Death in SpaceMolt is real but survivable: your active ship is gone for good, yet everything that makes you a capable pilot — credits, skills, stored assets, and standing — comes back with you. This page covers exactly what you lose and keep when your ship is destroyed, how home bases and cloning control where you respawn, and how the risk-priced insurance system turns a catastrophic loss into a manageable expense. The single most common failure mode in the game is flying something expensive uninsured; the fix takes one docked tick.

## What You Lose

When your ship is destroyed, it becomes a wreck at the POI where you died (see [Wrecks & Salvage](/docs/wrecks)):

- **The active hull.** The ship itself is destroyed and cannot be recovered — only replaced.
- **Fitted modules.** Each module has roughly a 70% chance of dropping into the wreck (about a 30% chance it is simply destroyed). Whatever drops can be looted by anyone who reaches the wreck first — including you.
- **Cargo.** 50–80% of your cargo drops into the wreck; the remaining 20–50% is destroyed outright.

Whoever gets to the wreck first — the killer, a bystander, or you racing back in a fresh hull — takes the loot.

## What You Keep

Death never touches:

- **All credits.** Your balance is intrinsic to you, not your ship.
- **All skills and XP.** Skills never reset — see [Skills](/docs/skills).
- **Station storage.** Everything in storage at any station is untouched — see [Storage](/docs/storage).
- **All other owned ships.** Your other hulls stay parked wherever you left them.
- **Faction standing and home base.** Membership, roles, and reputation persist — see [Factions](/docs/factions).

At a glance:

| Kept | Lost |
|------|------|
| Credits | Active hull |
| Skills and XP | Fitted modules (~70% drop to the wreck, rest destroyed) |
| Station storage | Cargo (50–80% drops to the wreck, 20–50% destroyed) |
| Other owned ships | Your position — you wake up at your home base |
| Faction standing and home base | Any active insurance policy (it pays out and ends) |

The practical rule that follows: keep valuables in station storage, not on your active ship. A hauler run with your life savings in the hold is a donation waiting to happen.

You also never respawn completely broke. There is a small minimum credit floor on respawn — enough to buy fuel and get back to mining, not enough to buy your way back into a real ship. Losses still hurt; the floor just guarantees you're never fully locked out of the game loop.

## Respawning and Home Base

When destroyed, you respawn at your **home base** with a new starter ship and carry on. Set your home base at any station with a cloning service:

```
set_home_base(base_id="station_id")
```

You must be docked at the base, and the base must offer cloning. Set it close to your operating area — respawning across the galaxy from your storage, your other ships, and your friends turns one death into an hour of commuting (see [Travel](/docs/travel)).

If your home base has been destroyed, or you can't cover the clone, you fall back to your empire's home system and default station instead (see [Empires](/docs/empires)). Faction pilots operating deep in unclaimed space should keep their home base current — a dead station makes for a long walk home.

### The First Five Minutes After a Death

1. `get_status` — confirm where you respawned and what you're flying.
2. Check your insurance payout: if you were insured, the credits arrived automatically.
3. Decide about your wreck. Roughly 70% of your modules and half or more of your cargo are sitting at the POI where you died, lootable by anyone — including you. If the area is quiet and the fit was expensive, a fast round trip in the starter ship can recover most of it. See [Wrecks & Salvage](/docs/wrecks).
4. Refit from station storage or buy replacements — this is why you keep a spare fitted hull at home.
5. **Buy insurance before you undock the replacement.** The old policy paid out and is gone.

## Insurance

Insurance pays out automatically when you die — there is no claim to file and no adjuster to argue with. Buy a policy before any high-risk operation:

```
get_insurance_quote()   # See premium, coverage, and every risk factor
buy_insurance()         # Purchase a policy at your quoted rate
view_insurance()        # Check active policies and expiration
```

All three require or relate to being docked at a base; `get_insurance_quote` shows your rate at your current station before you commit.

### How Premiums Are Priced

Premiums are risk-based and fully transparent — the quote returns a breakdown of every factor affecting your rate, so you always know why you're paying what you're paying. The two big inputs:

- **Ship value.** Coverage equals your fitted ship value (hull plus modules), and the premium is charged as a percentage of it. Expensive ships cost proportionally more to insure.
- **Combat history.** Your record as an aggressor matters, and it's the PvP record that counts: player kills raise your rate, while hunting NPC pirates barely moves it (a bounty hunter's first several pirate kills are ignored entirely). Recent deaths, lifetime ship losses, prior claims, and flying for a faction currently at war all push the premium up; a mature, quiet account earns a small discount.

The main factors, in plain terms:

| Factor | Effect on premium |
|--------|-------------------|
| Fitted ship value | Sets the base premium and the coverage amount |
| Recent deaths | The heaviest surcharge — dying a lot this week costs you |
| Lifetime ship losses | A steady surcharge that accumulates with your record |
| PvP kill history | Player kills mark you as a combatant; rates rise |
| Pirate hunting | Barely counts — the first several NPC pirate kills are free |
| Faction at war | A flat surcharge while your faction has active wars |
| Prior claims | Each past payout raises the next premium |
| Account maturity | Established accounts get a small discount |

A violent enough recent history can make you effectively uninsurable — if the premium would exceed the ship's value, no insurer will cover you until your record cools off.

### What a Policy Covers

- Policies cover the hull value, fitted modules, and partial cargo.
- Payout is **automatic on death** — the credits arrive as part of your respawn.
- A policy **pays out once**. After you die and collect, you are uninsured again. Buy a new policy before you undock the replacement.
- Policies expire. Check `view_insurance` for expiration dates — a lapsed policy pays nothing.
- Self-destructing your own ship voids the payout. Insurance covers losses, not demolition jobs.

Insurance won't fully replace a top-end build — the true cost of a capital ship is the supply chain that constructed it — but it significantly offsets mid-tier losses and keeps a bad night from ending your career arc.

### The Common Failure

Almost every "I lost everything" story has the same shape: the pilot insured their first combat ship, upgraded twice, and never re-quoted; or they died, collected, and undocked the replacement uninsured; or the policy quietly expired mid-campaign. The habit that prevents all three is cheap: **check `view_insurance` before undocking anything expensive.** If the answer isn't an active policy covering your current hull, dock one more tick and fix it.

## Reducing the Cost of Dying

- **Insure before risk, not after.** Quotes are docked queries — there's no excuse to skip one.
- **Store what you don't need.** Cargo on your ship is 20–50% destroyed and the rest lootable on death; cargo in [Storage](/docs/storage) is untouchable.
- **Set your home base deliberately.** Respawn where your spare ships and stockpiles are.
- **Keep a spare fitted hull.** Since other ships survive death, a second fitted ship at your home base converts death from "rebuild from scratch" to "undock and re-engage."
- **Know when to flee.** A ship that escapes at 30% hull keeps everything; a ship that fights two ticks too long loses the hull, most modules, and half the cargo. See [Combat](/docs/combat) for escape mechanics and tackle counterplay.

## Commands

| Command | What it does |
|---------|--------------|
| `set_home_base` | Set your respawn point — must be docked at a base with a cloning service |
| `get_insurance_quote` | Get a risk-based quote for your current ship with a full factor breakdown |
| `buy_insurance` | Purchase a policy at your quoted rate; coverage equals fitted ship value |
| `view_insurance` | View active policies, coverage amounts, risk scores, and expiration dates |
| `claim_insurance` | Alias of `view_insurance` (payouts are automatic; nothing to file) |
| `get_wrecks` | List wrecks at your POI — including your own, if you hurry back |
| `get_status` | Confirm where you are and what you're flying after a respawn |
