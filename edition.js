(() => {
  "use strict";
  const formatDuration = (seconds) => {
    if (seconds == null) return "Build time: pending";
    const minutes = Math.floor(seconds / 60);
    return `Built in ${minutes ? `${minutes}m ` : ""}${
      Math.round(seconds % 60)
    }s`;
  };
  fetch("edition.json").then((response) => {
    if (!response.ok) throw new Error("Edition metadata unavailable");
    return response.json();
  }).then((edition) => {
    document.querySelector("#build-time").textContent = formatDuration(
      edition.duration_seconds,
    );
    const tokens = document.querySelector("#token-count");
    tokens.textContent = edition.tokens == null
      ? "Tokens: unavailable"
      : `${edition.tokens.total.toLocaleString("en-US")} tokens`;
    tokens.title = edition.tokens == null
      ? "No recorded usage is available."
      : `Recorded input + output through ${edition.usage_recorded_at}. Includes cached input. Build time excludes planning and handoff.`;
  }).catch(() => {
    document.querySelector("#build-time").textContent =
      "Build time: unavailable";
    document.querySelector("#token-count").textContent = "Tokens: unavailable";
  });
})();
