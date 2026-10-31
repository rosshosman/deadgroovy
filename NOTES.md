# Dead Groovy · October 31, 2026

A Halloween rhythm playground: six original cartoon bandmates, six synthesized voices, and a sixteen-step loop. Tap the band to audition sounds, paint a rhythm, play it live, and export a two-bar WAV. Four original starting patterns, swing, tempo, mutes, undo/redo, random variations, and local persistence make this a complete small instrument.

## Visual and musical references

- [Roland’s TR-808 story](https://www.roland.com/global/promos/roland_tr-808/): the approachable sixteen-button sequencing model and synthesis-based percussion are conceptual references. This instrument uses its own six voices and original patterns; it does not emulate an 808 or reproduce its panel.
- [Library of Congress, animation model sheets](https://www.loc.gov/item/2006681078/): expressive silhouettes, hands, and pose variation informed the idea of a band with distinct personalities. All six characters are original SVG drawings; no existing cartoon character or illustration is reproduced.
- [Dela Gothic One](https://github.com/google/fonts/tree/main/ofl/delagothicone) by Artakana: heavy, broad letterforms give the headline the feeling of a party flyer. Instrument Sans and Space Mono balance it with readable controls. Dela Gothic One is a small Latin text subset served locally. Fonts and licenses are self-contained in `assets/`.

A tangerine page, charcoal machine, acid-yellow play button, and six soft instrument colors deliberately leave the previous edition’s quiet nautical palette behind. Each creature’s color matches its row. The band only bounces when triggered, and reduced motion removes the movement.

## How it works

`model.js` holds the presets, validated state, bounded undo/redo history, swing timing, and PCM WAV encoder. `audio.js` synthesizes every voice with Web Audio oscillators and deterministic filtered noise. A short lookahead scheduler uses the audio clock; animation reads scheduled events rather than driving the sound. Volume and mute gains change smoothly. Stop fades audio and cancels scheduled voices. Hidden tabs stop playback; returning never resumes sound automatically. User gestures are required to begin audio.

WAV export uses [OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext) and the same voice functions, tempo, swing, mutes, and volume as playback. It renders a warm-up bar before extracting two full bars so tails cross the loop boundary. Output is mono, 44.1 kHz, signed 16-bit PCM; no recording or microphone permission is involved. Silent mixes disable export. Exports snapshot the pattern when requested, so edits during rendering do not change the file being made. Bell and voice pitches follow the step’s position in a D-minor-inspired phrase; the bass follows D, D, A, C.

The edition-specific storage key is `deadgroovy:v1`. Grid dimensions, values, muted flags, and number ranges are validated on restore. Unavailable storage falls back to this visit and is clearly labeled. Undo history stays in memory, with up to 64 edits. A painted stroke is one undo action. Presets replace the arrangement, tempo, and swing while preserving master volume; random variations preserve tempo, swing, and volume and unmute the band. Clear only empties the notes.

On narrow screens, eight steps are visible at once. The half-page selector switches halves, and keyboard navigation reveals its target automatically. Buttons expose pressed state and voice/step labels. Arrow keys navigate the grid; Enter/Space toggle a cell. Keys 1–6 audition instruments outside text/range/select controls. Escape closes the instructions and restores focus. No runtime dependencies, analytics, accounts, external services, or external asset requests.

## Verification

Seven new model tests check preset independence, timing conservation, restoration, history, variation, silence detection, and WAV encoding. The full repository suite passes 50 JavaScript and seven workflow tests. Browser checks exercise real keyboard/touch input, painting and undo/redo, presets, mutes, tempo, persistence, storage failures, reduced motion, playback and interruption races, and export failure recovery. Downloaded WAV data was inspected for header correctness, duration, peak level, silence, individual voices, and loop boundaries. Dense maximum-volume patterns remain unclipped at both tempo extremes and maximum swing. The desktop and mobile layouts were visually inspected, and all nine edition routes load their assets and collection controls. Actual sound was not auditioned through speakers; no physical-device or non-Chromium browser testing was performed.
