// Synthesised Pac-Man sound effects + chiptune BGM — Web Audio API, no external files.
const audio = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Schedule a single oscillator note
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
    stopBGM();
    const c = getCtx();
    const t = c.currentTime;
    [587,554,523,494,466,440,415,392,370,349,330,311].forEach((f, i) =>
      blip(f, t + i * 0.07, 0.085, 0.17)
    );
  }

  function victory() {
    stopBGM();
    const c = getCtx();
    let t = c.currentTime + 0.05;
    [[392,0.1],[494,0.1],[587,0.1],[659,0.12],[784,0.22],[659,0.1],[784,0.38]]
      .forEach(([f, d]) => { blip(f, t, d, 0.15); t += d + 0.02; });
  }

  function intro() {
    const c = getCtx();
    let t = c.currentTime + 0.08;
    [
      [494,0.10],[494,0.10],[740,0.10],[494,0.10],[784,0.10],
      [494,0.08],[932,0.10],[880,0.10],[831,0.10],[784,0.10],
      [494,0.10],[659,0.10],[831,0.10],[880,0.30],
    ].forEach(([f, d]) => { blip(f, t, d, 0.13); t += d + 0.012; });
  }

  // --- Scared-ghost siren ---
  let _siren = null;

  function startSiren() {
    if (_siren) return;
    const c = getCtx();
    const osc  = c.createOscillator();
    const lfo  = c.createOscillator();
    const lfoG = c.createGain();
    const mGain = c.createGain();
    osc.type = 'square';
    osc.frequency.value = 290;
    lfo.frequency.value = 5;
    lfoG.gain.value     = 110;
    mGain.gain.value    = 0.07;
    lfo.connect(lfoG);
    lfoG.connect(osc.frequency);
    osc.connect(mGain);
    mGain.connect(c.destination);
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

  // --- 1980s chiptune background music ---
  //
  // Two-voice lookahead scheduler:
  //   voice 1 — melody (square wave, high register)
  //   voice 2 — bass   (triangle wave, low register)
  //
  // Tempo: 160 BPM.  One unit = one 16th note ≈ 0.094 s.
  // Melody/bass arrays have 64 entries = 4 bars of 4/4 = ~6-second loop.
  // 0 = rest.

  const _U = 60 / 160 / 4; // 16th-note duration in seconds

  //  Melody — C major, bouncy arcade feel
  const _MEL = [
    // bar 1  E5  .   E5  G5    E5  D5  C5  B4    C5   .  E5  G5    A5  G5  F5  E5
             659, 0, 659,784,  659,587,523,494,  523,  0,659,784,  880,784,698,659,
    // bar 2  D5  E5  F5  G5    A5   .  G5   .    F5  E5  D5   .    C5   .   .   .
             587,659,698,784,  880,  0,784,  0,  698,659,587,  0,  523,  0,  0,  0,
    // bar 3  C5  E5  G5  A5    C6   .  A5  G5    F5  G5  A5  G5    F5  E5  D5  C5
             523,659,784,880, 1047,  0,880,784,  698,784,880,784,  698,659,587,523,
    // bar 4  E5   .  F5  E5    D5  C5  B4  C5    D5  E5  D5   .    C5   .   .   .
             659,  0,698,659,  587,523,494,523,  587,659,587,  0,  523,  0,  0,  0,
  ];

  //  Bass — half-bar (8 units) per note, I–V–vi–IV–I–V–IV–V pattern
  //  C3=131  G3=196  A3=220  F3=175
  const _BAS = [
    131,0,0,0,0,0,0,0,  196,0,0,0,0,0,0,0,   // bar 1 : C - G
    220,0,0,0,0,0,0,0,  175,0,0,0,0,0,0,0,   // bar 2 : Am - F
    131,0,0,0,0,0,0,0,  196,0,0,0,0,0,0,0,   // bar 3 : C - G
    175,0,0,0,0,0,0,0,  196,0,0,0,0,0,0,0,   // bar 4 : F - G
  ];

  let _bgm = null;

  function _scheduleBGM() {
    if (!_bgm) return;
    const c = getCtx();
    const AHEAD = 0.3; // schedule this many seconds ahead

    while (_bgm.nextTime < c.currentTime + AHEAD) {
      const i = _bgm.idx % _MEL.length;
      if (_MEL[i] > 0) blip(_MEL[i], _bgm.nextTime, _U * 0.82, 0.055, 'square');
      if (_BAS[i] > 0) blip(_BAS[i], _bgm.nextTime, _U * 6,    0.04,  'triangle');
      _bgm.nextTime += _U;
      _bgm.idx++;
    }

    _bgm.timerId = setTimeout(_scheduleBGM, 80);
  }

  function startBGM() {
    if (_bgm) return;
    const c = getCtx();
    _bgm = { idx: 0, nextTime: c.currentTime + 0.05, timerId: null };
    _scheduleBGM();
  }

  function stopBGM() {
    if (!_bgm) return;
    clearTimeout(_bgm.timerId);
    _bgm = null;
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

    // Game just started — play intro then kick off BGM
    if (prevState && prevState.phase === 'waiting' && state.phase === 'playing') {
      intro();
      setTimeout(startBGM, 2000); // start after the intro jingle finishes
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

  return { chomp, powerPellet, eatGhost, death, victory, intro,
           startSiren, stopSiren, startBGM, stopBGM, update };
})();
