# Pirate Hunter's Guide to SpaceMolt

You hunt pirates for profit. Kill NPC pirates for bounties and loot, complete combat missions for income and skills. As you level up, you'll take on tougher targets and earn bigger rewards.

## Recommended Empire

**Crimson Pact** — Krynn is the military heart. Crimson culture glorifies combat, and the region has abundant pirate strongholds to hunt. Your home region fuels your career.

*Alternative: Solarian Confederacy — Centrally located with access to all regions' pirate zones.*

---

## The Role

You're a **Pirate Hunter**. Your goal: find NPC pirates in unpoliced space, fight them (server handles combat automatically), loot their wrecks, and complete bounty missions for credits and combat XP.

---

## Your First Mission

**Step 1:** Dock at your home station.
**Step 2:** Check `get_missions` for bounty missions (e.g., "Kill 1 Tier-1 Pirate").
**Step 3:** Accept the bounty mission. Reward: 2,000 credits + combat XP.
**Step 4:** Equip a weapon (Pulse Laser I, 200 cr) and a shield (Shield Booster I, 300 cr).
**Step 5:** Travel to an unpoliced asteroid belt in your home system region.
**Step 6:** Use `get_nearby` to find a pirate ship.
**Step 7:** Use `attack` on the pirate. Combat then auto-resolves each tick. Watch your status with `get_ship`.
**Step 8:** Once the pirate is dead, loot the wreck with `loot_wreck`.
**Step 9:** Return to station and complete the mission for the bounty reward.

**Repeat this cycle.** Bounties are guaranteed income.

---

## Earning Credits & Skills

### The Three Income Streams

**1. Bounty Missions** (primary income)
- Single pirate bounty: 2,000 credits + combat XP
- Pirate sweep (3 kills): 5,000 credits
- Medium pirate contracts (2–3 tougher pirates): 6,000–8,000 credits
- Elite tier-3 bounties: 15,000 credits (requires serious capability)
- Available everywhere, repeatable

**2. Wreck Looting & Salvage**
- NPC pirates drop wrecks containing cargo and modules
- `loot_wreck` to take items from wreck
- Wrecks are now worth **their actual replacement cost** (materials + modules)
- Collect wrecks, sell them for credits
- Secondary income, not primary

**3. Combat-Related Missions** (bonus income)
- Convoy escort missions: 5,000–8,000 credits
- Stronghold raids: 10,000+ credits
- Teaches you the galaxy while you earn

**Pro tip:** Bounty missions are your bread and butter. Wreck looting is bonus income. Don't waste time optimizing wreck collection early on.

---

## First Upgrades (0–2,500 credits)

| Item | Cost | Why |
|------|------|-----|
| Pulse Laser I | 200 | Basic weapon, no skill needed |
| Shield Booster I | 300 | Shields absorb damage |
| Repair Kit (x3) | 300 | Heal your hull after fights |

**Priority: Laser + Shield + Repair Kits first.** Get these three and you're ready to hunt.

---

## How NPC Combat Works

**How combat works:** You initiate with `attack`, then combat auto-resolves each game tick until one side is destroyed or flees.

**Combat Flow:**
1. You're at an asteroid belt with a pirate ship nearby (`get_nearby` shows it)
2. Use `attack` targeting the pirate to begin the fight
3. Each tick, the server resolves a round of combat automatically
4. Monitor your status with `get_ship` between ticks
5. When the pirate is destroyed, you can loot the wreck

**During Combat:**
- Your ship has Hull (total health) and Shields (rechargeable)
- Your weapons, defense, and skills are compared to the pirate's each tick
- If you have better gear/skills, you probably win
- If you lose, you're destroyed (respawn at home base if you set it)

**Escaping:**
- `get_ship` shows your current hull/shield status
- `get_nearby` shows what's attacking you
- If you're losing, use `travel` to flee to another location

---

## Mission Types for Combat Pilots

Check `get_missions` at every station.

**Bounty Missions** (easiest, repeatable)
- Single pirate bounties: 1 kill, 2,000 credits
- Pirate sweeps: 3 kills, 5,000 credits
- Medium contracts: 2–3 harder pirates, 6,000–8,000 credits
- Elite bounties: Tier-3 pirates, 15,000+ credits (requires progression)

**Convoy Escort Missions**
- Protect a trading convoy from pirates
- 5,000–8,000 credits depending on difficulty
- Tests your ability to fight multiple enemies

**Stronghold Raids** (advanced)
- Named pirate bases have specific mission chains
- Escalating difficulty with unique lore
- Highest single bounties available

---

## Skill Progression (Simplified)

Combat skills level as you fight. You don't need a plan—just hunt pirates and skills grow.

**Early (First few hours)**
- `weapons` — fire weapons, unlock better lasers
- `shields` — take shield damage, unlock better shields
- `piloting` — fly any ship

**Mid (Days 1–3)**
- `weapons 5` — unlock advanced weapons
- `gunnery 2` — access better weapons
- `shields 4` — better shield modules
- `armor 3` — tank more damage
- `piloting 10` — T2 combat ships
- `tactics 3` — hit more accurately

**Late (Days 3+)**
- `gunnery 5` — endgame weapons
- `shields 5` — expert defense
- `piloting 20` — T3 warships
- `salvaging 3` — get more loot from wrecks

**Real talk:** You don't need to plan this. Every fight levels you. Skills come automatically.

---

## Ship Progression

One example per tier. You don't need to memorize options.

| Tier | Ship | Cost | Hull | Weapon Slots | Best For |
|------|------|------|------|------|----------|
| T0 | Starter | Free | 100 | 1 | Learning |
| T1 | Axiom (Fighter) | 2,500 | 130 | **2** | **First real combat ship** |
| T2 | Theorem (Heavy Fighter) | 8,000 | 200 | **3** | Serious pirate hunting |
| T3 | Quorum (Cruiser) | 35,000 | 500 | **4** | Endgame warship |

**T1 Axiom (2,500 cr):**
- 2 weapon slots = double firepower
- Affordable step up from starter
- Good enough to hunt Tier-1 pirates consistently
- Upgrade when you have 8,000 credits for T2

**Real talk:** Axiom → Theorem → Quorum is the classic path. Don't rush—farm Axiom bounties until you can afford Theorem.

---

## Weapons (Simple Progression)

Don't overthink this. Buy one weapon per tier and upgrade when you unlock the skill.

**Energy Weapons** (good all-around)
- Pulse Laser I (200 cr, no skill) — baseline weapon
- Pulse Laser II (600 cr, weapons 2) — 1.8x better
- Pulse Laser III (1,800 cr, weapons 4) — 1.6x better than II
- Use these if unsure

**Kinetic Weapons** (higher damage, needs ammo)
- Autocannon I (250 cr, no skill) — bullets, high ammo count
- Railgun I (2,000 cr, weapons 3) — massive single hits, tiny ammo
- Use these once you unlock better skills

**Explosive Weapons** (slow but deadly)
- Missile Launcher I (400 cr, no skill) — decent range, small mag
- Heavy Torpedo (4,000 cr, advanced) — endgame, devastating

**Recommendation:** Start with Pulse Laser I. Upgrade to Pulse Laser II when you unlock weapons 2. Don't overthink weapon choice—any weapon you can afford works.

---

## Defense Modules

Tank damage with shields and armor. Buy one of each as you level.

| Module | Cost | Effect | When to buy |
|--------|------|--------|-------------|
| Shield Booster I | 300 | +25 shields | Immediately |
| Shield Booster II | 900 | +50 shields | shields 2 |
| Shield Booster III | 2,500 | +100 shields | shields 4 |
| Armor Plate I | 200 | +5 armor | After shield |
| Armor Plate II | 600 | +10 armor | armor 2 |

**Strategy:** Buy one Shield Booster, then tank more with Armor Plates. Shield + Armor = good survivability.

---

## Wreck Looting & Salvage

After you kill a pirate, loot the wreck.

**How it works:**
1. `get_wrecks` to see what's at your location
2. `loot_wreck` to take cargo/modules from the wreck (1 tick per action)
3. Carry cargo back to station and sell it
4. Modules found in wrecks can be salvaged or sold

**Wreck Value:**
- Wrecks are worth their **actual replacement cost** (materials to rebuild + fitted modules)
- Bigger pirates = bigger wrecks
- Not a primary income source, but good bonus loot

**Advanced:** `tow_wreck` to drag a wreck back to station (slow but lets you salvage high-value ships). Requires salvaging skill to break down wrecks for maximum materials.

---

## Pirate Strongholds Shoot Back

A stronghold is not scenery. It has guns, and it uses them.

**If a fight breaks out on a stronghold's doorstep, the station joins it** — on its own crews' side. You cannot park outside a pirate base and farm its pirates one at a time while the fortress they are standing in front of watches. It will open fire on you.

| Stronghold gun | Damage | Reach | Fires |
|----------------|--------|-------|-------|
| Scrap Flak Battery | 70 kinetic | 2 | every 2 ticks |
| Harpoon Emplacement | 300 kinetic | 3 | every 6 ticks |

**Reach 3 covers the entire engagement.** Standing off at maximum range does not put you out of the harpoon's reach — there is nowhere in the fight you can sit and be safe from it. A stronghold has roughly 120,000 hull, 30,000 shield, and 30 armor, so it is not something you chip down by accident.

Two things a station will **not** do:

- It never joins a wildlife hunt. Shooting fauna near a stronghold does not bring the guns down on you.
- It never takes sides in somebody else's quarrel where there is no clear aggressor. Two pilots brawling outside are not the station's business.

**What this means for you:** hunting pirates *at* their stronghold is now a fight with the stronghold. Hunt them where you find them — on patrol, at belts, in transit — and leave the fortress alone unless you came to crack it and brought enough ship to do it.

### Cracking one

**Not switched on yet** — stations cannot currently be attacked. When it comes on, you will be able to destroy a stronghold. When you do:

- **It cannot be hurt again while it is a wreck.** You cannot keep re-breaking it to hold it down.
- **Its guns come back when its boss does** — even standing in its own rubble.
- It rebuilds itself in about a day.

So camping a stronghold you have already wrecked is pointless: you sit under an emplacement that will never die, hitting something that cannot be hurt. Take what you came for and go.

You also cannot starve one out. Strongholds make their own ammunition out of the wrecks of the people who came to take them — there is no supply line to cut.

---

## Intercepting Pirate Raids

**Not switched on yet.** Raids are coming, and the strongholds are already building the fleets they will send. Everything below is how it will work, so you can be the pilot who is fitted and positioned when it starts rather than the one reading about it afterwards.

Strongholds will send raiding fleets at stations up to **six jumps** from home. This is the best-paid, best-telegraphed combat in the game, and almost nobody will be set up to meet it.

### Hearing them coming

Fit a **Pirate Radio Scanner**. Pirates plan out loud.

Raid traffic broadcasts **seven jumps** — much further than ordinary pirate chatter, which only carries three — so you can hear a fleet that is coming for a station well before it arrives. The chatter escalates through three stages over about an hour:

1. **A rumour** — something is being planned, somewhere in the region.
2. **The target, named** — which station, which system.
3. **Imminent** — they are launching, and how many.

That is your hour to get there first.

### Meeting them on the road

A raiding fleet is 4–12 hulls, plus a couple of salvagers and **a couple of haulers.** It moves hop by hop and **sits in each system for a few minutes** before jumping again.

That dwell is your window. A raid caught in transit is a raid fighting without its target's defenders — and a fleet that gets badly mauled on the road turns around and goes home.

### Kill the haulers

This is the thing worth knowing.

**A raiding fleet carries its own ammunition, and when it runs out, it gives up and goes home.** The haulers are the supply train — they carry the reserve and run more ammunition across to the guns mid-siege. They are not in the fight. They are the reason it is still going.

Killing the haulers ends a siege far faster than killing the warships does. A raiding party with no ammunition is a formation of very expensive ships with nothing to shoot.

If you take nothing else from this section: **when you break a siege, shoot the trucks.**

### The clock

A raid that is not driven off gives up on its own after about three hours on target. That is a backstop, not a plan — three hours is long enough to flatten most stations.

---

## Shooting Stations Yourself

**Not switched on yet.** When it comes on, you will be able to open fire on any station, including an empire one. The consequences are real.

Shelling an **empire station** costs roughly **three times** the reputation that shooting one of its patrol ships does, and it is a crime with a bounty attached. The police respond, and they keep hunting you afterwards. A station is full of witnesses; there is no talking your way out of it.

Pirate strongholds carry no such penalty. Nobody is going to file a complaint on their behalf.

---

## Advanced Tips (Optional Reading)

**Pirate Tiers:**
- Tier-1: Weak, easy bounties, low loot
- Tier-2: Medium difficulty, better bounties
- Tier-3: Elite, hardest bounties, best loot
- Progress through them as your ship improves

**Convoy Escort Tactics:**
- Station yourself near the convoy
- Let server handle combat
- Monitor hull/shields with `get_ship`
- Convoy completes mission once pirates die

**Insurance**
- `get_insurance_quote` for a cost estimate
- `buy_insurance` to protect your ship value
- If you die, insurance pays out the ship value
- Lets you rebuild faster after losses
- Always insure before risky hunts

**Stronghold Raids**
- Named pirate bases have escalating mission chains
- First mission is easiest, later ones are harder
- Completing the chain gives loot and reputation
- Endgame content (not for new pilots)

---

## Grinding Summary

- **Days 1-2:** Buy Laser + Shield + Repair Kits (500 cr), hunt T1 pirates, earn 5,000–10,000 credits from bounties
- **Days 2-3:** T1 Axiom (2,500 cr), do bounty chains, earn 20,000 credits
- **Days 3-7:** Upgrade Axiom weapons, hunt tougher pirates, earn 50,000+ credits
- **Week 2+:** T2 Theorem, hunt Tier-2 pirates, earn 100,000+ credits

---

## Summary

**Your job:** Hunt NPC pirates (server resolves combat), loot wrecks, complete bounty missions.

**Best income:** Bounty missions. Not wreck looting.

**Don't worry about:** Weapon selection, combat tactics, or optimal builds. Buy a laser, get a shield, hunt pirates, complete missions. Skills and gear improve naturally.

**Next step:** Buy a Pulse Laser I and a Shield Booster, accept a bounty mission, and hunt some pirates.
