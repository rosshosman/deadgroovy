import { chromium } from "npm:playwright@1.51.1";
import assert from "node:assert/strict";
const base = Deno.args[0] || "http://127.0.0.1:8000";
const artifacts = await Deno.makeTempDir({ prefix: "groovy-browser-" });
const browser = await chromium.launch({
  executablePath: Deno.env.get("BROWSER_EXECUTABLE") ||
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  headless: true,
});
const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: "reduce",
  }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (v, m) => {
  assert.ok(v, m);
  console.log("PASS", m);
};
await page.addInitScript(() => {
  window.audioContexts = [];
  const AC = window.AudioContext;
  window.AudioContext = class extends AC {
    constructor(...args) {
      super(...args);
      window.audioContexts.push(this);
      this.comps = [];
    }
    createDynamicsCompressor() {
      const c = super.createDynamicsCompressor();
      this.comps.push(c);
      return c;
    }
  };
});
await page.goto(base);
if (Deno.args.includes("--edges")) {
  console.log(await edgeMetrics(page));
  await browser.close();
  Deno.exit(0);
}
await page.evaluate(() => document.fonts.ready);
if (Deno.args.includes("--metadata")) {
  const meta = await (await page.request.get(
    new URL("edition.json", base.endsWith("/") ? base : base + "/").href,
  )).json();
  const mins = Math.floor(meta.duration_seconds / 60),
    expected = `Built in ${mins ? `${mins}m ` : ""}${
      Math.round(meta.duration_seconds % 60)
    }s`;
  await page.waitForFunction(() =>
    !document.querySelector("#build-time").textContent.includes("pending")
  );
  check(
    await page.locator("#build-time").textContent() === expected,
    "displayed duration matches final measurement",
  );
  check(
    await page.locator("#token-count").textContent() ===
      `${meta.tokens.total.toLocaleString("en-US")} tokens`,
    "displayed tokens match final measurement",
  );
  await page.screenshot({ path: `${artifacts}/final-desktop.png` });
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.screenshot({ path: `${artifacts}/final-footer.png` });
  console.log("Final artifacts:", artifacts);
  await browser.close();
  Deno.exit(0);
}

await page.screenshot({ path: `${artifacts}/desktop.png` });
await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
await page.screenshot({ path: `${artifacts}/desktop-bottom.png` });
await page.evaluate(() => scrollTo(0, 0));
check(await page.locator(".step").count() === 96, "six complete 16-step rows");
check(
  await page.evaluate(() => audioContexts.length) === 0,
  "no audio context or autoplay on load",
);
for (const width of [1440, 1024, 768, 700, 600, 390, 320]) {
  await page.setViewportSize({ width, height: 900 });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - innerWidth
  );
  check(overflow === 0, `${width}px no horizontal overflow (${overflow})`);
}
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => scrollTo(0, 0));
await page.screenshot({ path: `${artifacts}/mobile.png` });
await page.locator(".machine").scrollIntoViewIfNeeded();
await page.screenshot({ path: `${artifacts}/mobile-machine.png` });
await page.setViewportSize({ width: 1440, height: 1100 });
const step = (r, c) =>
  page.locator(`.step[data-track="${r}"][data-step="${c}"]`);
const grid = () =>
  page.locator(".step").evaluateAll((es) =>
    es.map((e) => e.getAttribute("aria-pressed")).join(",")
  );
const original = await grid();
await step(0, 1).focus();
await page.keyboard.press("Space");
check(
  await step(0, 1).getAttribute("aria-pressed") === "true",
  "Space toggles a step",
);
await page.keyboard.press("ArrowDown");
check(
  await step(1, 1).evaluate((e) => e === document.activeElement),
  "arrow key moves across voices",
);
await page.locator("#undo").click();
check(await grid() === original, "Undo restores the exact pattern");
await page.locator("#redo").click();
check(
  await step(0, 1).getAttribute("aria-pressed") === "true",
  "Redo restores edit",
);
await page.locator("#undo").click();
const a = await step(0, 1).boundingBox(), b = await step(0, 4).boundingBox();
await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
await page.mouse.down();
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 24 });
await page.mouse.up();
check(
  await step(0, 2).getAttribute("aria-pressed") === "true" &&
    await step(0, 4).getAttribute("aria-pressed") === "true",
  "drag paints across notes",
);
await page.locator("#undo").click();
check(await grid() === original, "one Undo restores entire drag");
await page.locator('[data-mute="0"]').click();
check(
  await page.locator('.track[data-track="0"]').evaluate((e) =>
    e.classList.contains("muted")
  ),
  "mute state is visible",
);
await page.locator("#undo").click();
await page.locator("#preset").selectOption("1");
check(
  await page.locator("#tempo").inputValue() === "124",
  "preset changes tempo",
);
check(
  await page.locator("#swing").inputValue() === "0",
  "preset changes swing",
);
await page.locator("#undo").click();
check(
  await grid() === original &&
    await page.locator("#tempo").inputValue() === "108",
  "undo restores preset and tempo",
);
await page.locator("#remix").click();
check(await grid() !== original, "Surprise me changes pattern");
await page.locator("#undo").click();
check(await grid() === original, "remix is reversible");
await page.locator("#clear").click();
check(
  await page.locator('.step[aria-pressed="true"]').count() === 0,
  "Clear empties pattern",
);
check(
  await page.locator("#download").isDisabled(),
  "silent export is disabled",
);
await page.locator("#undo").click();
await page.locator("#tempo").focus();
await page.keyboard.press("ArrowRight");
check(
  await page.locator("#tempo").inputValue() === "109",
  "tempo keyboard input works",
);
await page.reload();
check(
  await page.locator("#tempo").inputValue() === "109",
  "tempo restored after reload",
);
await page.locator("#preset").selectOption("0");
await page.locator("#help").click();
check(await page.locator("dialog").isVisible(), "instructions open");
await page.keyboard.press("Escape");
check(
  await page.locator("#help").evaluate((e) => e === document.activeElement),
  "Escape closes dialog and restores focus",
);
await page.locator('[data-band="4"]').click();
await page.waitForFunction(() =>
  audioContexts.length === 1 && audioContexts[0].state === "running"
);
check(
  await page.locator('[data-band="4"]').evaluate((e) =>
    getComputedStyle(e.querySelector(".puppet")).animationName
  ) === "none",
  "reduced motion keeps puppets still",
);
await page.locator("#play").click();
await page.waitForFunction(() => document.body.classList.contains("playing"));
await page.waitForFunction(() =>
  document.querySelector("#position").textContent !== "01/16"
);
check(
  await page.locator(".step.playhead").count() === 6,
  "live playhead advances all rows",
);
await page.evaluate(() => {
  const ctx = audioContexts[0], an = ctx.createAnalyser();
  an.fftSize = 2048;
  ctx.comps[0].connect(an);
  window.testAnalyser = an;
});
await page.waitForFunction(() => {
  const d = new Float32Array(testAnalyser.fftSize);
  testAnalyser.getFloatTimeDomainData(d);
  return d.some((v) => Math.abs(v) > .005);
});
check(true, "live Web Audio produces nonzero samples");
await page.locator("#play").click();
await page.waitForFunction(() => {
  const d = new Float32Array(testAnalyser.fftSize);
  testAnalyser.getFloatTimeDomainData(d);
  return d.every((v) => Math.abs(v) < .00001);
});
check(
  await page.locator(".step.playhead").count() === 0,
  "Stop clears playhead and silences scheduled audio",
);
const dlPromise = page.waitForEvent("download");
await page.locator("#download").click();
const dl = await dlPromise;
await dl.saveAs(`${artifacts}/dead-groovy.wav`);
const bytes = await Deno.readFile(`${artifacts}/dead-groovy.wav`),
  dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
check(
  dl.suggestedFilename() === "dead-groovy-108bpm.wav",
  "WAV downloads with tempo filename",
);
check(
  dv.getUint32(24, true) === 44100 && dv.getUint16(22, true) === 1,
  "export is 44.1kHz mono PCM",
);
check(
  Math.abs((bytes.length - 44) / 2 / 44100 - 480 / 108) < 1 / 44100,
  "export is exactly two bars",
);
let peak = 0, energy = 0;
for (let i = 44; i < bytes.length; i += 2) {
  const sample = dv.getInt16(i, true) / 32768;
  peak = Math.max(peak, Math.abs(sample));
  energy += sample * sample;
}
check(
  peak > .05 && peak < .99 && energy > 1,
  "rendered audio is nonzero and unclipped",
);
check(
  Math.abs(dv.getInt16(44, true) - dv.getInt16(bytes.length - 2, true)) /
      32768 < .03,
  "loop boundary has no large discontinuity",
);
const soundChecks = await page.evaluate(async () => {
  const { exportLoop } = await import("./audio.js"),
    { preset } = await import("./model.js");
  const out = [];
  for (let t = 0; t < 6; t++) {
    const s = preset();
    s.grid = s.grid.map((_, i) =>
      Array.from({ length: 16 }, (_, j) => Number(i === t && j === 0))
    );
    const b = await exportLoop(s), v = new DataView(b);
    let e = 0, p = 0;
    for (let i = 44; i < b.byteLength; i += 2) {
      const x = v.getInt16(i, true) / 32768;
      e += x * x;
      p = Math.max(p, Math.abs(x));
    }
    out.push({ energy: e, peak: p });
  }
  return out;
});
check(
  soundChecks.every((s) => s.energy > .1 && s.peak > .005 && s.peak < 1),
  "all six synthesized voices render real audio",
);
await page.locator("#play").click();
await page.waitForFunction(() => document.body.classList.contains("playing"));
await page.evaluate(() => {
  Object.defineProperty(document, "hidden", {
    get: () => true,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
});
check(
  await page.locator("#play").getAttribute("aria-pressed") === "false",
  "hidden tab stops playback",
);
await page.evaluate(() => {
  delete document.hidden;
});
const touch = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
await touch.goto(base);
await touch.locator('.step[data-track="0"][data-step="1"]').tap();
check(
  await touch.locator('.step[data-track="0"][data-step="1"]').getAttribute(
    "aria-pressed",
  ) === "true",
  "touch toggles a note",
);
await touch.locator('.mobile-pages button[data-page="1"]').tap();
check(
  await touch.locator('.step[data-track="0"][data-step="8"]').isVisible(),
  "mobile opens second half",
);
await touch.locator('.step[data-track="0"][data-step="15"]').tap();
check(
  await touch.locator('.step[data-track="0"][data-step="15"]').getAttribute(
    "aria-pressed",
  ) === "true",
  "touch edits step sixteen",
);
await touch.locator("#undo").tap();
check(
  await touch.locator('.step[data-track="0"][data-step="15"]').getAttribute(
    "aria-pressed",
  ) === "false",
  "touch Undo restores note",
);
await touch.locator('.step[data-track="0"][data-step="8"]').focus();
await touch.keyboard.press("ArrowLeft");
check(
  await touch.locator('.step[data-track="0"][data-step="7"]').isVisible(),
  "keyboard crossing halves reveals target",
);
const blocked = await browser.newPage();
await blocked.addInitScript(() => {
  Object.defineProperty(window, "localStorage", {
    get() {
      throw Error("blocked");
    },
  });
});
await blocked.goto(base);
await blocked.locator("#clear").click();
check(
  (await blocked.locator("#save-state").textContent()).includes("THIS VISIT"),
  "blocked storage remains playable",
);
const malformed = await browser.newPage();
await malformed.addInitScript(() =>
  localStorage.setItem(
    "deadgroovy:v1",
    JSON.stringify({ version: 1, grid: [[null]], bpm: 999, muted: [1] }),
  )
);
await malformed.goto(base);
check(
  await malformed.locator(".step").count() === 96 &&
    await malformed.locator("#tempo").inputValue() === "160",
  "malformed saved data is safely restored",
);
const unsupported = await browser.newPage();
await unsupported.addInitScript(() => {
  window.AudioContext = undefined;
  window.webkitAudioContext = undefined;
  window.OfflineAudioContext = undefined;
  window.webkitOfflineAudioContext = undefined;
});
await unsupported.goto(base);
await unsupported.locator("#play").click();
check(
  (await unsupported.locator("#notice").textContent()).includes("cannot play"),
  "unsupported audio shows recovery message",
);
await unsupported.locator("#download").click();
check(
  (await unsupported.locator("#notice").textContent()).includes(
    "Could not save",
  ),
  "export failure reports an error",
);
check(
  await unsupported.locator("#download").isEnabled(),
  "export button recovers after failure",
);
const race = await browser.newPage();
await race.addInitScript(() => {
  const AC = window.AudioContext;
  window.AudioContext = class extends AC {
    async resume() {
      await super.resume();
      return new Promise((resolve) => {
        window.releaseResume = resolve;
      });
    }
  };
});
await race.goto(base);
await race.locator("#play").click();
await race.waitForFunction(() => typeof releaseResume === "function");
await race.locator("#play").click();
await race.evaluate(() => releaseResume());
await race.waitForFunction(() =>
  document.querySelector("#play").getAttribute("aria-pressed") === "false"
);
check(
  !(await race.locator("body").evaluate((e) =>
    e.classList.contains("playing")
  )),
  "stop during pending audio start prevents late playback",
);
await race.locator("#play").click();
await race.waitForFunction(() =>
  document.querySelector("#play-label").textContent === "Waking up…"
);
await race.evaluate(() => {
  Object.defineProperty(document, "hidden", {
    get: () => true,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
  releaseResume();
});
check(
  await race.locator("#play").getAttribute("aria-pressed") === "false",
  "tab hide during audio startup cancels playback",
);
const edgeAudio = await edgeMetrics(page);
console.log("Edge audio metrics:", edgeAudio);
check(
  edgeAudio.results.every((r) =>
    r.peak < .99 && r.peak > .05 &&
    Math.abs(r.seconds - 480 / r.bpm) < 1 / 44100 && r.jump < .05
  ),
  "dense patterns export unclipped exact loops at tempo/swing extremes",
);
check(edgeAudio.nonzero === 0, "export respects all track mutes");
check(await page.locator("#archive-form").count() === 0, "no collection navigation dependency");
check(await page.locator(".collection").getAttribute("href") === "https://newsiteaday.com/", "original collection attribution uses an external link");
check(errors.length === 0, "no uncaught browser errors");
console.log("Audio metrics:", { peak, energy, soundChecks });
console.log("Browser artifacts:", artifacts);
await browser.close();

async function edgeMetrics(page) {
  return await page.evaluate(async () => {
    const { exportLoop } = await import("./audio.js"),
      { preset } = await import("./model.js");
    const results = [];
    for (const bpm of [70, 160]) {
      const s = preset();
      s.bpm = bpm;
      s.swing = 50;
      s.volume = 100;
      s.grid = s.grid.map((r) => r.map(() => 1));
      const b = await exportLoop(s), v = new DataView(b);
      let peak = 0;
      for (let i = 44; i < b.byteLength; i += 2) {
        peak = Math.max(peak, Math.abs(v.getInt16(i, true) / 32768));
      }
      results.push({
        bpm,
        peak,
        seconds: (b.byteLength - 44) / 88200,
        jump:
          Math.abs(v.getInt16(44, true) - v.getInt16(b.byteLength - 2, true)) /
          32768,
      });
    }
    const s = preset();
    s.muted.fill(true);
    const b = await exportLoop(s), v = new DataView(b);
    let nonzero = 0;
    for (let i = 44; i < b.byteLength; i += 2) {
      if (v.getInt16(i, true) !== 0) nonzero++;
    }
    return { results, nonzero };
  });
}
