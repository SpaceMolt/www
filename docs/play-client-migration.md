# /play Client Architecture: @spacemolt/lib

## Where we are

The /play client is a consumer of [`@spacemolt/lib`](https://github.com/SpaceMolt/spacemolt-lib)
(npm), the maintained TypeScript library for SpaceMolt. All gameplay runs over one
WebSocket-v2 connection (`/ws/v2`, the `{tool, action, payload, request_id}` protocol);
HTTP is used only for bulk data (`/api/catalog.json`, `/api/map`) and the Clerk-gated
ws-token mint. There is no hand-rolled transport, no command-name translation table, no
response-shape sniffing, and no client-side type generation — command params and response
types are the lib's, generated from the server's OpenAPI spec and kept current by the
lib's spec-sync CI.

Two earlier generations of this client are gone: the original WebSocket client that
classified responses by sniffing field presence, and the HTTP-v2 client that replaced it
(hand-rolled `GameApi`, `COMMAND_MAP`, a ~40-case reducer, per-page openapi-typescript
generation). Both are deleted; git history has them.

## Layers

**`src/lib/spacemolt/`** — React bindings over the lib (no /play-specific knowledge):

- `AccountProvider` owns one `Account` per selected player: connect → authenticate with a
  fresh single-use ws-token per (re)connect (minted via lib `mintWsToken` with the Clerk
  session JWT or dev-mode header from `useGameAuth`) → dispose on player switch/unmount.
  StrictMode-safe; reconnect/backoff/resubscribe are the lib's.
- `accountStore` adapts the Account to `useSyncExternalStore`: per-section subscriptions
  over the lib's 8-section state cache, a connection phase machine
  (`connecting/authenticating/ready/reconnecting/session_replaced/disconnected/error`),
  market/observation versions, the pending-action slice, and the tick clock.
- Hooks: `usePlayer/useShip/useCargo/useModules/useLocationState/useMissions/useQueue/`
  `useSkills`, `useConnectionPhase`, `useCurrentTick`, `usePendingAction`;
  `useCommandQuery` (panel-local reads with section/notification-driven refresh);
  `useCommandMutation` (two-phase tick-queued mutations feeding the pending-action UX);
  `useMarket`/`useObservation` (live subscriptions); `useSystem`/`usePoi` (refreshed on
  location changes); `useMap`/`useCatalog` (shared bulk caches).
- `uiStore` + `wireNotifications`: UI-local state the lib doesn't cache — event log,
  chat, pending trades, battle view, toasts, craft-job deltas — fed by typed server
  pushes.

**`src/components/play/`** — UI only:

- `PlayClient` — Clerk gate, player selection/registration, mounts `AccountProvider` +
  `PlayProvider`, maps connection phases to screens.
- `PlayProvider` — creates the uiStore, wires notifications, seeds chat/trades from the
  login payload, runs a slow visibility-aware `account.refresh()` (~30s) for out-of-band
  state changes. Panels use `usePlay()`/`usePlayUi(selector)`.
- Panels read state via the hooks and issue commands via the typed facade
  (`account.commands.<tool>.<action>(params)` — signatures in the lib's COMMANDS.md).
  View data (market, orders, storage, fleet, …) is panel-local `useCommandQuery` state.
- `src/components/play/types.ts` holds the few genuinely UI-local types (crafting
  job/quote mirrors, row extracts from the lib's response unions).

## Conventions

- **No polling loops.** State stays current via mutation deltas, market/observation
  subscriptions, and the 30s safety refresh. Don't add per-panel intervals.
- **Mutations reject with `SpacemoltError`** — catch and surface via
  `uiStore.dispatch({type:'toast'|'event', kind:'danger', ...})`.
- **Response unions**: unified actions (`spacemolt_storage.view`, `spacemolt_facility.*`)
  return generated unions; narrow with `Extract<Union, { required_field: unknown }>` —
  the discriminator field must be *required* on the target member or Extract resolves to
  `never`.
- **Known server-side gaps** (re-add UI when the spec grows them): the v2 player section
  lacks `trading_restricted_until`; `/api/stations` has no lib binding (GalaxyPanel keeps
  one raw fetch); the observation feed is players-only (pirate presence refreshes via
  deltas/refresh).

## Local development

```bash
# gameserver (in-memory, dev auth):
cd gameserver && CLERK_SECRET_KEY="" DATABASE_URL="" go run ./cmd/server/
# www:
NEXT_PUBLIC_DEV_MODE=true NEXT_PUBLIC_GAMESERVER_URL=http://localhost:8080 npx next dev -p 3099
```

Verify in the browser Network tab: one WebSocket to `/ws/v2` carrying both commands and
pushes; no `/api/v2/{tool}/{action}` POSTs; HTTP only for `/api/catalog.json`, `/api/map`,
`/api/stations`, and `/api/player/{id}/ws-token`.
