// Synthesised sound effects — Web Audio API, no external files.
const audio = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function blip(freq, startTime, duration, vol = 0.14, wave = 'square') {
    const c = getCtx();
    const osc  = c.createOscillator();
    const gain = c.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(c.destination);
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.linearRampToValueAtTime(0, startTime + duration - 0.008);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  // --- Sound effects ---

  let _chompPhase = 0;
  function chomp() {
    const c = getCtx();
    blip(_chompPhase++ % 2 === 0 ? 440 : 330, c.currentTime, 0.075);
  }

  function powerPellet() {
    const c = getCtx();
    const t = c.currentTime;
    [200, 300, 420, 560].forEach((f, i) => blip(f, t + i * 0.042, 0.055, 0.18));
  }

  function eatGhost() {
    const c = getCtx();
    const t = c.currentTime;
    [180, 280, 400, 560].forEach((f, i) => blip(f, t + i * 0.048, 0.052, 0.16));
  }

  function death() {
    const c = getCtx();
    const t = c.currentTime;
    [587,554,523,494,466,440,415,392,370,349,330,311].forEach((f, i) =>
      blip(f, t + i * 0.07, 0.085, 0.17)
    );
  }

  function victory() {
    const c = getCtx();
    let t = c.currentTime + 0.05;
    [[392,0.1],[494,0.1],[587,0.1],[659,0.12],[784,0.22],[659,0.1],[784,0.38]]
      .forEach(([f, d]) => { blip(f, t, d, 0.15); t += d + 0.02; });
  }

  // --- Scared-ghost siren ---
  let _siren = null;

  function startSiren() {
    if (_siren) return;
    const c = getCtx();
    const osc = c.createOscillator(), lfo = c.createOscillator();
    const lfoG = c.createGain(), mGain = c.createGain();
    osc.type = 'square'; osc.frequency.value = 290;
    lfo.frequency.value = 5; lfoG.gain.value = 110; mGain.gain.value = 0.07;
    lfo.connect(lfoG); lfoG.connect(osc.frequency);
    osc.connect(mGain); mGain.connect(c.destination);
    lfo.start(); osc.start();
    _siren = { osc, lfo, mGain };
  }

  function stopSiren() {
    if (!_siren) return;
    try {
      const c = getCtx();
      _siren.mGain.gain.linearRampToValueAtTime(0, c.currentTime + 0.06);
      _siren.osc.stop(c.currentTime + 0.08);
      _siren.lfo.stop(c.currentTime + 0.08);
    } catch (_) {}
    _siren = null;
  }

  // --- Called every game_state tick ---
  function update(state, prevState) {
    if (!state || state.phase !== 'playing') return;

    const anyScared    = Object.values(state.ghosts).some(g => g.scared);
    const wasAnyScared = prevState && Object.values(prevState.ghosts).some(g => g.scared);
    const justAtePower = !wasAnyScared && anyScared;

    if (justAtePower) powerPellet();
    if (anyScared) startSiren(); else stopSiren();

    if (prevState && state.dotsRemaining < prevState.dotsRemaining && !justAtePower) {
      chomp();
    }

    if (prevState) {
      for (const name of Object.keys(state.ghosts)) {
        const prev = prevState.ghosts[name];
        const cur  = state.ghosts[name];
        if (prev && prev.scared && !cur.scared) {
          const jumped = Math.abs(prev.col - cur.col) + Math.abs(prev.row - cur.row);
          if (jumped > 4) eatGhost();
        }
      }
    }
  }

  // Unlock AudioContext on first user gesture
  const _unlock = () => {
    try { getCtx(); } catch (_) {}
    document.removeEventListener('pointerdown', _unlock);
    document.removeEventListener('keydown',     _unlock);
  };
  document.addEventListener('pointerdown', _unlock);
  document.addEventListener('keydown',     _unlock);

  return { chomp, powerPellet, eatGhost, death, victory,
           startSiren, stopSiren, update };
})();
