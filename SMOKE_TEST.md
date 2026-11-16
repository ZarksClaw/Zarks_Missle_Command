# Smoke test

Logic checks: `npm run check`

In the browser:

- [ ] App boots, canvas fills the window, settings start closed
- [ ] Click or Space enters PLAYING
- [ ] Reticle tracks the pointer; a dashed line marks the battery that will fire
- [ ] Click or Space launches from the nearest battery with ammo
- [ ] Empty batteries show BATTERIES EMPTY and do not fire
- [ ] Enemy missiles move toward a locked city or battery
- [ ] An explosion intercept destroys the missile and can raise the combo
- [ ] A hit destroys only the aimed defense, not a distant neighbor
- [ ] Hollow decoys fizzle; split warheads break apart; zigzag missiles weave
- [ ] From wave 3, odd waves include a bomber that can be shot down
- [ ] Wave clear shows kills/shot, peak combo, and bonus, then advances
- [ ] Pause and resume (`P`, `Esc`, or click)
- [ ] Restart (`R`) keeps settings and restores cities
- [ ] Mute (`M`), colorblind (`C`), reduced motion (`N`), visual preset (`V`)
- [ ] F1 opens settings; Esc closes them without also pausing
- [ ] High score and local top five survive game over and restart
- [ ] Arrows / WASD move the reticle; Shift slows them
- [ ] No console errors during a wave
