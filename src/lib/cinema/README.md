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

The same eligibility function governs both the tactical-page link and direct
cinema URLs. Completed does not automatically mean worth filming:

- Confirmed wildlife/creature encounters are excluded. A creature snapshot or
  terminal participant is sufficient, including mixed battles. Unknown historical
  kinds are not guessed into this exclusion.
- Records without damage, connected offensive force, a loss, a capture, or observed boarding contact are
  excluded. A logged latch, assault or plunder can qualify without hull damage.
  Rejected boarding orders, miss-only disengagements and empty/idle records get no film.
- A lossless battle in which every side's final recorded appearances escape is
  excluded. `stalemate` alone is insufficient: it also describes single-sided
  retreats and timeouts. Returning pilots reset their escape state.
- Ambushes, damaged single-sided escapes, arena knockouts, intact captures,
  stations, returning pilots, and mutual destruction remain supported. There is
  no absolute damage cutoff or PvP-only rule.

Excluded URLs explain the reason and link back to the battle record; they do not
present a retry loop or load the renderer.
Missing or stale summaries after log reconciliation expose Retry, as do records
with only aggregate statistics and no drawable participants.

The director preserves chronological arrival, capture, escape and destruction
milestones. It follows a recurring protagonist/opponent through selected setup,
firing, impact and reaction sequences, then resolves the actual outcome. Screen
direction stays consistent within an exchange. Repetitive exchanges are sampled;
chronology, health, movement, weapon flights and actor lifetimes are retimed
together. Idle server ticks consume no screen time. Selected volleys and consequences
receive short action budgets, with a brief opening and resolution; the edit does
not pad a sparse record to a minimum film length. Major wreck chunks persist through the final shot, including a battle
with no surviving ships.
The version and battle ID seed all choreography. Bump `DIRECTOR_VERSION` when intentionally changing that edit.

Each pilot appearance has a separate lifecycle. Arena losses disable intact
hulls. Missing or obsolete snapshots do not authorize extra destruction or
resurrection. Recorded zone transitions drive approach and withdrawal in `motion.ts`.
Formations hold fixed lanes and parallel headings toward the opposing side.
Combat retreat reverses while retaining that heading; a flee stance turns the hull
outward. Formations are shallow wedges with seeded depth, height and lane
jitter inside the lane clearance; live hulls sway, wander and bank slightly on
slow seeded cycles, frozen at fate. There is no orbit. Formation lanes
allow room for hulls to turn, and stations occupy a separate layer.
Source positions are not physical coordinates; scene formations are artistic. Captured prize IDs cannot always be mapped to the original hull
from historical public records, so the compiler does not guess such links.

### Boarding and continuous camera takes

Public boarding rows produce approach, breach, assault, withdrawal and plunder
cues. The exact event and operation identity remain attached to each cue;
casualty flags are qualitative and never become troop counts or progress bars.
Meaningful transitions retain screen time while repeated reports are sampled.
A rejected order creates no boarding effect. `capture_ready` does not establish
ownership transfer: only a capture record retires a hull as an intact prize.
Plunder means cargo theft followed by disengagement, not hull capture. Capture
sequences follow the matching boarding operation rather than unrelated gunfire.

`boarding-motion.ts` supplies deterministic, absolute-time blocking around the
recorded counterpart. The boarder approaches alongside the target with hull
clearance, keeps its existing heading, holds during contact, and releases on
withdrawal, plunder or a failed operation. Retirement freezes the applied offset
so an intact prize or wreck cannot jump back to its original formation slot.
Missing operation IDs use participant-pair context. These positions illustrate
observed contact; they are not tactical coordinates or personnel simulations.

A boarding operation keeps one continuous take over the smaller hull's shoulder,
following the live docking line. Other exchanges cut between role compositions
on the same side of the axis. Every path stays inside the framing and
ship-clearance constraints; the camera does not manufacture additional action.

Self-destruct records still have no bespoke countdown choreography. Confirmed
losses use the existing recorded outcome handling. Boarding adds no downloaded
models, textures, audio assets, external generation service or asset request.

### Goal-based camera planning

The chronological film remains the source of events. `shot-planner.ts` then plans
camera coverage against the assembled, posed hulls and current viewport. It scores
five candidate views per continuous take at up to six times, including selected
impact, capture and boarding-contact moments. Goals distinguish establishment,
scale, exchanges, contact and outcomes. Scoring uses clipped screen coverage,
minimum projected size, hull-bound occlusion, relative depth, prior participant
coverage, repeated compositions and transition cost.

`camera.ts` composes each shot from its role. All shots stay on the camera side
of the pair axis, so screen direction holds across cuts:

| Role | Composition |
|---|---|
| geography, resolution (more than a pair) | Long-lens fleet master from behind and above the subject's formation toward the enemy; resolution rises over the field |
| geography (pair) | Side-on two-shot, both whole; from the side-back quarter above the smaller hull when one is 2.2 times larger; over the near hull's shoulder when the pair is far apart |
| introduction | Slow pass along one hull, close enough to read its painted name |
| arrival | From ahead of the arriving hull |
| protagonist, opposition | Three-quarter view from ahead of the bow, slow arc |
| setup | Low three-quarter from ahead of the shooter, arcing |
| fire | Over the shooter's shoulder onto the whole target; over the target's shoulder onto the whole shooter when the shooter is more than 6 times larger |
| reaction | The reverse: over the hit hull's shoulder back toward its attacker |
| impact | The hit hull alone at medium size from its front quarter; fire arrives from behind the camera |
| montage | Alternates the fire and impact compositions |
| resolution (lone or dominant victor) | Long lens on the victor with the field behind it; a captured prize stays in frame |
| any shot whose subject or target dies in it | The victim alone at medium size, room for the explosion |

Over-the-shoulder shots place the camera just far enough behind the front hull
that the downrange hull reads at about 7% of the frame width, with a lateral
offset that only just clears the front hull from the sightline. The lens then
widens (continuously) until both read. Other shots fill a fixed share of the
frame width with the framed hull and refine the distance continuously until its
projected hull box (and a required counterpart) fits. A counterpart that only
needs its center in frame costs a bounded pullback. A fleet whose principal
would be a speck yields to a long-lens view of that principal with its fleet
compressed behind it; that decision uses the field at the shot's first frame,
so it holds for the whole shot. Each role has a lens and a move (dolly,
push-in or arc) driven by shot progress. The renderer adds handheld drift and a
decaying shake from nearby losses and hull hits; both rotate the aim only.
Reduced motion removes arcs, dollies, drift and shake.

Candidates are cheap to cut between: the planner charges only a small cost for
changing composition. Between takes, a short
pan/dolly is accepted only when sampled views preserve required subjects and hull
clearance; incompatible geography or immediate key events retain a deliberate
cut. Reduced-motion playback skips these animated transitions. Sampling uses absolute
time so seeking and replay agree. Plans are cached per
viewport aspect and reduced-motion setting, not recomputed each frame. Development
canvas diagnostics expose goals, candidates, scores, coverage and unresolved
readability concerns. This is bounded heuristic planning, not a guarantee that all
participants in a large fleet are individually readable. It does not invent events
or add extra editorial takes to the source film.

### Painted participant names

`hull-markings.ts` paints the recorded participant name on up to two verified,
exposed hull/armor panels of each detailed model. Names use a small generated
canvas texture, nonemissive weathered ink and ordinary scene lighting. Lettering
grows on larger hulls when a clear panel permits, with smaller placement fallbacks;
small or obstructed hulls may omit it. The marking is
attached to the hull, never billboarded or resized for readability. Unicode text
is bounded and stripped of control characters. Both sides share one material and
texture, which is released by ordinary material disposal. No external fonts or
image requests are added.

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
with fractured pieces of that assembled hull and a shockwave. Structural wrecks
retain original surface details and construction colors, separate from their
original positions, and persist with bounded drift. Their geometry and materials
are independently owned, and absolute-time animation supports reversible seeking.
Arena knockouts cascade electrically and drift
with engines and running lights disabled. Consequences take priority over ordinary
volleys in the visual and sound pools. The renderer has automatic, high, medium and
low quality, pauses when hidden, and exposes a reduced-motion setting. Automatic
quality starts at medium on desktop and low on narrow screens. Render targets
have total-pixel ceilings (4/2/1 megapixels for high/medium/low), including large
HiDPI displays; graphics-error retries explicitly use low quality.

Lighting is a warm key from the visible star, leaning toward the camera side so
visible faces stay lit, a cold rim opposite the camera and a faint cool fill.
ACES tone mapping, bloom and a split-tone grade (cool shadows, warm highlights,
lifted midtones) let effects clip to white while space stays black. Each side
has one accent color on engine glow, trails, blinking running lights and a tint
of its weapon fire. Bolts keep a minimum screen thickness and flash at the
muzzle and at the hit. Shields ripple locally from the side facing the shooter;
only big hits light the whole shell, and shells fade as the camera nears them.
Destruction leads with the hull fracture: a white flash of about 0.1 s capped
at an eighth of the frame height, a main blast and 2, 4 or 6 seeded secondary
pops by hull size, a seeded flame temperature, fragments with ember trails, the
largest 2-4 wreck pieces burning for several seconds, a light pulse, and a faint
shockwave only for large hulls. Knockouts keep their electrical arcs. Beams are
a thin white-hot core inside a dim side-tinted glow; autocannons fire tracer
streams; railguns a hot slug with a fading trail; missiles corkscrew and leave
grey smoke. Muzzle flashes spill light onto the firing hull. Hull paint is
muted, panels keep a roughly constant world size, and painted names span about
a sixth of the hull with a faint self-glow. Arrivals decelerate out of a warp
streak. A seeded gas giant or rocky world with clouds, a terminator and a lit
limb sits at sky distance, and dust wrapped around the camera gives parallax.
Stations are three times their catalog size, well above the largest capital.

`weapons.ts` identifies 13 delivery families independently of damage type:
laser pulses, sustained beams, railgun needles, autocannon bursts, flak fans,
plasma packets, guided missiles, heavy torpedoes, electrical disruptors, exotic
energy, deployed mine packets, generic kinetic shots, and historical smartbombs.
This covers the audited 69 current catalog weapons and four historical smartbombs.
The public gun name is the identifier; `instance_id` is opaque. Oversized loadouts
rotate through a bounded six-family sample instead of always hiding later guns.
Ammo names and critical flags remain attached to their representative cues.

`weaponVisuals.ts` produces bounded geometry recipes with deterministic flight
and impact phases. Misses do not produce impact explosions. Absorbed hits light
shields. Chain and splash rows propagate from the recorded primary victim rather
than inventing another firing weapon. Smartbomb blasts are target-centered;
contact defenses do not become ranged guns. Current mine records describe
packets and attributed burns, so no persistent minefield is fabricated.

Only confirmed result fields produce behavior accents: actual restoration gives
local repair/recharge sweeps; actual shield drain collapses locally, while confirmed shield transfer
produces return-flow energy. These two drain behaviors and their beneficiaries
remain distinct when sampled. Calculated lifesteal amounts do not establish
realized healing and never authorize a return flow. Successful system disable produces electrical hull
arcs; an explicitly activated emergency cloak phases the hull and its lights.
Percentages, requested amounts, weapon names, and fitted modules alone do not
prove an effect occurred. Unknown remote repair sources never acquire invented
beams. These are short cinematic accents, not representations of mechanical
status durations or exact hardpoint positions.

`audio.ts` synthesizes the score and effects locally through Web Audio. It creates
or resumes its context from the Play gesture, limits transient voices, and
cancels existing sources on pause, seek and disposal. Families have distinct
onsets, burst envelopes, pitch, filter sweeps and noise/tone balance. A separate
audio schedule aligns railgun charge/release and victim-local impact sounds with
the final edited film. Misses have no impact sound; simultaneous batteries share
one representative impact and nearby destruction supplies its own sound. Behavior
accents remain quiet; casualty sounds can displace ordinary volley voices. No audio files, external
asset services, generation credentials or paid requests are required.

Development builds expose diagnostic `data-cinema-*` attributes on the canvas.
The counters include the entire postprocessing frame. They are not product UI.

## Verification

Station models use seven shared architecture recipes: five empire styles,
salvaged pirate construction, and a neutral utility station. Hero models share
the ships' procedural materials, recessed docks, service fittings, and articulated
weapons; distant models keep the main structure and omit fine equipment. Exact
known public base IDs can supply construction identity. Unknown bases stay neutral;
player faction IDs and station names are not treated as empire evidence.

Recorded station module entries supply battery types and counts, including empty
batteries. Older attack-only records use the maximum repeated battery count in a
single volley, never accumulated shots. Rendering uses at most twelve representative
mounts on sampled upper/lower surfaces; an explicitly empty fit stays unarmed.
Unknown fits receive a bounded generic battery. Samples use illustrative fits.

Run the repository catalog generation, TypeScript/lint, Bun tests, and production
build. Cinema tests exercise completion, editing, lifecycles, geometry, frame
boundaries, camera clearance and audio scheduling. Browser review is also required:
node tests cannot validate actual shader compilation or perceived sound quality.

Useful completed records checked during development:

- `e0ac0417818bd70c4af2421d228b7106`: 24-tick arena encounter, 10 actors, six knockouts.
- `2a76e1a1c796e9d8877fdeedb76867ec`: 4,430 ticks with repetitive middle, 14 recorded ship losses.
- `242b5fd8676d27c997f9dcd6b76a8cb7`: 1,735 ticks, returning pilots, 62 ship losses plus one station.

These IDs are test references, not bundled production fixtures. Always preserve
old-record fallbacks; live catalog details and log availability may change.

Additional edge-case audit (ten completed public records, September 6, 2026):
five retained and five excluded. Useful examples include
`4f3bbf5acb225c53991b5c9025205255` (mixed fleet weapons),
`3279115614a4a0891e04d3201c7d4e69` (station plus retreat),
`57b1527d0207b88d526c3a056f8644e8` (mutual departures), and
`f247e1a820d3e2aa13f0bcb1f5e91e1e` (creature plus Ion/EMP weapons).
The bounded recent sample contained no intact captures or confirmed disables,
cloaks, or drains; regression fixtures and explicitly synthetic browser scenes
cover those effects. Synthetic scenes are test tools, never production films.

Boarding follow-up, September 7, 2026: `627178229d01ef77d719015ca68e3493`
records LT1428 and Yor Graves against Zaggle in Skyreach. Yor Graves closes,
loses and regains ground, then latches and captures Zaggle in the same source
tick. The public fixture exercises an authentic intact capture and preserves
that within-tick ordering.
