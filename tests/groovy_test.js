import {
  audible,
  clone,
  History,
  preset,
  PRESETS,
  remix,
  restore,
  stepDuration,
  stepTime,
  wavPCM,
} from "../model.js";
function assert(value, message) {
  if (!value) throw Error(message);
}
Deno.test("Presets contain six independent playable voices and independent state", () => {
  for (let i = 0; i < PRESETS.length; i++) {
    const a = preset(i), b = preset(i);
    assert(
      a.grid.length === 6 &&
        a.grid.every((r) => r.length === 16 && r.some(Boolean)),
      "complete voices",
    );
    a.grid[0].fill(0);
    assert(b.grid[0].some(Boolean), "shared preset state");
    assert(audible(b), "audible preset");
  }
});
Deno.test("Swing conserves bar length across all tempo and swing extremes", () => {
  for (const bpm of [70, 82, 108, 138, 160]) {
    for (const swing of [0, 18, 36, 50]) {
      let time = 0;
      for (let step = 0; step < 16; step++) {
        assert(
          Math.abs(stepTime(bpm, swing, step) - time) < 1e-10,
          "export/play timing diverges",
        );
        const duration = stepDuration(bpm, swing, step);
        assert(duration > 0, "nonpositive time");
        time += duration;
      }
      assert(Math.abs(time - 240 / bpm) < 1e-10, "swing changes bar length");
    }
  }
});
Deno.test("Stored patterns reject malformed grids and clamp numeric controls", () => {
  for (
    const raw of [null, [], { version: 7 }, {
      version: 1,
      grid: [[1]],
      muted: "bad",
    }, { version: 1, grid: Array(6).fill(Array(16).fill(null)) }]
  ) {
    const s = restore(raw);
    assert(
      s.grid.length === 6 &&
        s.grid.every((r) =>
          r.length === 16 && r.every((x) => x === 0 || x === 1)
        ),
      "bad restored grid",
    );
  }
  const s = restore({ ...preset(), bpm: 999, swing: -100, volume: NaN });
  assert(s.bpm === 160 && s.swing === 0 && s.volume === 65, "limits");
  const source = preset(), restored = restore(source);
  restored.grid[0][0] = 0;
  assert(source.grid[0][0] === 1, "restore aliases source");
});
Deno.test("Whole-pattern undo/redo is isolated, bounded and forks correctly", () => {
  const h = new History();
  let s = preset();
  h.push(s);
  s.grid[0].fill(0);
  s.bpm = 150;
  s.muted[4] = true;
  s = h.undo(s);
  assert(s.bpm === 108 && !s.muted[4] && s.grid[0][0] === 1, "undo incomplete");
  s = h.redo(s);
  assert(
    s.bpm === 150 && s.muted[4] && s.grid[0].every((x) => x === 0),
    "redo incomplete",
  );
  s = h.undo(s);
  h.push(s);
  assert(h.future.length === 0, "redo did not fork");
  for (let n = 0; n < 100; n++) h.push(s);
  assert(h.past.length === 64, "unbounded history");
});
Deno.test("Remixes retain musical anchors, do not mutate input, and recover muted tracks", () => {
  const s = preset();
  s.muted.fill(true);
  const before = JSON.stringify(s);
  let seed = 1234;
  const random =
    () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const seen = new Set();
  for (let i = 0; i < 100; i++) {
    const r = remix(s, random);
    assert(
      r.grid[0][0] && r.grid[1][4] && r.grid[1][12],
      "missing groove anchors",
    );
    assert(!r.muted.some(Boolean), "remix leaves muted tracks");
    assert(r.bpm === s.bpm && r.swing === s.swing, "remix changes tempo");
    seen.add(JSON.stringify(r.grid));
  }
  assert(seen.size > 90, "insufficient variation");
  assert(JSON.stringify(s) === before, "mutated source");
});
Deno.test("Silent patterns and muted output are correctly identified", () => {
  const s = preset();
  assert(audible(s), "default silent");
  s.volume = 0;
  assert(!audible(s), "zero volume audible");
  s.volume = 65;
  s.muted.fill(true);
  assert(!audible(s), "muted audible");
  s.muted.fill(false);
  s.grid.forEach((r) => r.fill(0));
  assert(!audible(s), "empty audible");
});
Deno.test("WAV encoding has a correct mono PCM header, finite clipping and signed samples", () => {
  const v = new DataView(
    wavPCM(new Float32Array([-2, -1, -.5, 0, .5, 1, 2, NaN])),
  );
  const tag = (i) =>
    String.fromCharCode(
      ...Array.from({ length: 4 }, (_, n) => v.getUint8(i + n)),
    );
  assert(
    tag(0) === "RIFF" && tag(8) === "WAVE" && tag(36) === "data",
    "headers",
  );
  assert(
    v.getUint32(4, true) === 52 && v.getUint32(40, true) === 16,
    "lengths",
  );
  assert(
    v.getUint16(22, true) === 1 && v.getUint32(24, true) === 44100,
    "format",
  );
  assert(
    v.getInt16(44, true) === -32768 && v.getInt16(56, true) === 32767 &&
      v.getInt16(58, true) === 0,
    "clipping and invalid samples",
  );
});
