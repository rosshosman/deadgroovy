import { stepDuration, stepTime, wavPCM } from "./model.js";
const noiseCache = new WeakMap();
function noise(ctx) {
  if (noiseCache.has(ctx)) return noiseCache.get(ctx);
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate),
    d = b.getChannelData(0);
  let seed = 87351;
  for (let i = 0; i < d.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    d[i] = seed / 2147483648 - 1;
  }
  noiseCache.set(ctx, b);
  return b;
}
export function voice(ctx, dest, track, time, step = 0, register = () => {}) {
  const nodes = [];
  function envelope(level, length, attack = .003) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(level, time + attack);
    g.gain.exponentialRampToValueAtTime(.0001, time + length);
    g.connect(dest);
    return g;
  }
  function osc(type, freq, level, len, end) {
    const o = ctx.createOscillator(), g = envelope(level, len);
    o.type = type;
    o.frequency.setValueAtTime(freq, time);
    if (end) o.frequency.exponentialRampToValueAtTime(end, time + .12);
    o.connect(g);
    o.start(time);
    o.stop(time + len + .01);
    register(o);
    nodes.push(o);
    o.addEventListener("ended", () => {
      o.disconnect();
      g.disconnect();
    });
    return o;
  }
  function hiss(freq, level, len) {
    const src = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      g = envelope(level, len, .001);
    src.buffer = noise(ctx);
    filter.type = "highpass";
    filter.frequency.value = freq;
    src.connect(filter);
    filter.connect(g);
    src.start(time);
    src.stop(time + len + .01);
    register(src);
    nodes.push(src);
    src.addEventListener("ended", () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    });
  }
  if (track === 0) {
    osc("sine", 150, .72, .33, 48);
    osc("triangle", 110, .1, .05, 50);
  }
  if (track === 1) {
    hiss(1500, .38, .16);
    osc("triangle", 180, .15, .1, 90);
  }
  if (track === 2) hiss(7500, .19, step % 4 === 2 ? .09 : .045);
  if (track === 3) {
    const freq = [73.416, 73.416, 55, 65.406][Math.floor(step / 4) % 4];
    osc("triangle", freq, .38, .23);
    osc("sine", freq / 2, .18, .19);
  }
  if (track === 4) {
    const freq = [293.665, 349.228, 440, 349.228][Math.floor(step / 4) % 4];
    const o = osc("sine", freq, .16, .4),
      v = ctx.createOscillator(),
      g = ctx.createGain();
    v.frequency.value = 6;
    g.gain.value = 5;
    v.connect(g);
    g.connect(o.frequency);
    v.start(time);
    v.stop(time + .41);
    register(v);
    v.addEventListener("ended", () => {
      v.disconnect();
      g.disconnect();
    });
    osc("sine", freq * 2, .035, .27);
  }
  if (track === 5) {
    const freq = step < 8 ? 587.33 : 880;
    osc("sine", freq, .13, .28);
    osc("sine", freq * 2.76, .045, .12);
  }
  return nodes;
}
// Reserve mix headroom for all six voices and overlapping release tails.
function master(ctx, volume) {
  const gain = ctx.createGain();
  gain.gain.value = volume / 100 * .35;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -8;
  comp.knee.value = 10;
  comp.ratio.value = 5;
  comp.attack.value = .003;
  comp.release.value = .12;
  gain.connect(comp);
  comp.connect(ctx.destination);
  return gain;
}
export class Band {
  constructor(read, onStep, onStop) {
    this.read = read;
    this.onStep = onStep;
    this.onStop = onStop;
    this.ctx = null;
    this.running = false;
    this.pending = false;
    this.generation = 0;
    this.sources = new Set();
    this.queue = [];
  }
  async ready() {
    if (!this.ctx || this.ctx.state === "closed") {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) {
        throw Error(
          "This browser cannot play Web Audio. You can still edit the beat.",
        );
      }
      this.ctx = new AC();
      this.master = master(this.ctx, this.read().volume);
      this.channels = Array.from({ length: 6 }, () => {
        const g = this.ctx.createGain();
        g.connect(this.master);
        return g;
      });
      this.ctx.addEventListener("statechange", () => {
        if (this.running && this.ctx.state !== "running") {
          this.stop("Audio paused. Press Play to bring the band back.");
        }
      });
    }
    await this.ctx.resume();
    if (this.ctx.state !== "running") {
      throw Error("Audio is unavailable right now. Try Play again.");
    }
    this.mix();
  }
  mix() {
    if (!this.ctx) return;
    const s = this.read(), t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.volume / 100 * .35, t, .015);
    this.channels.forEach((g, i) =>
      g.gain.setTargetAtTime(s.muted[i] ? 0 : 1, t, .01)
    );
  }
  register(node) {
    this.sources.add(node);
    node.addEventListener("ended", () => this.sources.delete(node));
  }
  async start() {
    if (this.running || this.pending) return;
    const generation = ++this.generation;
    this.pending = true;
    try {
      await this.ready();
      if (generation !== this.generation) return;
      this.running = true;
      this.step = 0;
      this.next = this.ctx.currentTime + .05;
      this.tick();
      this.timer = setInterval(() => this.tick(), 25);
      this.frame = requestAnimationFrame(() => this.draw());
    } finally {
      if (generation === this.generation) this.pending = false;
    }
  }
  tick() {
    if (!this.running) return;
    const now = this.ctx.currentTime;
    if (this.next < now - .1) {
      this.next = now + .025;
      this.step = 0;
      this.queue = [];
    }
    while (this.next < now + .085) {
      const s = this.read(), hits = [];
      s.grid.forEach((row, i) => {
        if (row[this.step] && !s.muted[i]) {
          voice(
            this.ctx,
            this.channels[i],
            i,
            this.next,
            this.step,
            (n) => this.register(n),
          );
          hits.push(i);
        }
      });
      this.queue.push({ time: this.next, step: this.step, hits });
      this.next += stepDuration(s.bpm, s.swing, this.step);
      this.step = (this.step + 1) % 16;
    }
  }
  draw() {
    if (!this.running) return;
    while (this.queue.length && this.queue[0].time <= this.ctx.currentTime) {
      const event = this.queue.shift();
      this.onStep(event.step, event.hits);
    }
    this.frame = requestAnimationFrame(() => this.draw());
  }
  stop(message) {
    this.generation++;
    this.pending = false;
    this.running = false;
    clearInterval(this.timer);
    cancelAnimationFrame(this.frame);
    this.queue = [];
    if (this.ctx && this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, .003);
    }
    for (const node of this.sources) {
      try {
        node.stop(this.ctx.currentTime + .015);
      } catch {}
    }
    this.sources.clear();
    this.onStop(message);
  }
  async tap(track) {
    const generation = this.generation;
    await this.ready();
    if (generation !== this.generation) return;
    voice(
      this.ctx,
      this.master,
      track,
      this.ctx.currentTime + .005,
      0,
      (n) => this.register(n),
    );
  }
  close() {
    this.stop();
    this.ctx?.close().catch(() => {});
  }
}
export async function exportLoop(state) {
  const Offline = globalThis.OfflineAudioContext ||
    globalThis.webkitOfflineAudioContext;
  if (!Offline) throw Error("WAV export is unavailable in this browser.");
  const rate = 44100,
    bar = 240 / state.bpm,
    start = Math.round(bar * rate),
    length = Math.round(2 * bar * rate);
  const ctx = new Offline(1, start + length, rate),
    out = master(ctx, state.volume);
  for (let loop = 0; loop < 3; loop++) {
    for (let step = 0; step < 16; step++) {
      state.grid.forEach((row, t) => {
        if (row[step] && !state.muted[t]) {
          voice(
            ctx,
            out,
            t,
            loop * bar + stepTime(state.bpm, state.swing, step),
            step,
          );
        }
      });
    }
  }
  const rendered = await ctx.startRendering();
  return wavPCM(rendered.getChannelData(0).slice(start, start + length), rate);
}
