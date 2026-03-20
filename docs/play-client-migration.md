# /play Client Migration: WebSocket → HTTP v2

## Why

The /play web client (built by Ian ~Feb 2026, unmaintained since) sends all game commands over a single WebSocket connection. Responses are classified by **sniffing field presence** — e.g., `'base_id' in p && 'credits' in p` means "this is a storage response." This is fundamentally fragile:

- **`view_market` broke** because `decodeStrict` on the server rejected the `_req_id` field that the client injects for request-response correlation.
- **`view_storage` broke** because the client checked for a `credits` field that the server removed (station credit storage was deprecated).
- **Ship panel crashed** because the client expected `ship.class` but the server sends `class_id`.
- **Missions panel crashed** because the client expected `reward_credits` but the server sends `rewards.credits`.

These are all symptoms of the same root cause: **hand-written TypeScript types that drift from server reality, with no compile-time safety net.**

The gameserver already has a full HTTP v2 API with:
- OpenAPI 3.0 spec with per-command typed response schemas
- 15 consolidated tools mapping to ~180 commands
- Synchronous mutation handling (blocks until tick resolves — no deferred `action_result` messages)
- Session management and notification polling

## Architecture Change

```
Before:  Browser ←→ WebSocket ←→ Gameserver (commands + notifications, response-type guessing)
After:   Browser  → HTTP v2   → Gameserver (commands, typed responses)
         Browser ←  WebSocket ←  Gameserver (notifications only, no commands sent)
```

Key benefits:
- **Each HTTP call knows its response type** — no field sniffing needed
- **TypeScript types generated from OpenAPI spec** — compile-time safety, zero drift
- **Synchronous mutations** — HTTP v2 blocks until the tick processes, so no deferred response tracking (`_req_id`, callback maps)
- **WebSocket simplified** — receive-only for server-push events (chat, combat, skill-ups, etc.)

## Progress

### Phase 0: Server — Token auth for HTTP v2 ✅

The /play client authenticates via Clerk JWT → short-lived ws-token. HTTP v2 previously only supported username/password login.

**Added `login_token` action to HTTP v2** (`spacemolt_auth/login_token`):
- `TokenConsumerFunc` callback on `httpapiv2.Server`, wired to the main server's `consumeWSToken`
- Intercepts `login_token` before standard command dispatch (since the v1 registry has `Handler: nil` for it)
- Consumes token → calls `HandleLoginByPlayerID` → processes through `processResult` (which calls `setSessionPlayer`)
- Rate-limited same as login/register

**Auth flow:**
1. Clerk JWT → `POST /api/player/{id}/ws-token` → token A
2. `POST /api/v2/session` → session ID
3. `POST /api/v2/spacemolt_auth/login_token` `{token: A}` → session authenticated
4. Clerk JWT → `POST /api/player/{id}/ws-token` → token B
5. WebSocket `login_token` with token B → WS authenticated for notifications

**Also fixed:** `_req_id` stripping at the WS dispatch layer so `decodeStrict` handlers stop rejecting web client payloads.

**Files changed (gameserver):**
- `internal/httpapiv2/httpapiv2.go` — `TokenConsumerFunc` type, `SetTokenConsumer()`, field on Server struct
- `internal/httpapiv2/handlers.go` — `handleLoginToken()` method, CORS `Authorization` header
- `internal/mcp/v2_tools.go` — `login_token` in ToolAuth mapping, schema, description
- `internal/server/server.go` — Wire `SetTokenConsumer(s.consumeWSToken)`, `stripReqID()` function
- `internal/server/server_test.go` — `TestStripReqID`

**Commits:**
- `fix: strip _req_id from WebSocket payloads before handler dispatch`
- `feat: add login_token auth to HTTP v2 API`

### Phase 1: Client — Type generation + API client ✅

**OpenAPI type generation:**
- `openapi-typescript` generates 16k lines of typed interfaces from `GET /api/v2/openapi.json`
- Spec saved to `src/lib/openapi-v2.json`, types generated to `src/lib/generated/v2api.d.ts`
- Regenerate with `pnpm generate:types`
- `src/lib/gameTypes.ts` re-exports ~100 commonly used types for clean imports

**HTTP v2 client (`src/lib/gameApi.ts`):**
- `GameApi` class with session management, typed calls, error handling
- `command(v1Command, v1Params)` — routes v1 command names through v2 API with automatic param translation
- `callRaw(tool, action, params)` — low-level call returning full `V2Response` wrapper
- `callStructured(tool, action, params)` — extracts `structuredContent` from response
- Processes piggybacked notifications from HTTP responses
- v1→v2 command mapping table (~100 commands)

**Files created (www):**
- `src/lib/gameApi.ts` — HTTP v2 client
- `src/lib/gameTypes.ts` — Generated type re-exports
- `src/lib/generated/v2api.d.ts` — Auto-generated from OpenAPI
- `src/lib/openapi-v2.json` — Cached OpenAPI spec

### Phase 2: Client — Transport replacement ✅

**`GameProvider.tsx`:**
- `sendCommand` now routes through `api.command()` (HTTP v2) instead of WebSocket send + callback tracking
- Falls back to WebSocket if API not yet initialized (during auth handshake)
- Responses dispatched through reducer's `OK` action for backward compatibility
- Polling intervals (`get_status` every 5s, `get_nearby` every 10s) use HTTP v2

**`PlayClient.tsx`:**
- Auth flow fetches two ws-tokens: one for HTTP v2, one for WebSocket
- Creates and authenticates `GameApi` instance, stores via `setApi()` on context
- WebSocket still connects for server-push notifications

**Context changes:**
- Added `api: GameApi | null` and `setApi()` to `GameContextValue`
- `send()` documented as "only for initial login_token auth handshake"

### Bug Fixes Applied

| Bug | Cause | Fix |
|-----|-------|-----|
| `view_market` invalid payload | `_req_id` rejected by `decodeStrict` | Strip `_req_id` at WS dispatch layer |
| Storage tab won't load | Detection checked for `credits` field server doesn't send | Removed `credits` from detection + `StorageData` type |
| Ship panel crash | `ship.class` undefined (server sends `class_id`) | Updated `Ship` type + all references to use `class_id` |
| Missions panel crash | `reward_credits` undefined (server sends `rewards.credits`) | Updated `Mission` type + `renderRewards` to use `rewards` object |
| Missions panel crash | `m.id` undefined (server sends `mission_id`) | Updated `Mission` type + all references to use `mission_id` |

### Phase 3: Migrate panels to generated types — PARTIALLY COMPLETE

**Approach:** Two-tier type system:
- `src/lib/gameTypes.ts` — re-exports generated types from OpenAPI spec
- `src/components/play/types.ts` — imports from `gameTypes.ts` for response data types, extends with schema gaps, keeps hand-written types for WebSocket state objects

**Response data types migrated (in `types.ts`):**
- `MarketData` = `ViewMarketResponse & { summarized?: boolean }` (schema gap: `summarized`)
- `MarketItem` = `ViewMarketResponse['items'][number]`
- `OrdersData` = `ViewOrdersResponse & { faction_orders?: OrderEntry[] }` (schema gap: `faction_orders`)
- `OrderEntry` = `ViewOrdersResponse['orders'][number]`
- `StorageData` = `ViewStorageResponse`
- `StorageItem`, `StorageShip`, `StorageGift` = extracted from `ViewStorageResponse`
- `FleetData` = `ListShipsResponse`
- `FleetShip` = `ListShipsResponse['ships'][number]`

**Panel import changes:**
- StorageView, MarketView, OrdersView — removed explicit type annotations; types inferred from state
- MissionsPanel — imports `Mission` from `@/lib/gameTypes`, updated `renderRewards` for server's `Record<string, number>` item format

**Core objects NOT migrated (WebSocket state vs v2 API mismatch):**
- `Player`, `Ship`, `CargoItem`, `Module`, `SystemInfo`, `POI`, `NearbyPlayer` — generated OpenAPI types have many fields optional or use different shapes (e.g. `modules: string[]` vs `Module[]`). WebSocket state updates send richer objects. These remain hand-written.

**Types with no generated equivalent:**
- `ShowroomShip`, `ShowroomData` — schema gaps (`shipyard_level`, `tip`, `showroom_price`)
- `ShipClassInfo`, `ShipCatalogData` — no v2 schema
- `Recipe`, `RecipesData`, `SkillsData` — no v2 schema
- `Faction`, `FactionMember`, `FactionWar`, `BaseInfo`, `Wreck` — different shapes from API responses
- `Module`, `Drone` — no standalone schema

**OpenAPI schema gaps to fix on the server:**
- `ViewMarketResponse` missing `summarized` field
- `ViewOrdersResponse` missing `faction_orders` field
- `BrowseShipsResponse` missing `shipyard_level`, `tip` fields; uses `listings` not `ships`
- `Ship` schema has `modules: string[]` but WS sends `Module[]` objects
- `Player` schema missing `faction_name`, `faction_tag`
- `NearbyPlayer` schema missing `is_anonymous`, `is_npc`, `npc_type`
- `POI` schema missing `base_name`
- Many `Ship` fields optional in schema but always sent by WS
- No schemas for Recipe details, Skills, Faction info

## What's Next

### Phase 4: Cleanup

- Remove response-sniffing logic from `useGameState.ts` reducer (the massive `OK` case with 30+ branches)
- Remove `_req_id` callback tracking from GameProvider
- Remove `send` from GameContext interface (WS is receive-only)
- Simplify `useWebSocket.ts` to pure notification receiver

### Phase 5: Fix OpenAPI schema gaps

Fix the schema gaps listed above on the gameserver so generated types fully match server responses. Once fixed, regenerate types and migrate remaining hand-written types.

### Future Considerations

- **Regenerating types on server changes:** Currently manual (`pnpm generate:types`). Could add a pre-build hook or CI check.
- **Notification polling fallback:** If WebSocket disconnects, could fall back to `GET /api/v2/notifications` polling. Currently not implemented — WS reconnection handles this.
- **Remove v1 command mapping:** Once all panels call typed API methods directly, the `COMMAND_MAP` in `gameApi.ts` can be simplified.

## How to Test Locally

```bash
# Terminal 1: Gameserver
cd gameserver && go run ./cmd/server

# Terminal 2: Website
cd www && pnpm dev
# Note: needs .env.local with:
#   NEXT_PUBLIC_DEV_MODE=true
#   NEXT_PUBLIC_GAMESERVER_URL=http://localhost:8080

# Open http://localhost:3000/play (or :3001 if 3000 is occupied)
```

Verify in browser Network tab:
- HTTP requests to `/api/v2/spacemolt/get_status`, `/api/v2/spacemolt_market/view_market`, etc.
- WebSocket messages are receive-only (server push events)
- No more `_req_id` in WebSocket payloads for commands
