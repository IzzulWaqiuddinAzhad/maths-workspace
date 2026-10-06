# Module notebook prototype

Open `dist/notebook.html` through an HTTP server. This branch adds one original module page: printed A3, Questions 9–12 (90-degree rotation). The production entry point remains `index.html`.

## Teacher workflow

- Write anywhere using the existing workspace pens, highlighter, eraser, shapes, ruler, text and image tools. Calculator stays in the toolbar. Undo/Redo is separate from demonstration steps.
- One finger pans by default; Apple Pencil draws. Enable Draw with touch if required. Two fingers zoom the paper and its content together. A mouse wheel scrolls; Control/Command + wheel zooms.
- Scroll to a graph and tap Demo. Next locates the centre and progresses one segment at a time. Use the direction pad or Count for me. Complete each straight segment and its bend before the next arm.
- Once constructed, explore angles in either direction, choose quarter-turn presets, optionally show the clock, then reveal the answer at the correct angle. Wrong trial constructions do not unlock the answer.
- Page fits the page width. Fit graph gives a closer view. Full screen hides the toolbar and panels; Tools brings them back. Safari versions without the fullscreen API get a clean viewport view instead; they may retain browser chrome.
- Writing and the four lesson states save locally under separate prototype keys. Reset demo affects only that question. The existing workspace document is not changed.

## Architecture

`workspace-host.js` provides optional configuration to the existing drawing engine in `app.js`. The normal app uses empty configuration. Hosts can supply a background, camera constraints, document keys and a public view interface without duplicating pointer handlers, tool state or undo logic.

`notebook-model.js` calibrates the four graphs against the original page SVG. One grid unit is 12.5 PDF points. The paper, demonstrations and annotation objects use this same world space. The SVG comes directly from the editable source of `BIJAK_SPM_PPDMT_2026_Transformasi_Bengkel_v4_2.pdf`, section A3, PDF page 4. Printed questions, grid, axes and given points are retained.

`notebook.js` composes the page host with the existing RotationLesson, rotation renderer and coordinate-guide animation. Per-graph LabelLayout instances prevent one question's label placement affecting another. Demonstrations render beneath writing and are never selectable or erasable document objects.

## Validation

Run `npm test`. New coverage checks all four original SVG point locations, shared zoom/pan mapping, iPad fit geometry, both construction orders and all answers, state recovery, page bounds and writing-history isolation.

Browser checks cover manual and automatic counting, reveal gating, angle exploration, clock, paper scrolling, handwriting, Undo/Redo, calculator buttons, safe calculator display, reload persistence, portrait/landscape toolbar bounds and clean fullscreen. A physical iPad, Pencil palm rejection and real Safari pinch gestures still require device testing.

This is a one-page prototype. It does not yet preload the rest of the module, import arbitrary PDFs, export an annotated PDF or sync between devices. Keep it on `codex/module-notebook` until the interaction has been reviewed. The main GitHub Pages workflow is deliberately unchanged.
