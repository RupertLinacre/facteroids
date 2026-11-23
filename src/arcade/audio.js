// Small procedural sound bank. All sources use the same mute bus and limiter.
export function instrument() {
  let ctx,
    master,
    limiter,
    noise,
    muted = false,
    paused = false;
  const active = new Set(),
    last = new Map();
  function volume() {
    if (master)
      master.gain.setTargetAtTime(
        muted || paused || document.hidden ? 0 : 0.7,
        ctx.currentTime,
        0.015,
      );
  }
  function unlock() {
    if (!window.AudioContext) return;
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -15;
      limiter.knee.value = 10;
      limiter.ratio.value = 9;
      master.connect(limiter).connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++)
        samples[i] = Math.random() * 2 - 1;
      volume();
      document.addEventListener("visibilitychange", volume);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  }
  function voice(
    kind,
    from,
    to,
    length,
    gain,
    pan = 0,
    delay = 0,
    attack = 0.008,
  ) {
    if (!ctx || muted || paused || document.hidden || active.size >= 64) return;
    const t = ctx.currentTime + delay;
    const hiss = kind === "noise";
    const src = hiss ? ctx.createBufferSource() : ctx.createOscillator();
    let filter, freq;
    if (hiss) {
      src.buffer = noise;
      src.loop = true;
      filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 0.85;
      src.connect(filter);
      freq = filter.frequency;
    } else {
      src.type = kind;
      freq = src.frequency;
    }
    freq.setValueAtTime(from, t);
    freq.exponentialRampToValueAtTime(to, t + length);
    const env = ctx.createGain(),
      position = ctx.createStereoPanner();
    position.pan.value = Math.max(-0.92, Math.min(0.92, pan));
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + length);
    (filter ?? src).connect(env).connect(position).connect(master);
    active.add(src);
    src.onended = () => {
      active.delete(src);
      src.disconnect();
      filter?.disconnect();
      env.disconnect();
      position.disconnect();
    };
    if (hiss) src.start(t, Math.random() * 0.8);
    else src.start(t);
    src.stop(t + length + 0.02);
  }
  function effect(key, x, count = 1) {
    if (!ctx || muted || paused || document.hidden) return;
    const t = ctx.currentTime;
    // A full factorisation can produce dozens of simultaneous fragments.
    if (t - (last.get(key) ?? -10) < (key === "approach" ? 0.8 : 0.09)) return;
    last.set(key, t);
    const pan = (x - 450) / 450;
    const play = (kind, from, to, seconds, level, delay, attack) =>
      voice(kind, from, to, seconds, level, pan, delay, attack);
    switch (key) {
      case "deploy":
        play("noise", 440, 1600, 0.2, 0.14);
        play("triangle", 210, 660, 0.29, 0.095, 0.025, 0.045);
        break;
      case "launch":
        play("sine", 120, 48, 0.24, 0.29);
        play("triangle", 270, 1350, 0.24, 0.14, 0.018);
        play("noise", 900, 4700, 0.3, 0.21, 0.04, 0.038);
        if (count >= 3) play("sawtooth", 122, 36, 0.33, 0.1);
        if (count >= 4) play("sine", 1150, 150, 0.46, 0.19, 0.04);
        break;
      case "split":
        play("sine", 145, 39 / count, 0.33 * count, 0.27);
        play("noise", 5500, 740 / count, 0.16 * count, 0.36);
        play("sine", 155, 53, 0.38, 0.24);
        [742, 1109, 1732].forEach((hz, i) =>
          voice(
            "sine",
            hz,
            hz * 0.96,
            0.41 + i * 0.09,
            0.11,
            pan + (i - 1) * 0.26,
            i * 0.034,
          ),
        );
        break;
      case "approach":
        play("noise", 520, 2400, 1.3, 0.16, 0, 0.42);
        play("sine", 330, 255, 0.87, 0.07, 0.11, 0.23);
        break;
      case "reentry":
        play("noise", 680, 3600, 0.95, 0.22, 0, 0.2);
        [523, 659, 784, 1047].forEach((hz, i) =>
          voice(
            "sine",
            hz * 0.96,
            hz,
            0.62,
            0.12,
            pan + (i - 1.5) * 0.18,
            i * 0.082,
          ),
        );
        break;
      case "impact":
        play("noise", 320, 75, 1.35, 0.36, 0.13, 0.08);
        play("sine", 115, 31, 0.83, 0.48);
        play("noise", 1500, 110, 0.94, 0.45, 0, 0.015);
        play("triangle", 84, 35, 0.55, 0.17, 0.085);
        break;
    }
  }
  return {
    unlock,
    effect,
    note(hz, duration = 0.17, type = "sine", gain = 0.045) {
      voice(type, hz, hz, duration, gain);
    },
    toggle() {
      muted = !muted;
      volume();
      return muted;
    },
    pause(value) {
      paused = value;
      volume();
    },
    reset() {
      for (const src of active) src.stop();
      last.clear();
      paused = false;
      volume();
    },
  };
}
