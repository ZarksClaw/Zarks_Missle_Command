# CHANGELOG

## Current progress

- Scaffolded Vite + Canvas game project
- Fixed-step loop and menu / playing / paused / wave-clear / game-over flow
- Cities, batteries, ammo, waves, high score, accessibility toggles, synthesized SFX

## Playability pass

- Batteries and cities use the classic S-CCC-S-CCC-S layout instead of overlapping
- Enemy missiles keep a locked target and only destroy it inside the hit radius
- Split timing uses path progress, not remaining distance
- A last-city kill ends the run even if that missile also cleared the wave
- Combo multiplies intercept score, decays, and resets when a defense is lost
- Keyboard aim, a reticle, and a line to the battery that will fire
- Zigzag missiles, decoys, and bombers
- Wave card shows kills per shot, peak combo, and bonus; game over keeps a local top five
- Settings overlay no longer steals the playfield; hotkey changes persist
- Restart keeps volume, palette, and motion settings
- Trails and stars no longer use a shadow blur per fragment; particle count is capped
- Incoming calls are per rocket type and capped at two at a time, so a wave does not become a siren
- Trails fade into a hot core, blasts throw a shockwave and sparks, and city hits flash the screen. Reduced motion skips the flash and the extra rings.
- Each rocket type has its own incoming call. The flyer is a saucer with a panning hum and a drop zap.
- A finished top score asks for 3 alphanumeric initials. The title screen rotates scores, how to play, and how to start.
