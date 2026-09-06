# Battle cinema

The `/battles/[id]/cinematic` route adapts completed public battle records into an
original procedural 3D short. It lives outside the console layout; Three.js and
its effects load only after the cinema route has reconciled a complete record.
The tactical viewer links to it only after the same completion gate.

## Data and direction

`director.ts` compiles a serializable film in `director.worker.ts`. The shared
battle loader handles pagination and final-write reconciliation. Do not shortcut
its `complete` phase: a terminal row can arrive before older ticks are persisted.
Interrupted records without a real conclusion cannot be filmed.

The director preserves chronological arrival, capture, escape and destruction
milestones. It samples repetitive firing exchanges and assigns 72% of combat
screen time to consequential neighborhoods. Consequence shots begin before the impact and hold its reaction; clustered
losses prioritize a nearby event instead of framing an empty fleet-wide center.
The version and battle ID seed all choreography. Bump `DIRECTOR_VERSION` when intentionally changing that edit.

Each pilot appearance has a separate lifecycle. Arena losses disable intact
hulls. Missing or obsolete snapshots do not authorize extra destruction or
resurrection. Recorded zone transitions drive approach and withdrawal in `motion.ts`. Continuous
naval sweeps, class-sensitive banking and engine wakes supply cinematic movement;
formation lanes allow room for hulls to turn, and stations occupy a separate layer.
Source positions are not physical coordinates; scene formations are artistic. Captured prize IDs cannot always be mapped to the original hull
from historical public records, so the compiler does not guess such links.

## Rendering and audio

`appearance.ts` projects the public catalog server-side into visual metadata.
`ships.ts` constructs ten hull families with empire variations, merged surface
geometry, shader-generated plating, and engine assemblies. Each empire has a
distinct construction style and broad livery; pirate hulls retain their own
scavenged identity instead of resolving to a neutral palette. Scale follows the
canonical ladder in gameserver `data/ships/CLAUDE.md`; tier does not affect size.
Representative 16/48/150/450/1200-meter hulls receive modest cinematic compression.

`scene.ts` owns the canvas, camera, postprocessing, instance pools and cleanup.
Nearby featured ships use detailed meshes; other ships use instanced reduced
hull geometry by family. Effect and sound ranges are binary-searchable for
seeking and bounded playback work. Destruction replaces the intact silhouette
with fragments and a shockwave; arena knockouts cascade electrically and drift
with engines and running lights disabled. Consequences take priority over ordinary
volleys in the visual and sound pools. The renderer has automatic, high, medium and
low quality, pauses when hidden, and exposes a reduced-motion setting.

`audio.ts` synthesizes the score and effects locally through Web Audio. It creates
or resumes its context from the Play gesture, limits transient voices, and
cancels existing sources on pause, seek and disposal. No audio files, external
asset services, generation credentials or paid requests are required.

Development builds expose diagnostic `data-cinema-*` attributes on the canvas.
The counters include the entire postprocessing frame. They are not product UI.

## Verification

Run the repository catalog generation, TypeScript/lint, Bun tests, and production
build. Cinema tests exercise completion, editing, lifecycles, geometry, frame
boundaries, camera clearance and audio scheduling. Browser review is also required:
node tests cannot validate actual shader compilation or perceived sound quality.

Useful completed records checked during development:

- `e0ac0417818bd70c4af2421d228b7106`: 24-tick arena encounter, 10 actors, six knockouts; 73-second film.
- `2a76e1a1c796e9d8877fdeedb76867ec`: 4,430 ticks with repetitive middle, 14 recorded ship losses; 118-second film.
- `242b5fd8676d27c997f9dcd6b76a8cb7`: 1,735 ticks, returning pilots, 62 ship losses plus one station; 142-second film.

These IDs are test references, not bundled production fixtures. Always preserve
old-record fallbacks; live catalog details and log availability may change.
