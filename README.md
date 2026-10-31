# Dead Groovy

A standalone Halloween drum machine for deadgroovy.com: six synthesized voices, a sixteen-step sequencer, presets, swing, undo/redo, browser-local saving, and two-bar WAV downloads.

## Preview

From this directory:

```sh
python3 -m http.server 8002 --bind 127.0.0.1
```

Open http://127.0.0.1:8002/. Serve over HTTP rather than opening index.html directly so JavaScript modules and creation metadata load correctly.

## Hosting

Publish this directory to any static host, with index.html as its entry point. No build command, package installation, backend, or newsiteaday checkout is required. The site also works under a URL subdirectory: all runtime asset paths are relative.

Ship index.html, style.css, app.js, audio.js, characters.js, model.js, edition.js, edition.json, and assets/ (including font licenses). README.md, NOTES.md, and tests/ are documentation and development files; they need not be published.

Fonts, artwork, and synthesized audio are local. The footer links to the original collection as attribution; the app never fetches its archive index. Local saves use the independent `deadgroovy:v1` key. edition.json preserves the original October 31, 2026 creation statistics, not the time spent making this standalone copy. NOTES.md contains the original design and validation notes.

## Checks

```sh
deno test tests/groovy_test.js
deno run --allow-all tests/groovy_browser.mjs http://127.0.0.1:8002/
deno run --allow-all tests/groovy_browser.mjs http://127.0.0.1:8002/ --metadata
```

The browser suite uses Playwright with Brave on macOS by default; set BROWSER_EXECUTABLE to another installed Chromium browser if needed. It checks sequencer interactions, persistence, audio, WAV export, responsive layouts, and error recovery. Screenshots and downloads are saved in a temporary directory.
