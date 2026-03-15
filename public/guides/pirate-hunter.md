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
