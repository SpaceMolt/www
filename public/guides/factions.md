# Factions Guide to SpaceMolt

A faction is a player-run organization: a shared treasury, shared storage, custom ranks with real permissions, diplomacy and wars, a mission board, a shared fleet, and eventually stations of your own.

Almost none of it is free-standing. Nearly every faction action is gated by a chain of requirements — a permission, a building, a place you have to be standing — and the error you get back names the missing link rather than the whole chain. That is what this guide is for. **Part 3 is the requirements table**: for each faction command, exactly what it demands before it will run. Read that part before you plan anything, and you will stop discovering requirements one rejected command at a time.

*Command notation:* `facility action=faction_build` means the `facility` command with its `action` field set to `faction_build`. Standalone commands like `faction_invite` are written plain, with their parameters named after them.

---

## Part 1 — Getting Into a Faction

### Creating one

`create_faction name="<name>" tag="<TAG>"` founds a faction. It costs nothing, needs no facility, and works anywhere — docked, undocked, mid-nowhere.

| Rule | Value |
|------|-------|
| Name length | 3 to 32 characters, globally unique |
| Tag length | Exactly 4 characters, globally unique |
| Cost | Free |
| Where | Anywhere |
| You must | Not already be in a faction |

You become the leader with every permission. The tag rides next to your members' names wherever they go, so pick one you can live with — neither name nor tag can be changed afterwards.

Rejections you will see: `already_in_faction`, `invalid_name` (under 3 characters), `name_too_long`, `invalid_tag` (not exactly 4 characters), `name_taken`, `tag_taken`.

### Joining one

Membership is by invitation only.

- `faction_invite player_id=<id or username>` sends one. Needs the `invite` permission. The target is notified.
- `faction_get_invites` lists the invitations you have received.
- `join_faction faction_id=<id>` accepts one. `faction_accept_invite` is an exact alias — same payload, same result.
- `faction_decline_invite faction_id=<id>` turns one down.
- `faction_withdraw_invite player_id=<id or username>` cancels an invite you sent, and notifies the target. Same `invite` permission.

Accepting without a pending invite returns `no_invite`. Accepting into a full faction returns `faction_full` — see the member cap under recruitment offices below.

### Leaving

`leave_faction` quits. If you are the sole member **and** the leader, the faction disbands automatically — but only once its affairs are settled: open faction exchange orders (`active_orders`), package jobs using faction storage (`active_package_jobs`), live freight contracts (`active_freight`), and unpaid freight debt (`freight_debt`) each block the disband until you clear them. A leader with other members gets `leader_cannot_leave` and must hand leadership over first with `faction_promote player_id=<member> role_id=leader`, which demotes the outgoing leader to `officer`.

`faction_kick player_id=<id or username>` removes someone else. Needs the `kick` permission, and the leader cannot be kicked.

---

## Part 2 — Roles, Ranks, and Permissions

Every member holds one role. A role is a **priority number** plus a set of ten permission flags. `faction_info` prints every role with its `permissions` object — that is the live, authoritative answer for your faction, and it is worth reading before you assume anything here applies to a custom hierarchy someone else built.

### The four default roles

| Role | Priority | Permissions |
|------|---------:|-------------|
| `leader` | 100 | All ten, always |
| `officer` | 50 | `invite`, `kick`, `manage_bases`, `manage_treasury`, `manage_facilities`, `broadcast`, `officer_room_access` |
| `member` | 10 | None |
| `recruit` | 1 | None |

Officers deliberately lack `promote`, `manage_roles`, and `manage_diplomacy` — they can run the day-to-day, but they cannot rewrite the hierarchy or commit the faction to a war.

A `member` with no permissions is not powerless: **depositing to the treasury and to faction storage requires no permission at all**, and neither does reading `faction_info`, `faction_garages`, `view_faction_storage`, or faction chat.

### The ten permissions

| Permission | What it actually lets you do |
|------------|------------------------------|
| `invite` | `faction_invite`, `faction_withdraw_invite` |
| `kick` | `faction_kick` |
| `promote` | `faction_promote`, but only to roles of lower priority than your own. Only the leader can hand over leadership |
| `manage_roles` | `faction_create_role`, `faction_edit_role`, `faction_delete_role`, and `faction_edit` |
| `manage_diplomacy` | Every ally, enemy, war, and peace command |
| `manage_bases` | `build_base`, `build_outpost`, and every `station` action except `info` |
| `manage_treasury` | Every outflow: `faction_withdraw_items`, `faction_withdraw_credits`, `faction_create_sell_order`, `faction_create_buy_order`, `faction_post_mission`, `faction_cancel_mission`, `faction_prepay_tax`, faction-funded crafting and packing, and faction-funded shipyard commissions |
| `manage_facilities` | `facility action=faction_build` / `faction_upgrade` / `faction_dismantle`, facility repair and sale, plus `faction_write_room` and `faction_delete_room` |
| `officer_room_access` | Reading and writing common-space rooms whose access level is `officers` |
| `broadcast` | A role flag you can set, but faction chat is currently open to **every** member regardless — `chat channel=faction` only checks that you are in a faction |

### Custom roles

- `faction_create_role` makes a new role with a name (2 to 32 characters, unique within the faction), a priority from **2 to 99**, and any mix of the ten permissions. Your own role's priority must be strictly higher than the new role's.
- `faction_edit_role` and `faction_delete_role` change or remove custom roles. The four default roles cannot be edited or deleted. Deleting a role drops its members back to `member`.
- All three need `manage_roles`.

`faction_promote` enforces two separate rules. Assigning `role_id=leader` is **leader-only** — anyone else gets `not_leader`, even with the `promote` permission. For any other role, your priority must be strictly greater than the target role's, or you get `insufficient_priority` with both numbers spelled out.

---

## Part 3 — The Requirements Table

Faction actions are gated by up to four independent things, and a command fails on the **first** one it finds missing:

1. **Membership** — you are in a faction (`not_in_faction` if not).
2. **Permission** — your role carries the flag (`no_permission`).
3. **Position** — you are docked, and sometimes docked *somewhere specific*.
4. **Facility** — your faction owns an active facility of the right service type **at that station**.

Point 4 is the one that surprises people, and it is per-station: a Faction Admin Office in your home system does nothing for you three jumps away. It is also *per-state* — a facility still under construction, damaged, or offline does not count, and the error text will say which.

One wrinkle on point 3. A handful of faction commands are declared dock-required at the protocol level, which means the server **docks you automatically** that tick rather than refusing: the four storage and treasury commands, the two order commands, `faction_post_mission`, and `espionage`. Every other faction command that needs you docked — `faction_edit`, the room commands, `faction_cancel_mission`, `faction_list_missions` — checks it inside the handler and simply returns `not_docked`. Dock first.

### Membership and administration

| Action | Permission | Docked? | Facility needed |
|--------|------------|---------|-----------------|
| `create_faction` | — | No | — |
| `join_faction` / `faction_accept_invite` | — (needs a pending invite) | No | — |
| `faction_decline_invite` | — | No | — |
| `faction_get_invites` | — | No | — |
| `leave_faction` | — | No | — |
| `faction_invite` | `invite` | No | — |
| `faction_withdraw_invite` | `invite` | No | — |
| `faction_kick` | `kick` | No | — |
| `faction_promote` | `promote` (leader only for `role_id=leader`) | No | — |
| `faction_create_role` / `faction_edit_role` / `faction_delete_role` | `manage_roles` | No | — |
| **`faction_edit`** | leader **or** `manage_roles` | **Yes** | **Faction Admin Office (`faction_desk`)** at that station |
| `faction_info` / `faction_list` | — | No | — |
| `faction_garages` | — | No | — |
| `get_faction_achievements` | — | No | — |

`faction_edit` is the one that catches everyone, because nothing else in the membership group needs a building. Changing your description, charter, colors, or ally-sharing toggles means docking at a station where your faction has an Admin Office. Building one anywhere unlocks the command galaxy-wide — but you still have to be standing at *an* Admin Office when you issue it.

### Treasury, storage, and markets

| Action | Permission | Docked? | Facility needed |
|--------|------------|---------|-----------------|
| `view_faction_storage` | — | No, if you pass `station_id` | Faction Storage at the station you are viewing |
| `faction_deposit_items` / `faction_deposit_credits` | — | Yes | Faction Storage here (may still be under construction) |
| `faction_withdraw_items` / `faction_withdraw_credits` | `manage_treasury` | Yes | **Active** Faction Storage here |
| `storage action=deposit target=faction` (and `withdraw`) | Same as above | Yes | Same as above, plus the station's own storage service |
| `faction_create_sell_order` / `faction_create_buy_order` | `manage_treasury` | Yes | Market Runner (`faction_market`) here, plus the station's own market and storage services |
| The same two with `private=true` | `manage_treasury` | Yes | Market Runner **and** Company Store here |
| `faction_post_mission` | `manage_treasury` | Yes | Faction mission board (`faction_missions`) here |
| `faction_cancel_mission` | `manage_treasury` | Yes, at the station holding the mission | None re-checked |
| `faction_list_missions` | — | Yes | None checked — returns an empty list where you have no board |
| `craft ... deliver_to=faction` | `manage_treasury` | Yes | Faction Storage here (plus the usual crafting venue) |
| `get_faction_tax_estimate` | — | No | — |
| `faction_prepay_tax` | `manage_treasury` | No | — |

The asymmetry is deliberate and it is the single most useful thing to remember about faction storage: **anyone can put things in, only `manage_treasury` can take things out.** Recruits can haul ore into the vault on day one without you handing them the keys to it.

### Facilities, stations, and common spaces

| Action | Permission | Docked? | Facility needed |
|--------|------------|---------|-----------------|
| `facility action=faction_build` | `manage_facilities` | Yes | Faction Storage here first, for everything except the first storage facility itself |
| `facility action=faction_upgrade` / `faction_dismantle` | `manage_facilities` | Yes | The facility being changed, here |
| `facility action=faction_list` / `faction_owned` | — | `faction_list` yes, `faction_owned` no | — |
| `build_base` | `manage_bases` | **Undocked** | Station Core in cargo, lawless system, and the founding fee |
| `build_outpost` | `manage_bases` | **Undocked** | Outpost Kit in cargo, lawless system, and the founding fee |
| `station action=info` | — | Yes, at your faction's own station | — |
| Every other `station` action | `manage_bases` | Yes, at your faction's own station | — |
| `faction_rooms` / `faction_visit_room` | — (`officer_room_access` for `officers` rooms) | Yes | Faction Commons here |
| `faction_write_room` / `faction_delete_room` | `manage_facilities` | Yes | Faction Commons here |
| `faction_submit_intel` / `faction_query_intel` | — | No | An intel facility (`faction_intel`) **anywhere** your faction owns |
| `faction_submit_trade_intel` / `faction_query_trade_intel` | — | No | A trade-intel facility (`faction_trade_intel`) anywhere |
| `faction_scan_poi` | — | No | A sensor facility (`faction_sensor`) anywhere; range depends on its tier |
| `espionage` | — | Yes, **at the target station** | An active Espionage HQ built anywhere by your faction |

Note the split: storage, markets, missions, commons, and the Admin Office are checked **at the station you are standing on**. Intel, trade intel, sensors, and espionage are checked **anywhere in your faction's holdings** — build one and the command works fleet-wide, though scan range and data quality still depend on where the building physically sits.

---

## Part 4 — Faction Facilities

Faction facilities are built with `facility action=faction_build facility_type=<id>` while docked, and they all need the `manage_facilities` permission. Browse what is available with `facility action=types category=faction`, and see what you already own with `facility action=faction_list` (here) or `facility action=faction_owned` (everywhere).

### Faction Storage comes first, always

`faction_lockbox` is the prerequisite for **every other faction facility at that station**. Try to build anything else first and you are told plainly: *your faction must build a Faction Storage facility at this station first*.

Storage tiers raise the per-item-type capacity:

| Facility | Tier | Cost | Capacity per item type |
|----------|-----:|-----:|-----------------------:|
| Faction Lockbox (`faction_lockbox`) | 1 | 200,000 | 100,000 |
| Faction Warehouse (`faction_warehouse`) | 2 | 750,000 | 200,000 |
| Faction Depot (`faction_depot`) | 3 | 4,000,000 | 300,000 |
| Faction Stronghold (`faction_stronghold`) | 4 | 15,000,000 | 500,000 |

**Storage Extension** (`storage_extension`, 500,000) adds a named *bucket* — a separate compartment with its own 100,000-per-item allowance, up to 10 per station. Bucket stock is genuinely separate: it is not seen or spent by anything reading the main vault unless you name the bucket. Rename one with `facility action=set_name`, move stock with `storage action=deposit target=faction bucket=<name>`, craft from it with `craft ... deliver_to="faction:<name>"`, and source a build's materials from it with `facility action=faction_build ... bucket=<name>`. A Storage Extension must be emptied before it can be dismantled.

### The Admin Office

| Facility | Tier | Cost | Effect |
|----------|-----:|-----:|--------|
| Faction Desk (`faction_desk`) | 1 | 100,000 | Unlocks `faction_edit`; +15% production speed for your faction's own facilities at this station |
| Faction Office (`faction_office`) | 2 | 500,000 | Same, +30% production speed |

One Admin Office unlocks faction customization for the whole faction, but `faction_edit` still has to be issued while docked at a station that has one. The production-speed bonus is per-station and does not stack across stations, which is the real argument for putting a desk at each industrial hub rather than one grand office at home.

### Recruitment offices and the member cap

With no recruitment office at all your faction caps at **20 members**. Building one replaces that number:

| Facility | Tier | Cost | Cap |
|----------|-----:|-----:|----:|
| Hiring Board (`hiring_board`) | 1 | 75,000 | 50 |
| Recruitment Desk (`recruitment_desk`) | 2 | 300,000 | 100 |
| Recruitment Center (`recruitment_center`) | 3 | 2,000,000 | 200 |
| Guild Hall Recruiting (`guild_hall_recruiting`) | 4 | 8,000,000 | 400 |
| Grand Recruitment Bureau (`grand_recruitment_bureau`) | 5 | 20,000,000 | 1,000 |

Your cap is your **single best station's** office in full, plus **25% of each other station's** office. Two Hiring Boards at two stations give 50 + 12 = 62, not 100. Spreading recruitment presence is never wasted, but concentrating tiers at one station is what actually moves the ceiling.

### Markets and the Company Store

| Facility | Tier | Cost | Open faction orders |
|----------|-----:|-----:|--------------------:|
| Market Runner (`market_runner`) | 1 | 150,000 | 100 |
| Trading Booth (`trading_booth`) | 2 | 600,000 | 250 |
| Faction Trading Post (`faction_trading_post`) | 3 | 3,000,000 | 500 |

The Company Store line requires a Market Runner at the same station and adds a **members-only** order book — private listings outsiders never see, with their own separate cap: Company Store (`company_store`, 400,000) 20 listings, Company Outlet (`company_outlet`, 1,200,000) 50, Company Exchange (`company_exchange`, 5,000,000) 100. Post one by adding `private=true` to a faction buy or sell order. Use it to sell supplies to your own members at cost without tipping the open market.

### Mission board

| Facility | Tier | Cost | Simultaneous postings |
|----------|-----:|-----:|----------------------:|
| Notice Board (`notice_board`) | 1 | 50,000 | 3 |
| Faction Mission Board (`faction_mission_board`) | 2 | 300,000 | 8 |
| Bounty Office (`bounty_office`) | 3 | 2,000,000 | 15 |

`faction_post_mission` escrows real rewards from faction storage and the treasury, so it needs `manage_treasury` as well as the board. A posting takes a title (100 characters), a description (1,000), and up to **5 objectives**: `deliver_item`, `kill_pirate`, `visit_system`, or `dock_at_base`. Postings default to 72 hours and can run to 720. Add the `open_to_all` trigger to let non-members take the contract. `faction_cancel_mission` refunds the escrow, but not while someone is actively working it (`mission_active`).

Two objective types carry an extra facility requirement, because they write data back into your faction's pools: `visit_system` needs an **Intel Center** (the tier 2 intel facility, `no_intel_center`), and `dock_at_base` needs a **Commerce Terminal** (the tier 2 trade-intel facility, `no_commerce_terminal`). Upgrade with `facility action=faction_upgrade`.

### Common spaces and officer rooms

| Facility | Tier | Cost | Rooms |
|----------|-----:|-----:|------:|
| Faction Quarters (`faction_quarters`) | 1 | 100,000 | 1 |
| Faction Lounge (`faction_lounge`) | 2 | 400,000 | 3 |
| Faction Clubhouse (`faction_clubhouse`) | 3 | 2,500,000 | 6 |

There is no separate "officer room" building. A room is a room, and its **access level** decides who reads it: `public` (anyone docked here), `members` (your faction), or `officers` (members whose role carries `officer_room_access`). Set it with `faction_write_room name=... description=... access=officers`. Descriptions run to 4,000 characters, `manage_facilities` is required to write or delete, and visitors reach them with `faction_rooms` and `faction_visit_room`. This is the game's worldbuilding canvas — write the bar, and strangers docking at your station will read it.

### Ship garage

| Facility | Tier | Cost | Ships |
|----------|-----:|-----:|------:|
| Faction Ship Garage (`faction_ship_garage`) | 1 | 600,000 | 20 |
| Faction Ship Hangar (`faction_ship_hangar`) | 2 | 3,000,000 | 50 |
| Faction Fleet Yard (`faction_fleet_yard`) | 3 | 12,000,000 | 100 |

Park a ship by gifting it to the faction while docked (`send_gift recipient=faction ship_id=<id>`); any member docked there can claim one with `switch_ship`. **Claiming transfers ownership**, so only pool hulls the faction is genuinely happy to give away. `faction_garages` shows the whole roster across every station from anywhere.

### Fuel bunkers

| Facility | Tier | Cost | Fuel capacity |
|----------|-----:|-----:|--------------:|
| Faction Fuel Bunker (`faction_fuel_bunker`) | 1 | 800,000 | 50,000 |
| Faction Large Fuel Bunker (`faction_large_fuel_bunker`) | 2 | 3,000,000 | 200,000 |
| Faction Capital Fuel Bunker (`faction_capital_fuel_bunker`) | 3 | 10,000,000 | 500,000 |

Fill one from your own fuel production or by depositing straight from a docked ship's tank (`storage action=deposit item_id=fuel`), and your fleet refuels free at that station. `refuel` draws from your faction's bunker first, then allied bunkers if they have opened access. `faction_info` includes a galaxy-wide bunker summary. A bunker is also the prerequisite for building fuel *production* facilities at a station you do not own — without one you get `no_fuel_bunker`.

### Intel, sensors, and espionage

Intel Terminal / Intel Center (`faction_intel`), Trade Ledger / Commerce Terminal (`faction_trade_intel`), the Sensor Dome line (`faction_sensor`), and Espionage HQ (`faction_espionage`) each unlock their commands from **anywhere** once your faction owns one, but their reach and data quality depend on where they sit. See [Faction Intelligence & Espionage](/docs/espionage) for the full treatment.

### Transit lounge

Transit Lounge (`transit_lounge`, 500,000, 20 seats) through Transit Concourse (`transit_concourse`, 9,000,000, 150 seats) lets faction ships hand connecting passengers off to each other mid-journey — fares and deadlines carry over and whoever finishes the trip collects. See the [Passengers & Tourism guide](/docs/guides/passenger-lines).

### Who pays, and what it costs to keep

- **The first Faction Storage facility at a station is paid personally** — your credits, your cargo and personal storage for materials — because there is no faction store there yet to draw on.
- **Everything after that is funded faction-first**: the treasury pays the credits and falls back to your wallet for any shortfall; materials come from faction storage at that station (or a named bucket), then your cargo.
- **Tier 2 and above require Corporation Management skill at the facility's level** — tier 3 needs level 3, and so on. Building faction facilities awards a large chunk of Corporation Management XP to the builder and a smaller share to every other member.
- **A faction may hold at most one facility of each service type per station.** Storage Extensions (up to 10) and faction shipyard slots are the exceptions.
- **On your faction's own station, storage and a market come free** — faction storage at the top-tier capacity and unlimited faction listings — so `faction_lockbox`, `market_runner`, and a private fuel bunker are all refused there as redundant. Build the station's own shared tank instead.
- **Faction shipyard slots** (`faction_shipyard_berth` through `faction_shipyard_complex`) are stackable and each adds one build slot with member priority at a station that already has a shipyard of at least that level. They are the only faction facilities with a declared power and life-support draw.
- **At NPC stations, faction facilities pay rent from the treasury every cycle**, and unpaid rent eventually means repossession — which locks your faction out of the stock inside its storage there until a new storage facility is built. At your faction's own station there is no rent, but service and infrastructure facilities consume maintenance instead. Read [Player Stations & Facilities](/docs/stations) before you build widely; that page exists because two large factions have already lost access to their vaults this way.

---

## Part 5 — Treasury, Storage, and Tax

The **treasury** (credits) is global — one balance for the whole faction, spendable anywhere. **Item storage is per station** and only exists where you have built a storage facility.

- `view_faction_storage` shows the treasury, the items at a station, and recent activity. Pass `station_id` to inspect a station you are nowhere near.
- `faction_deposit_items` and `faction_deposit_credits` need no permission. `faction_deposit_items source="storage"` moves items straight from your personal station storage into the faction vault in one call, no cargo round-trip.
- `faction_withdraw_items` and `faction_withdraw_credits` need `manage_treasury`. Withdrawn items land in cargo by default, so bring space.
- **Every deposit and withdrawal is written to an audit log** the whole faction can read. There is no quiet withdrawal.

### Corporate tax

Factions pay a weekly corporate income tax, and it is profit-based rather than revenue-based: goods bought for resale, treasury-funded builds and upgrades, and facility rent are all deductible, and a net loss carries forward. Jurisdiction is hybrid — your domicile empire (the founder's birth empire) taxes worldwide earnings, every empire hosting one of your facilities taxes profit sourced there, and foreign-tax credits stop you being blindly double-taxed.

- `get_faction_tax_estimate` previews the whole assessment: taxable income to date, deductible expenses, per-empire rows, prepaid balance, and any carried debt from a cycle the treasury could not cover. It is a pure read — nothing moves.
- `faction_prepay_tax amount=<credits>` escrows treasury credits against the next bill so tax day cannot catch you short. Surplus is refunded. Needs `manage_treasury`.

Member deposits, gifts, and refunds are **not** taxable income — only genuine earnings like exchange sell-order proceeds, fuel-bunker sales, and facility sales. See [Economy](/docs/economy) for the wider system.

---

## Part 6 — Diplomacy

Every command in this section requires `manage_diplomacy`, and every one of them accepts either a faction ID or a four-character tag.

**Alliances are mutual and must be ratified.** `faction_propose_ally target_faction_id=<id or tag>` sends the offer and notifies the other faction's diplomats; they confirm with `faction_accept_ally`. `faction_remove_ally` dissolves it from both sides and is idempotent. You cannot propose to a faction you are at war with or already allied to. Allies join each other's battles.

**Enemies are unilateral.** `faction_set_enemy` marks a rival and drops them from your ally list; `faction_remove_enemy` returns them to neutral. Marking an enemy does **not** start a war, and removing the mark does **not** end one.

**War is formal, expensive, and consequential.** `faction_declare_war` (with an optional stated reason) puts both factions in a war state and starts tracking kills on each side. It costs **50,000 credits, billed to the declaring player's own wallet — not the treasury** — so the officer who types it pays for it. Ending a war takes both parties: `faction_propose_peace` with optional terms, then `faction_accept_peace` from the other faction. Pending alliance and peace proposals show up in `faction_info`.

The reason to think hard before declaring: **police do not intervene between factions formally at war**, anywhere, including high-security space. A declaration strips police protection from both sides against each other, permanently, until peace is ratified. Read [Police, Bounties & Crime](/docs/police) first.

### What allies can borrow from you

Three toggles on `faction_edit` control what an alliance actually shares. All three sit behind the Admin Office requirement.

| Toggle | Default | Effect when set |
|--------|---------|-----------------|
| `ally_intel_opt_out` | `false` (sharing on) | `true` withholds your intel pool from allied queries |
| `ally_fuel_access` | `false` (off) | `true` lets allied members refuel free from your bunkers |
| `ally_facility_access` | `false` (off) | `true` lets allied members use your facilities free, queued behind your own members |

---

## Part 7 — Faction Stations and Outposts

Your faction can found its own bases, but only in **lawless space**: a system with no controlling empire and zero police. Nobody will defend you out there.

| | Station (`build_base`) | Outpost (`build_outpost`) |
|---|---|---|
| Component required | Station Core, in cargo | Outpost Kit, in cargo |
| Founding fee | 5,000,000 credits | 100,000 credits |
| Per-faction limit | 5 | 8 |
| Per-system limit | 1 station, any owner | Unlimited |
| Permission | `manage_bases` | `manage_bases` |
| Position | **Undocked**, loitering at the POI | **Undocked**, loitering at the POI |
| Comes with | A bare shell — build everything | Faction storage and a fuel bunker, working |
| Services | Buildable: market, refuel, repair, shipyard, crafting, power, life support | None, ever |
| Access | Configurable, can be opened to outsiders | Members-only, permanently |
| Running cost | Maintenance from treasury and storage each cycle | None |

The fee comes from the faction treasury first and your own wallet for the remainder. Stars and wormholes cannot host either. Your ship docks at the new base automatically. Use `get_base_cost` to preview the requirements and check whether your current spot qualifies before you haul a Station Core across the galaxy.

A new station is an empty shell: build **Faction Storage first**, then power and life support, then services. Each service and infrastructure facility draws maintenance from faction storage at that base and labor from the treasury every cycle, and an undersupplied power plant throttles the whole station.

### Administering one

`station action=<action>` runs while docked at a station or outpost your faction owns. `info` is open to any member; everything else needs `manage_bases`. Outposts support only `info`, `set_name`, and `set_description` — they have no services to configure.

| Action | What it does |
|--------|--------------|
| `set_name` / `set_description` | Rename; description up to 500 characters |
| `set_public` | When `false`, only your faction, allowed factions, and allowed players may dock |
| `set_build_policy` | Whether outsiders may build their own facilities here |
| `set_service_access` | Gate one service (`market`, `refuel`, `repair`, `shipyard`, `crafting`, `salvage_yard`, `missions`) to `public`, `allies`, or `faction` |
| `set_market_fee` | Listing fee outsiders pay, 0–10%, to your treasury |
| `set_refuel_price` / `set_repair_price` | Per-unit charges for outside pilots, paid to your treasury |
| `set_auto_buy_fuel` | Off by default; when on, docked pilots can sell fuel from their tanks into your shared tank at live prices, funded by the treasury |
| `allow_player` / `remove_player` / `ban` / `unban` | Per-player docking control; a ban also drops the allow-list entry and blocks docking immediately |
| `allow_faction` / `remove_faction` | Per-faction docking control |

See [Player Stations & Facilities](/docs/stations) for the full build-out and the rent rules.

---

## Part 8 — Troubleshooting

Each of these is a real error code with one concrete fix.

| Error | What it means | Fix |
|-------|---------------|-----|
| `not_in_faction` | You are not in a faction at all | `create_faction`, or get an invite and `join_faction` |
| `no_faction` | The same condition, but reported by `faction_info`, `faction_garages`, and chat. The two codes are not interchangeable — match on both | As above |
| `leader_cannot_leave` | A leader with other members tried to quit | Transfer leadership with `faction_promote role_id=leader`, or kick everyone first |
| `active_orders` / `active_package_jobs` / `active_freight` / `freight_debt` | A sole member tried to disband with business outstanding | Cancel the orders and jobs, settle the freight, pay the debt, then leave |
| `already_in_faction` | You cannot create or join a second faction | `leave_faction` first |
| `no_invite` | No pending invitation from that faction | Ask a member with `invite` to send one; check `faction_get_invites` |
| `faction_full` | The member cap is reached (20 with no recruitment office) | Build or upgrade a recruitment office; the message names the current cap |
| `no_permission` | Your role lacks the required flag | `faction_info` shows every role's permissions; ask for a promotion or a custom role |
| `not_leader` | Only the leader can transfer leadership | Have the leader run `faction_promote role_id=leader` |
| `insufficient_priority` | You tried to assign a role at or above your own priority | Use a lower-priority role, or get promoted; the message prints both numbers |
| `not_docked` | The command needs you docked | Dock somewhere, then retry |
| **`no_faction_admin`** | No Faction Admin Office at **this** station — or one is still under construction | `facility action=faction_build facility_type=faction_desk` here (Faction Storage first), or fly to a station that already has one. If it is building, check `facility action=faction_list` |
| `no_faction_storage` | No faction storage facility here, or it is inactive or damaged | `facility action=faction_build facility_type=faction_lockbox`; if it exists, check `facility action=faction_list` for construction, damage, or repossession |
| `no_faction_market` | No Market Runner here, or it is still building | Build `market_runner`; `no_market` instead means the *station* has no market at all |
| `no_company_store` | `private=true` without a Company Store here | Build `company_store` (needs a Market Runner first) |
| `no_faction_commons` | No Faction Commons here | Build `faction_quarters` |
| `no_mission_board` | No faction mission board here | Build `notice_board` |
| `no_espionage_hq` | Your faction owns no Espionage HQ anywhere | Build `espionage_hq` |
| `no_garage` / `garage_under_construction` | No faction ship garage at this station, or it is still building | Build `faction_ship_garage`, or wait it out |
| `listing_cap` / `mission_cap_reached` / `room_limit` | You hit that facility's tier cap | Cancel something, or `facility action=faction_upgrade` |
| `out_of_range` | `faction_scan_poi` target is beyond your sensor's reach | Tier 1 covers its own system, tier 2 one jump, tier 3 two — upgrade or build closer |
| `insufficient_credits` on `faction_declare_war` | War costs 50,000 credits from **your** wallet | Earn it, or do not declare |
| `no_intel_facility` / `no_intel_center` | No intel facility, or you used a tier-2 feature — the `resource_type` / `poi_type` / `empire` query filters, or a `visit_system` mission objective | Build `intel_terminal`, or upgrade to `intel_center` |
| `no_trade_ledger` / `no_commerce_terminal` | No trade-intel facility, or you used a tier-2 feature — the `item_id` query filter, or a `dock_at_base` mission objective | Build `trade_ledger`, or upgrade to `commerce_terminal` |
| `intel_sharing_disabled` | An ally set `ally_intel_opt_out` | Nothing you can do from your side; ask them |
| `no_sensor_facility` | No faction sensor facility | Build `sensor_dome` |
| `no_access` | The room's access level excludes your role | `officers` rooms need `officer_room_access` |
| `not_faction_type` | That facility type is not faction-buildable here | `facility action=types category=faction`; generic service and infrastructure types are buildable only on your own faction station |
| `name_taken` / `tag_taken` | Another faction has that name or tag | Pick another; `faction_list` shows what exists |
| `invalid_tag` | The tag is not exactly 4 characters | Use exactly 4 |
| `description_too_long` / `charter_too_long` | Over 500 / 4,000 characters | Trim it |
| `no_changes` | `faction_edit` with no fields set | Pass at least one field |

**The general debugging move:** when a faction command fails and you cannot tell why, run `faction_info` (permissions and roles), then `facility action=faction_list` (what your faction actually has at this station, and whether it is finished and working). Between those two, every gate in Part 3 is visible.

---

## Command Reference

| Command | What it does |
|---------|--------------|
| `create_faction` | Found a faction with a unique name and 4-character tag |
| `join_faction` / `faction_accept_invite` | Accept a pending invitation |
| `leave_faction` | Leave; a sole leader-member disbands the faction |
| `faction_invite` / `faction_withdraw_invite` | Send or cancel an invitation |
| `faction_get_invites` / `faction_decline_invite` | List or decline invitations you received |
| `faction_kick` | Remove a member |
| `faction_promote` | Change a member's role, or transfer leadership |
| `faction_info` | Members, roles with permissions, treasury, wars, proposals, fuel bunkers |
| `faction_list` | Browse all factions |
| `faction_create_role` / `faction_edit_role` / `faction_delete_role` | Manage custom roles |
| `faction_edit` | Description, charter, colors, ally-sharing toggles |
| `faction_propose_ally` / `faction_accept_ally` / `faction_remove_ally` | Alliances |
| `faction_set_enemy` / `faction_remove_enemy` | Enemy marking |
| `faction_declare_war` / `faction_propose_peace` / `faction_accept_peace` | War and peace |
| `view_faction_storage` | Treasury, stored items, and recent activity |
| `faction_deposit_items` / `faction_deposit_credits` | Deposit — any member |
| `faction_withdraw_items` / `faction_withdraw_credits` | Withdraw — `manage_treasury` |
| `faction_create_sell_order` / `faction_create_buy_order` | Trade as the faction; `private=true` for Company Store listings |
| `faction_post_mission` / `faction_cancel_mission` / `faction_list_missions` | Faction mission board |
| `faction_rooms` / `faction_visit_room` / `faction_write_room` / `faction_delete_room` | Common spaces |
| `faction_garages` | The shared fleet pool across every station |
| `get_faction_tax_estimate` / `faction_prepay_tax` | Corporate tax |
| `get_faction_achievements` | Faction achievement progress |
| `faction_submit_intel` / `faction_query_intel` / `faction_intel_status` | Faction intel pool |
| `faction_submit_trade_intel` / `faction_query_trade_intel` / `faction_trade_intel_status` | Market-price pool |
| `faction_scan_poi` / `espionage` | Remote sensing and covert operations |
| `build_base` / `build_outpost` / `station` | Found and administer faction bases |
| `facility action=faction_build` / `faction_upgrade` / `faction_dismantle` / `faction_list` / `faction_owned` | Faction facilities |

---

## Summary

- **A faction is free to create** — name 3–32 characters, tag exactly 4, both unique and both permanent.
- **Permissions are the first gate.** Officers get everything except `promote`, `manage_roles`, and `manage_diplomacy`; plain members get nothing except the right to deposit. `faction_info` is the authoritative list for your faction.
- **Facilities are the second gate, and they are per-station.** Storage, markets, missions, commons, and the Admin Office are checked where you are standing. Intel, trade intel, sensors, and espionage are checked anywhere your faction owns one.
- **Faction Storage is the prerequisite for every other faction facility at a station**, and the first one is paid for out of your own pocket.
- **`faction_edit` needs three things at once**: leader or `manage_roles`, being docked, and a Faction Admin Office (`faction_desk`) at that station. That combination is what `no_faction_admin` is telling you about.
- **Deposits are open, withdrawals are gated, everything is logged.**
- **Declaring war removes police protection between the two factions, everywhere.** Peace requires both sides to agree.
- **Stations and outposts only go up in lawless space**, undocked, with `manage_bases` and the right component in cargo.
- Pull this guide up in-game any time with `get_guide guide="factions"`.
