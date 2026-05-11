// Synthesised sound effects + Seven Nation Army BGM — Web Audio API, no external files.
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

  // --- Seven Nation Army — The White Stripes ---
  //
  // Riff: E E G E D C B  (two bars of 4/4 at 120 BPM)
  // Each entry: [frequency_hz, length_in_16th_notes]
  // 16th note = 0.125 s at 120 BPM
  //
  // Drums: kick on beats 1 & 3, snare on beats 2 & 4 (classic rock)
  //        expressed as 16th-note positions within the 32-unit cycle.

  const _16TH = 60 / 120 / 4; // 0.125 s

  const _RIFF = [
    [164.81, 6],  // E3  dotted quarter
    [164.81, 4],  // E3  quarter
    [196.00, 2],  // G3  eighth
    [164.81, 4],  // E3  quarter
    [146.83, 2],  // D3  eighth
    [130.81, 4],  // C3  quarter
    [123.47, 10], // B2  fill to end of 2 bars (32 total)
  ];
  const _RIFF_CYCLE = _RIFF.reduce((s, [, d]) => s + d, 0); // 32

  const _KICKS  = new Set([0, 8, 16, 24]);
  const _SNARES = new Set([4, 12, 20, 28]);

  // Kick drum — pitched sine that drops fast (thud)
  function _kick(t) {
    const c = getCtx();
    const osc  = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t); osc.stop(t + 0.32);
  }

  // Snare — noise burst through highpass filter
  function _snare(t) {
    const c = getCtx();
    const len = Math.ceil(c.sampleRate * 0.11);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src  = c.createBufferSource();
    const filt = c.createBiquadFilter();
    const gain = c.createGain();
    src.buffer = buf;
    filt.type = 'highpass'; filt.frequency.value = 2500;
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    src.connect(filt); filt.connect(gain); gain.connect(c.destination);
    src.start(t); src.stop(t + 0.14);
  }

  let _bgm = null;

  function _scheduleBGM() {
    if (!_bgm) return;
    const c = getCtx();
    const AHEAD = 0.4;

    // --- Riff voice ---
    while (_bgm.noteNext < c.currentTime + AHEAD) {
      const [freq, units] = _RIFF[_bgm.noteIdx];
      const dur = units * _16TH;
      // Main voice — sawtooth for guitar-like bite
      blip(freq,     _bgm.noteNext, dur * 0.88, 0.12, 'sawtooth');
      // Sub-octave bass reinforcement
      blip(freq / 2, _bgm.noteNext, dur * 0.88, 0.05, 'triangle');
      _bgm.noteNext += dur;
      _bgm.noteIdx = (_bgm.noteIdx + 1) % _RIFF.length;
    }

    // --- Drums (independent 16th-note grid) ---
    while (_bgm.drumNext < c.currentTime + AHEAD) {
      const pos = _bgm.drumPos;
      if (_KICKS.has(pos))  _kick(_bgm.drumNext);
      if (_SNARES.has(pos)) _snare(_bgm.drumNext);
      _bgm.drumNext += _16TH;
      _bgm.drumPos = (pos + 1) % _RIFF_CYCLE;
    }

    _bgm.timerId = setTimeout(_scheduleBGM, 80);
  }

  function startBGM() {
    if (_bgm) return;
    const c = getCtx();
    const t = c.currentTime + 0.05;
    _bgm = { noteIdx: 0, noteNext: t, drumPos: 0, drumNext: t, timerId: null };
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

    // Start BGM once the game is live (handles first tick or return from waiting)
    if (!_bgm) startBGM();
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
           startSiren, stopSiren, startBGM, stopBGM, update };
})();
