export const TRACKS = [
  { name: "Thump", sound: "Kick", color: "#edfc78", key: "1" },
  { name: "Bones", sound: "Snare", color: "#f2c3e3", key: "2" },
  { name: "Batty", sound: "Hi-hat", color: "#bda5f3", key: "3" },
  { name: "Goo", sound: "Bass", color: "#b7df88", key: "4" },
  { name: "Boo", sound: "Voice", color: "#f9eed7", key: "5" },
  { name: "Orbit", sound: "Bell", color: "#90cdd8", key: "6" },
];
export const PRESETS = [
  {
    name: "Graveyard groove",
    bpm: 108,
    swing: 18,
    steps: [
      [0, 6, 8, 11],
      [4, 12],
      [0, 2, 4, 6, 8, 10, 12, 14],
      [0, 3, 8, 10],
      [2, 7, 14],
      [6, 15],
    ],
  },
  {
    name: "Disco, deceased",
    bpm: 124,
    swing: 0,
    steps: [[0, 4, 8, 12], [4, 12], [2, 6, 10, 14], [0, 2, 6, 8, 10, 14], [
      3,
      11,
    ], [7, 15]],
  },
  {
    name: "Creepin’ it slow",
    bpm: 82,
    swing: 36,
    steps: [[0, 7, 10], [4, 12, 15], [0, 2, 5, 6, 8, 10, 13, 14], [0, 6, 10], [
      3,
      9,
    ], [14]],
  },
  {
    name: "Skeleton shuffle",
    bpm: 138,
    swing: 28,
    steps: [
      [0, 6, 8, 14],
      [4, 10, 12],
      [0, 2, 3, 6, 8, 9, 10, 14],
      [0, 4, 7, 8, 12],
      [2, 10, 15],
      [5, 13],
    ],
  },
];
export function preset(index = 0) {
  const p = PRESETS[index] || PRESETS[0];
  return {
    version: 1,
    name: p.name,
    bpm: p.bpm,
    swing: p.swing,
    volume: 65,
    muted: Array(6).fill(false),
    grid: p.steps.map((row) =>
      Array.from({ length: 16 }, (_, i) => Number(row.includes(i)))
    ),
  };
}
export function clone(s) {
  return JSON.parse(JSON.stringify(s));
}
export function restore(raw) {
  const fallback = preset();
  if (!raw || raw.version !== 1) return fallback;
  return {
    ...fallback,
    name: typeof raw.name === "string" && raw.name.length < 50
      ? raw.name
      : "Your creation",
    bpm: Number.isFinite(raw.bpm)
      ? Math.round(Math.min(160, Math.max(70, raw.bpm)))
      : fallback.bpm,
    swing: Number.isFinite(raw.swing)
      ? Math.round(Math.min(50, Math.max(0, raw.swing)))
      : fallback.swing,
    volume: Number.isFinite(raw.volume)
      ? Math.round(Math.min(100, Math.max(0, raw.volume)))
      : fallback.volume,
    muted: Array.isArray(raw.muted) && raw.muted.length === 6 &&
        raw.muted.every((v) => typeof v === "boolean")
      ? raw.muted.slice()
      : fallback.muted,
    grid: Array.isArray(raw.grid) && raw.grid.length === 6 &&
        raw.grid.every((row) =>
          Array.isArray(row) && row.length === 16 &&
          row.every((v) => v === 0 || v === 1)
        )
      ? raw.grid.map((r) => r.slice())
      : fallback.grid,
  };
}
export const stepDuration = (bpm, swing, step) =>
  60 / bpm / 4 * (1 + (step % 2 ? -1 : 1) * swing / 100);
export const stepTime = (bpm, swing, step) =>
  Math.floor(step / 2) * 2 * 60 / bpm / 4 +
  (step % 2 ? stepDuration(bpm, swing, 0) : 0);
export const audible = (s) =>
  s.volume > 0 && s.grid.some((row, i) => !s.muted[i] && row.some(Boolean));
export function remix(s, random = Math.random) {
  const out = clone(s);
  out.name = "A happy haunting";
  out.grid = PRESETS[Math.floor(random() * PRESETS.length) % PRESETS.length]
    .steps.map((row, t) =>
      Array.from({ length: 16 }, (_, i) => {
        if (t === 0 && i === 0 || t === 1 && (i === 4 || i === 12)) return 1;
        return Number(random() < (row.includes(i) ? .78 : t === 2 ? .15 : .07));
      })
    );
  out.muted.fill(false);
  return out;
}
export class History {
  constructor() {
    this.past = [];
    this.future = [];
  }
  push(s) {
    this.past.push(clone(s));
    if (this.past.length > 64) this.past.shift();
    this.future = [];
  }
  undo(s) {
    if (!this.past.length) return s;
    this.future.push(clone(s));
    return this.past.pop();
  }
  redo(s) {
    if (!this.future.length) return s;
    this.past.push(clone(s));
    return this.future.pop();
  }
}
export function wavPCM(samples, sampleRate = 44100) {
  const buffer = new ArrayBuffer(44 + samples.length * 2),
    v = new DataView(buffer);
  const str = (at, s) =>
    [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Number.isFinite(samples[i])
      ? Math.max(-1, Math.min(1, samples[i]))
      : 0;
    v.setInt16(44 + i * 2, Math.round(x * (x < 0 ? 32768 : 32767)), true);
  }
  return buffer;
}
