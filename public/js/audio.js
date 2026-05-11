// Synthesised sound effects + Seven Nation Army BGM — Web Audio API, no external files.
const audio = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Plain oscillator note (used by SFX)
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

  // Distorted guitar note — sawtooth → waveshaper → lowpass, plus clean sub-octave bass
  function _distCurve(amount) {
    const n = 512, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }
  const _DIST_CURVE = _distCurve(280);

  function _riffNote(freq, t, dur, vol = 0.15) {
    const c = getCtx();

    // Distorted upper voice
    const osc1 = c.createOscillator();
    const ws   = c.createWaveShaper();
    const lp   = c.createBiquadFilter();
    const g1   = c.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.value = freq;
    ws.curve = _DIST_CURVE;
    ws.oversample = '4x';
    lp.type = 'lowpass'; lp.frequency.value = 2800; lp.Q.value = 1.2;
    osc1.connect(ws); ws.connect(lp); lp.connect(g1); g1.connect(c.destination);
    g1.gain.setValueAtTime(vol, t);
    g1.gain.setValueAtTime(vol * 0.85, t + dur * 0.15);
    g1.gain.linearRampToValueAtTime(0, t + dur - 0.01);
    osc1.start(t); osc1.stop(t + dur);

    // Clean sub-octave bass (triangle, one octave down)
    const osc2 = c.createOscillator();
    const g2   = c.createGain();
    osc2.type = 'triangle';
    osc2.frequency.value = freq / 2;
    osc2.connect(g2); g2.connect(c.destination);
    g2.gain.setValueAtTime(vol * 0.45, t);
    g2.gain.linearRampToValueAtTime(0, t + dur - 0.01);
    osc2.start(t); osc2.stop(t + dur);
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

  // -----------------------------------------------------------------------
  // Seven Nation Army BGM
  //
  // Tempo : 124 BPM  →  16th note = 60/124/4 ≈ 0.121 s
  //
  // Riff  : E3 E3 G3 E3 D3 C3 B2 (rest)   — 2 bars of 4/4
  //         Each entry: [freq_hz, length_in_16ths]   0 freq = rest
  //
  // Drums : BOOM–boom–CLAP pattern (what makes the song recognisable)
  //   Kick  : beat 1 AND the "and" of beat 1   (16th positions 0 & 2)
  //   Snare : beat 3 only                       (16th position  8)
  //   Hi-hat: every quarter note                (positions 0,4,8,12)
  //   (same pattern repeated in bar 2, positions +16)
  // -----------------------------------------------------------------------

  const _BPM  = 124;
  const _16TH = 60 / _BPM / 4; // ≈ 0.121 s

  // Riff: 6+4+2+4+2+4+8+2 = 32 sixteenth notes
  const _RIFF = [
    [164.81, 6],  // E3  dotted quarter
    [164.81, 4],  // E3  quarter
    [196.00, 2],  // G3  eighth
    [164.81, 4],  // E3  quarter
    [146.83, 2],  // D3  eighth
    [130.81, 4],  // C3  quarter
    [123.47, 8],  // B2  half note
    [0,      2],  // rest before loop
  ];
  const _RIFF_CYCLE = _RIFF.reduce((s, [, d]) => s + d, 0); // 32

  // BOOM–boom–CLAP drum positions (per 32-unit two-bar cycle)
  const _KICKS  = new Set([0, 2,  16, 18]); // beats 1 & "and of 1" in each bar
  const _SNARES = new Set([8, 24]);          // beat 3 in each bar
  const _HIHATS = new Set([0, 4, 8, 12, 16, 20, 24, 28]); // every quarter

  // Kick: pitched sine drop (thud)
  function _kick(t) {
    const c = getCtx();
    const osc = c.createOscillator(), gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.13);
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t); osc.stop(t + 0.35);
  }

  // Snare: noise through bandpass + sine body
  function _snare(t) {
    const c = getCtx();
    // Noise component
    const len = Math.ceil(c.sampleRate * 0.14);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src  = c.createBufferSource();
    const hp   = c.createBiquadFilter();
    const ng   = c.createGain();
    src.buffer = buf;
    hp.type = 'highpass'; hp.frequency.value = 2200;
    ng.gain.setValueAtTime(0.28, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    src.connect(hp); hp.connect(ng); ng.connect(c.destination);
    src.start(t); src.stop(t + 0.16);
    // Tone body (snare "crack")
    const osc = c.createOscillator(), og = c.createGain();
    osc.type = 'triangle'; osc.frequency.value = 200;
    og.gain.setValueAtTime(0.18, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(og); og.connect(c.destination);
    osc.start(t); osc.stop(t + 0.07);
  }

  // Hi-hat: very short high-frequency noise
  function _hihat(t) {
    const c = getCtx();
    const len = Math.ceil(c.sampleRate * 0.04);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    const hp  = c.createBiquadFilter();
    const g   = c.createGain();
    src.buffer = buf;
    hp.type = 'highpass'; hp.frequency.value = 7000;
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(hp); hp.connect(g); g.connect(c.destination);
    src.start(t); src.stop(t + 0.05);
  }

  let _bgm = null;

  function _scheduleBGM() {
    if (!_bgm) return;
    const c = getCtx();
    const AHEAD = 0.4;

    // Riff notes (variable length, independent pointer)
    while (_bgm.noteNext < c.currentTime + AHEAD) {
      const [freq, units] = _RIFF[_bgm.noteIdx];
      const dur = units * _16TH;
      if (freq > 0) _riffNote(freq, _bgm.noteNext, dur);
      _bgm.noteNext += dur;
      _bgm.noteIdx = (_bgm.noteIdx + 1) % _RIFF.length;
    }

    // Drums (fixed 16th-note grid, independent pointer)
    while (_bgm.drumNext < c.currentTime + AHEAD) {
      const pos = _bgm.drumPos;
      if (_KICKS.has(pos))  _kick(_bgm.drumNext);
      if (_SNARES.has(pos)) _snare(_bgm.drumNext);
      if (_HIHATS.has(pos)) _hihat(_bgm.drumNext);
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
