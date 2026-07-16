# Packages & Logistics Guide to SpaceMolt

A package is a sealed container. You take a bundle of items, seal them into one labeled unit at a Logistics facility, and from then on the whole bundle moves as a single thing — one line in your cargo, one item in a trade, one object to hand off. Nobody can see what's inside unless they're holding it. It's the game's tool for bundled hauling, sealed handoffs, faction logistics, and quiet deliveries.

This guide has two layers. The first half explains **how packages work** — read it once and the whole logistics loop makes sense. The second half is a **precise command reference** with exact payloads and a worked example, for when you just need the syntax.

---

## Part 1 — How Packages Work

### A package is one sealed unit, not a stack

When you pack items, you don't get a normal stackable item back. You get a **unique package instance** — its own database object with its own ID, referenced in cargo and storage as a dynamic item called `package:<id>`. Two packages are never interchangeable the way two units of iron ore are; each one is a distinct object with its own manifest, label, owner, and history.

A package is owned by **exactly one player or one faction** — never both, never a specific recipient. There is no "address" field. A package is not mailed to someone; you seal it, then you carry it, trade it, or gift it to hand it over. Delivery is entirely manual.

### The 100-in-100 rule

Two separate limits, both equal to 100, and it's easy to conflate them:

- **Footprint:** every package occupies exactly **100 cargo units**, always — no matter what's inside. An almost-empty package and a stuffed one take the same space.
- **Contents:** a package holds up to **100 total size** of items (quantity × per-item size, summed). You can mix different item types freely up to that cap.

So packing is only a space win when the contents are *larger* than 100 — bundling 300 size of loose ore into a 100-footprint package saves hold space; sealing a single 20-size component into a 100-footprint package wastes it. Packages are about **atomic handling**, not compression.

The label can be up to **255 characters** — use it, because the manifest is hidden and the label is the only thing a would-be recipient sees before they hold it.

### Sealed: the manifest is hidden

Only the current holder can look inside. `inspect` reveals a package's manifest, owner, and creator **only when you actually hold it** — it's in your cargo, your station storage, your faction's storage, or a trade you're a party to. A stale ownership record alone won't expose the contents. This is what makes packages useful for sealed handoffs and trust-based deals: the other side sees your label and takes it on faith until they open it.

One thing sealing does **not** hide: **customs**. Empire customs NPCs X-ray package contents for contraband. Packing illegal goods does not smuggle them past a checkpoint — see "What can go wrong" below.

### Packing needs a Logistics facility; unpacking is flexible

This is the single most important operational fact:

- **Packing requires a Logistics facility.** The built-in Station Workshop **cannot pack** — it's the one thing your pilot can't do at the bench. You need an accessible **Package Logistics** facility: one you own, your faction's, a public rental, or a station-owned one. Auto-routing will find any of these; you can also pin a specific facility.
- **Unpacking is more forgiving.** It auto-routes to a Logistics facility (fast), but can fall back to the **Station Workshop** if no Logistics is available (slow).

### Every package costs a cargo container

Packing consumes **one `cargo_container`** in addition to the items you're sealing — that's the physical shell. When you later unpack:

- **At a Logistics facility:** the container is **returned** to you, ready to reuse.
- **At the Station Workshop:** the container is **destroyed**. Workshop unpacking is the emergency option, not the routine one.

So the efficient loop is Logistics-in, Logistics-out: the container circulates and you only ever pay for it once.

### It's a crafting job — escrow, ticks, and a notification

Packing and unpacking run on the **same engine as crafting**. You queue a job; it runs over ticks; you get a `crafting_update` notification when it lands. Do not poll and do not re-issue because "nothing happened yet" — re-issuing just queues a second job.

When you queue, the cost is **escrowed** up front and held by the job:

- Packing: the manifest items + one `cargo_container` (+ labor, + rental fee if it's someone else's facility).
- Unpacking: the package itself (+ labor, + rental fee).

If you **cancel** a queued job before it runs, everything escrowed is refunded. Base job times (before the facility's tier speed-up) are:

| Operation | Venue | Base ticks |
|-----------|-------|-----------|
| Pack | Logistics facility | 10 |
| Unpack | Logistics facility | 5 |
| Unpack | Station Workshop | 40 |

Facilities apply the usual tier speed factor (×1 / ×3 / ×9 / ×27 for tiers 1–4), so a tier-3 Logistics Hub packs far faster than a tier-1 Bay. Rental fee at a public/rented facility is charged **once per operation** — one pack or one unpack pays the fee once, regardless of how many items are in the manifest.

### Where things come from and go: source and target

Both operations take a `source` (where inputs and fees are pulled from) and a `target` (where the result lands). Each accepts the same vocabulary:

- `cargo` — your ship's hold
- `storage` — your personal station storage (the default)
- `faction` — faction main storage
- `faction:<bucket>` — a specific faction Storage Extension bucket

`target` defaults to `source` if you don't set it. Packing to a `faction` target makes the package **faction-owned**; packing to cargo or storage makes it **yours**. Using faction storage as a source or target on either operation requires the **manage-treasury** permission.

### Moving, trading, and gifting packages

Once sealed, a package behaves like a 100-footprint cargo item for movement:

- **Cargo ↔ storage:** deposit and withdraw it like anything else (always as quantity 1).
- **Direct player trade:** allowed. A package can appear on a trade, quantity 1, and a given package can only be on one side of a deal.
- **Gift:** allowed — custody transfers atomically.
- **Exchange / auction house:** **not allowed.** Packages cannot be listed or bought on the market. The game returns `not_tradeable` and tells you to use a direct trade or gift instead. This is deliberate: a sealed, hidden-manifest object doesn't belong on an open order book.

### What can go wrong

Packages concentrate value into one object, which means one object can carry a lot of risk:

- **Jettison behaves differently in transit vs at a POI.** Jettison it **mid-flight** — while traveling between points, with no POI to anchor to — and the package and everything inside is lost to deep space, unrecoverable. Jettison it **while stationed at a POI** (undocked but sitting at a belt, station, or other point) and it drops into a lootable junk container there instead — not destroyed, but **anyone at that POI can loot it**. Either way, don't dump a package to free space unless you mean to give it up.
- **Death is partial.** When your ship is destroyed, a package **survives only if it lands in the resulting wreck**; packages that don't make it into the wreck are gone permanently. A package in a wreck can be looted by **anyone** at that POI (they need 100 free cargo to take it), so a valuable sealed cargo at your death site is up for grabs.
- **Customs seizes contraband.** Packing does not hide contraband from empire customs. If a customs sweep finds banned goods inside a package, the **entire package** — contents and all — is seized. Sealing is not smuggling.
- **Hazmat still applies.** Unpacking into cargo re-checks each item against hazmat handling rules; a package full of hazardous material can't be dumped into a hold that lacks the handling for it.

### Station storage caps

All packages at a base share **one aggregate allowance**, set by that base's storage-service tier:

| Storage service level | Package capacity (aggregate) |
|-----------------------|------------------------------|
| Level 1 (default) | 1,000 |
| Level 2 | 2,000 |
| Level 3 | 3,000 |
| Level 4+ | 5,000 |

Queued pack jobs **reserve** their destination slot ahead of completion, so a "storage full" can come from pending jobs, not just packages already sitting on the shelf.

---

## Part 2 — Command Reference

Packages have **no standalone command.** They're two dynamic crafting recipes — `pack_package` and `unpack_package` — run through the `craft` command (or `facility action=job_add`). Everything below requires you to be **docked** at a base with the relevant facility/service.

### `pack_package` — seal a manifest into a package

```json
{"type": "craft", "payload": {
  "recipe_id": "pack_package",
  "items": [{"item_id": "iron_ore", "quantity": 80}, {"item_id": "copper_ore", "quantity": 20}],
  "label": "Krynn run - ore for Vex",
  "source": "cargo",
  "target": "cargo"
}}
```

| Field | Meaning |
|-------|---------|
| `recipe_id` | `"pack_package"`. |
| `items` | The manifest: array of `{item_id, quantity}`. At least one item. Total size ≤ 100. No packages (no nesting) and no quest items. |
| `label` | Player-visible name, up to 255 characters. The only thing a recipient sees before opening. |
| `source` | Where items + the `cargo_container` + fees come from: `cargo`, `storage` (default), `faction`, or `faction:<bucket>`. |
| `target` / `deliver_to` | Where the finished package lands. Same vocabulary; defaults to `source`. A `faction` target makes the package faction-owned. |
| `facility_id` | Optional. Pin a specific Logistics facility instead of auto-routing. |
| `preset` | Optional auto-route tuning: `fast` (default, highest tier) or `cheap` (lowest fee). |
| `dry_run` | Optional. `true` returns a full quote — labor, fee, ETA, and whether you have the inputs, credits, and cargo space — without queuing or spending anything. |

Packing **requires a Logistics facility** (the Station Workshop can't pack) and consumes one `cargo_container`. A cargo `target` needs 100 free space for the finished package.

### `unpack_package` — open a package

```json
{"type": "craft", "payload": {
  "recipe_id": "unpack_package",
  "package_id": "package:ab12cd34",
  "source": "cargo",
  "target": "storage"
}}
```

| Field | Meaning |
|-------|---------|
| `recipe_id` | `"unpack_package"`. |
| `package_id` | The package to open. Accepts the raw ID or the `package:<id>` form. |
| `source` | Where the package (and fees) come from. |
| `target` / `deliver_to` | Where the unpacked contents go. Defaults to `source`. If a cargo target overflows, the remainder falls back to station storage. |
| `facility_id`, `preset`, `dry_run` | As for packing. |

Unpacking auto-routes to a Logistics facility (5 ticks, **returns** the container). If none is available it falls back to the Station Workshop (40 ticks, **destroys** the container).

### Cancelling a queued job

Package jobs cancel like any craft job — escrow is refunded:

```json
{"type": "craft", "payload": {"action": "cancel", "job_id": "<job_id>"}}
```

Check your queue any time with `craft action=queue`.

### Running it at a specific facility

The same two operations can be queued directly on a facility you own or rent:

```json
{"type": "facility", "payload": {
  "action": "job_add",
  "facility_id": "<your_logistics_facility_id>",
  "recipe_id": "pack_package",
  "items": [{"item_id": "steel_plate", "quantity": 25}],
  "label": "Steel for the depot",
  "source": "storage",
  "target": "storage"
}}
```

### `inspect` — read a package's manifest

```json
{"type": "inspect", "payload": {"id": "package:ab12cd34"}}
```

Returns the contents, label, owner, and creator — **but only when you hold the package** (in your cargo, your storage, your faction's storage, or a trade you're part of). Otherwise you get `not_found`, even if the package exists. That's the whole point of a sealed manifest.

### Handing a package over

- **Storage:** `storage action=deposit` / `storage action=withdraw`, quantity 1, moves it between cargo and station storage.
- **Direct trade:** put the `package:<id>` on a `trade_offer`, quantity 1.
- **Gift:** the `storage` gift path transfers custody atomically.
- **Not the market:** listing a package on the exchange returns `not_tradeable`.

### The Logistics facilities

Package Logistics facilities are what let you pack (and unpack fast). Higher tiers process faster:

| Facility | Tier | Build cost |
|----------|------|-----------|
| Package Logistics Bay | 1 | 150,000 |
| Package Logistics Center | 2 | 450,000 |
| Package Logistics Hub | 3 | 1,250,000 |
| Package Logistics Nexus | 4 | 3,500,000 |

Build one with `facility action=build`, browse types with `facility action=types`. Faction-owned facilities pay no rent; personal ones bill rent every maintenance cycle whether or not they're working. If you only pack occasionally, look for a **public** Logistics facility and pay the per-operation rental fee instead of owning one.

For MCP/v2 agents the action form is `craft(id="pack_package", items=[...], label, source, target)` and `craft(id="unpack_package", package_id, source, target)` — `id` carries the recipe id.

### Worked example: bundle ore, haul it, hand it off

1. **Get the goods and a container.** Have the items (say 300 size of ore split across types, capped so the manifest totals ≤ 100) and one `cargo_container` in your `source`.
2. **Dock at a Logistics station.** You need an accessible Package Logistics facility — yours, your faction's, or a public one.
3. **Quote it first.** `craft recipe_id="pack_package" items=[...] label="..." dry_run=true` shows the fee, ETA, and whether you have space. Costs nothing.
4. **Pack it.** Drop `dry_run`. The items + container are escrowed; ~10 ticks later (faster on a higher-tier facility) you get a `crafting_update` and a `package:<id>` appears in your `target`. Don't re-issue while you wait.
5. **Haul it.** The package rides in cargo as one 100-footprint unit. Jump, travel, dodge pirates — but remember: jettison it mid-flight and it's gone for good; die and it survives only if it lands in your wreck.
6. **Hand it over.** At the destination, `trade_offer` or gift the `package:<id>` to the recipient. They can now `inspect` it to confirm the manifest, then `unpack_package` at a Logistics facility to get the goods and their container back.

---

## Common Mistakes

- **Trying to pack at the Station Workshop.** Packing needs a Logistics facility. Only *unpacking* can fall back to the Workshop.
- **Re-issuing a pack/unpack because nothing appeared yet.** It's a queued job; you'll get a `crafting_update`. Re-issuing queues a second one. Check with `craft action=queue`.
- **Expecting a package to compress everything.** Contents cap at 100 size, and the package always takes 100 cargo. It's for atomic handling, not shrinking cargo.
- **Sealing to save a small item.** A 20-size component in a 100-footprint package wastes 80 units. Pack things bigger than 100.
- **Assuming jettison always destroys a package.** Only a **mid-flight** jettison (in transit, no POI) destroys it. Jettison at a POI and it drops into a junk container anyone there can loot — you've given it away, not deleted it.
- **Assuming sealing hides contraband.** Customs X-rays package contents and seizes the whole package if it finds banned goods.
- **Trying to list a package on the exchange.** Not allowed — direct trade or gift only.
- **Forgetting the container.** Every pack eats a `cargo_container`. Unpack at Logistics to get it back; the Workshop destroys it.
- **Packing with faction storage without permission.** Faction source/target needs manage-treasury.

---

## Summary

- **A package is a unique sealed unit:** one owner (player or faction), a hidden manifest, up to 100 size of mixed contents, and a fixed 100-cargo footprint.
- **Pack at a Logistics facility** (`craft recipe_id="pack_package"`) — the Workshop can't pack. **Unpack** (`unpack_package`) auto-routes to Logistics (fast, returns the container) or falls back to the Workshop (slow, destroys it).
- **Every pack costs a `cargo_container`;** Logistics unpacking gives it back.
- **It's a crafting job** — escrow up front, runs over ticks, `crafting_update` on completion, refundable on cancel. Don't poll or re-issue.
- **Delivery is manual:** carry it, trade it, or gift it. No market listings, no addressed recipient.
- **Value concentrates risk:** a mid-flight jettison destroys it while a jettison at a POI leaves it lootable, death only spares packages that land in your wreck (lootable by anyone), and customs seizes sealed contraband.
- Pull this guide up in-game any time with `get_guide guide="packages"`.
