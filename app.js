import {
  audible,
  clone,
  History,
  preset,
  PRESETS,
  remix,
  restore,
  TRACKS,
} from "./model.js";
import { Band, exportLoop } from "./audio.js";
import { character } from "./characters.js";
const $ = (s) => document.querySelector(s),
  key = "deadgroovy:v1";
let state = preset(),
  storage = true,
  paint = null,
  rangeEdit = null,
  focused = [0, 0],
  exporting = false;
const history = new History(), hitTimers = [];
try {
  const raw = localStorage.getItem(key);
  if (raw) state = restore(JSON.parse(raw));
} catch {
  storage = false;
}
function announce(text) {
  $("#notice").textContent = text;
}
function save() {
  try {
    localStorage.setItem(key, JSON.stringify(state));
    storage = true;
  } catch {
    storage = false;
  }
  $("#save-state").textContent = storage
    ? "SAVED ON THIS DEVICE"
    : "STORAGE UNAVAILABLE · THIS VISIT ONLY";
}
function pulse(track) {
  const b = document.querySelector(`[data-band="${track}"]`);
  b.classList.remove("hit");
  void b.offsetWidth;
  b.classList.add("hit");
  clearTimeout(hitTimers[track]);
  hitTimers[track] = setTimeout(() => b.classList.remove("hit"), 240);
}
function playhead(step, hits) {
  document.querySelectorAll(".mobile-pages button").forEach((b) =>
    b.classList.toggle(
      "is-playing",
      Number(b.dataset.page) === (step >= 8 ? 1 : 0),
    )
  );
  document.querySelectorAll(".playhead,.step-number.active").forEach((e) =>
    e.classList.remove("playhead", "active")
  );
  document.querySelectorAll(`.step[data-step="${step}"]`).forEach((e) =>
    e.classList.add("playhead")
  );
  document.querySelector(`.step-number[data-step="${step}"]`)?.classList.add(
    "active",
  );
  $("#position").innerHTML = `${
    String(step + 1).padStart(2, "0")
  }<span>/16</span>`;
  hits.forEach(pulse);
}
function stopped(message) {
  document.querySelectorAll(".mobile-pages button").forEach((b) =>
    b.classList.remove("is-playing")
  );
  document.body.classList.remove("playing");
  $("#play").setAttribute("aria-pressed", "false");
  $("#play-label").textContent = "Let’s boo-gie";
  $("#play-icon").textContent = "▶";
  $("#transport-status").textContent = "READY TO RATTLE";
  document.querySelectorAll(".playhead,.step-number.active").forEach((e) =>
    e.classList.remove("playhead", "active")
  );
  $("#position").innerHTML = "01<span>/16</span>";
  if (message) announce(message);
}
const band = new Band(() => state, playhead, stopped);
$("#band").innerHTML = TRACKS.map((t, i) =>
  `<button class="bandmate" data-band="${i}" aria-label="Audition ${t.name}, ${t.sound}. Shortcut ${
    i + 1
  }.">${character(i)}<span class="caption"><span>${
    i + 1
  }</span>${t.name}</span><span class="sound-label">${t.sound.toUpperCase()}</span></button>`
).join("");
$("#step-numbers").innerHTML = Array.from(
  { length: 16 },
  (_, i) =>
    `<span aria-hidden="true" class="step-number ${
      i < 8 ? "first-half" : "second-half"
    }" data-step="${i}">${String(i + 1).padStart(2, "0")}</span>`,
).join("");
const speaker =
  '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7H7L12 3V17L7 13H3Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M15 6Q19 10 15 14" fill="none" stroke="currentColor" stroke-width="1.5"/><path class="mute-slash" d="M2 2L18 18" stroke="currentColor" stroke-width="2"/></svg>';
$("#tracks").innerHTML = TRACKS.map((t, i) =>
  `<div class="track" data-track="${i}" style="--track:${t.color}"><div class="track-label"><span class="track-dot"></span><span><strong>${t.name}</strong><small>${t.sound.toUpperCase()}</small></span></div><div class="steps">${
    Array.from({ length: 16 }, (_, j) =>
      `<button class="step ${
        j < 8 ? "first-half" : "second-half"
      }" data-track="${i}" data-step="${j}" aria-pressed="false" tabindex="${
        i === 0 && j === 0 ? 0 : -1
      }"></button>`).join("")
  }</div><button class="mute" data-mute="${i}" aria-pressed="false" aria-label="Mute ${t.name}, ${t.sound}">${speaker}</button></div>`
).join("");
function render() {
  TRACKS.forEach((t, i) => {
    const row = document.querySelector(`.track[data-track="${i}"]`);
    row.classList.toggle("muted", state.muted[i]);
    row.querySelector(".mute").setAttribute(
      "aria-pressed",
      String(state.muted[i]),
    );
    document.querySelector(`[data-band="${i}"]`).classList.toggle(
      "is-muted",
      state.muted[i],
    );
    row.querySelectorAll(".step").forEach((b, j) => {
      b.setAttribute("aria-pressed", String(!!state.grid[i][j]));
      b.setAttribute(
        "aria-label",
        `${t.name}, ${t.sound}, step ${j + 1}${
          j % 4 === 0 ? ", downbeat" : ""
        }`,
      );
    });
  });
  for (const key of ["tempo", "swing", "volume"]) {
    const value = state[key === "tempo" ? "bpm" : key];
    $("#" + key).value = value;
    $("#" + key + "-value").value = value;
    $("#" + key).setAttribute(
      "aria-valuetext",
      `${value}${key === "tempo" ? " beats per minute" : " percent"}`,
    );
  }
  const p = PRESETS.findIndex((p) => p.name === state.name);
  $("#preset").value = p < 0 ? "custom" : String(p);
  $('#preset option[value="custom"]').textContent = p < 0
    ? state.name
    : "Your creation";
  $("#pattern-name").textContent = state.name.toUpperCase();
  $("#undo").disabled = !history.past.length;
  $("#redo").disabled = !history.future.length;
  $("#download").disabled = exporting || !audible(state);
  $("#download").title = audible(state)
    ? "Download a two-bar mono WAV loop"
    : "Add an unmuted sound and turn volume above zero to export";
  band.mix();
}
function changed(message) {
  render();
  save();
  if (message) announce(message);
}
async function audition(i) {
  try {
    await band.tap(i);
    if (!document.hidden) pulse(i);
  } catch (error) {
    announce(error.message);
  }
}
document.querySelectorAll("[data-band]").forEach((b) =>
  b.onclick = () => audition(Number(b.dataset.band))
);
$("#play").onclick = async () => {
  if (band.running || band.pending) {
    band.stop("Taking five. Your beat is right where you left it.");
    return;
  }
  $("#play-label").textContent = "Waking up…";
  $("#play-icon").textContent = "■";
  $("#play").setAttribute("aria-pressed", "true");
  try {
    await band.start();
    if (!band.running) return;
    document.body.classList.add("playing");
    $("#play-label").textContent = "Take five";
    $("#play-icon").textContent = "■";
    $("#transport-status").textContent = "ON THE HAUNT";
    announce(
      audible(state)
        ? "The band is alive. Edit the squares while the loop plays."
        : "The band is ready, but your mix is silent. Add notes, unmute a row, or raise the volume.",
    );
  } catch (error) {
    band.stop();
    announce(error.message);
  }
};
function page(index) {
  $("#sequencer").dataset.page = index;
  document.querySelectorAll(
    ".mobile-pages button",
  ).forEach((b) =>
    b.setAttribute("aria-pressed", String(Number(b.dataset.page) === index))
  );
  if ((focused[1] >= 8 ? 1 : 0) !== index) {
    focusStep(focused[0], index * 8, false);
  }
}
document.querySelectorAll(".mobile-pages button").forEach((b) =>
  b.onclick = () => page(Number(b.dataset.page))
);
function focusStep(track, step, move = true) {
  document.querySelector('.step[tabindex="0"]')?.setAttribute("tabindex", "-1");
  focused = [track, step];
  const button = document.querySelector(
    `.step[data-track="${track}"][data-step="${step}"]`,
  );
  button.tabIndex = 0;
  if (move) {
    page(step >= 8 ? 1 : 0);
    button.focus({ preventScroll: true });
  }
}
function toggle(track, step) {
  history.push(state);
  state.grid[track][step] = 1 - state.grid[track][step];
  state.name = "Your creation";
  changed(
    `${TRACKS[track].name}, step ${step + 1}: ${
      state.grid[track][step] ? "on" : "off"
    }.`,
  );
}
$("#tracks").addEventListener("click", (e) => {
  const b = e.target.closest(".step");
  if (b && e.detail === 0) {
    toggle(Number(b.dataset.track), Number(b.dataset.step));
  }
});
$("#tracks").addEventListener("keydown", (e) => {
  const b = e.target.closest(".step");
  if (!b) return;
  let r = Number(b.dataset.track), c = Number(b.dataset.step);
  if (e.key === "ArrowRight") c = Math.min(15, c + 1);
  else if (e.key === "ArrowLeft") c = Math.max(0, c - 1);
  else if (e.key === "ArrowDown") r = Math.min(5, r + 1);
  else if (e.key === "ArrowUp") r = Math.max(0, r - 1);
  else if (e.key === "Home") c = 0;
  else if (e.key === "End") c = 15;
  else return;
  e.preventDefault();
  focusStep(r, c);
});
function paintCell(button) {
  if (!button || !paint) return;
  const r = Number(button.dataset.track),
    c = Number(button.dataset.step),
    id = r * 16 + c;
  if (paint.seen.has(id)) return;
  paint.seen.add(id);
  state.grid[r][c] = paint.value;
  state.name = "Your creation";
  render();
}
$("#tracks").addEventListener("pointerdown", (e) => {
  const b = e.target.closest(".step");
  if (!b || e.button !== 0 || paint) return;
  e.preventDefault();
  history.push(state);
  focusStep(Number(b.dataset.track), Number(b.dataset.step));
  paint = {
    pointer: e.pointerId,
    value: 1 - state.grid[Number(b.dataset.track)][Number(b.dataset.step)],
    seen: new Set(),
  };
  $("#tracks").setPointerCapture(e.pointerId);
  paintCell(b);
});
$("#tracks").addEventListener("pointermove", (e) => {
  if (!paint || paint.pointer !== e.pointerId) return;
  const b = document.elementFromPoint(e.clientX, e.clientY)?.closest(".step");
  if (b && $("#tracks").contains(b)) paintCell(b);
});
function finishPaint(e) {
  if (!paint || e.pointerId !== paint.pointer) return;
  paint = null;
  save();
  announce("Pattern updated. One Undo restores the whole stroke.");
}
for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) {
  $("#tracks").addEventListener(event, finishPaint);
}
document.querySelectorAll("[data-mute]").forEach((b) =>
  b.onclick = () => {
    const i = Number(b.dataset.mute);
    history.push(state);
    state.muted[i] = !state.muted[i];
    changed(
      `${TRACKS[i].name} ${
        state.muted[i] ? "is taking a break" : "is back in the band"
      }.`,
    );
  }
);
for (const id of ["tempo", "swing", "volume"]) {
  const input = $("#" + id);
  input.addEventListener("input", () => {
    if (rangeEdit !== id) {
      history.push(state);
      rangeEdit = id;
    }
    state[id === "tempo" ? "bpm" : id] = Number(input.value);
    render();
    save();
  });
  input.addEventListener("change", () => {
    rangeEdit = null;
  });
  input.addEventListener("blur", () => {
    rangeEdit = null;
  });
}
$("#preset").onchange = () => {
  const i = Number($("#preset").value);
  if (!Number.isInteger(i) || i < 0 || i >= PRESETS.length) return;
  history.push(state);
  const volume = state.volume;
  state = preset(i);
  state.volume = volume;
  changed(`${state.name}. A fresh start; Undo brings your previous beat back.`);
};
$("#remix").onclick = () => {
  history.push(state);
  state = remix(state);
  changed(
    "A happy little accident. Keep what you like; Undo brings the old beat back.",
  );
};
$("#clear").onclick = () => {
  history.push(state);
  state.grid = state.grid.map(() => Array(16).fill(0));
  state.name = "A clean slate";
  changed("An empty stage. Tap some squares, or Undo to bring the band back.");
};
$("#undo").onclick = () => {
  state = history.undo(state);
  changed("Undid the last edit.");
};
$("#redo").onclick = () => {
  state = history.redo(state);
  changed("Redid the last edit.");
};
$("#download").onclick = async () => {
  if (exporting || !audible(state)) return;
  const snapshot = clone(state);
  exporting = true;
  render();
  $("#download").textContent = "Bottling your beat…";
  announce("Making your two-bar WAV loop…");
  try {
    const bytes = await exportLoop(snapshot),
      url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" })),
      a = document.createElement("a");
    a.href = url;
    a.download = `dead-groovy-${snapshot.bpm}bpm.wav`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    announce("Your monster is ready: a two-bar WAV loop. Keep making noise.");
  } catch (error) {
    announce(
      `Could not save this loop. ${error.message} Your pattern is safe; try again.`,
    );
  } finally {
    exporting = false;
    $("#download").innerHTML = "Save my loop <span>↓</span>";
    render();
  }
};
$("#help").onclick = () => $("#help-dialog").showModal();
$("#help-close").onclick = () => $("#help-dialog").close();
document.addEventListener("keydown", (e) => {
  if (
    e.repeat || e.ctrlKey || e.metaKey || e.altKey || $("#help-dialog").open ||
    e.target.closest('input,select,textarea,[contenteditable="true"]')
  ) return;
  if (/^[1-6]$/.test(e.key)) {
    e.preventDefault();
    audition(Number(e.key) - 1);
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    band.stop(
      "The band paused while you were away. Press Play when you’re back.",
    );
  }
});
window.addEventListener("pagehide", () => band.close());
render();
save();
