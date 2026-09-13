# Maths Workspace

A local-first mathematics notebook with a white light theme and dark theme. The interface supports English and Bahasa Melayu. The subtle IWA credit identifies Izzul Waqiuddin Azhad | SMK Telok Mas and opens WhatsApp at +60163314392 only when clicked.

## Run and validate

Serve `dist/` with any HTTP server, e.g. `python3 -m http.server 5173 --directory dist`. Run `npm test` for deterministic document, geometry, erasing, recognition, coordinate and localization checks. No build step or third-party runtime dependencies are needed.

## Implemented tools

- Ball, pressure and pencil pens, four widths, five customizable colours, pressure fallback and pencil hold-to-snap preview.
- Highlighter with three widths and colours; stroke, normal and precision erasers. Partial erasing splits ink objects, and a drag commits as one undo action.
- Tap and lasso selection; move, eight resize handles, rotation, duplicate, copy/paste inside the notebook, delete, lock/unlock, z-order and grouping. Locked objects remain protected from drawing-tool edits.
- Preset lines, arrows, circles, ellipses, triangles, squares, rectangles, parallelograms, rhombi, kites, trapezia, rounded rectangles, semicircles, arcs, regular/free polygons, polylines and curves. Circle creation includes centre-radius mode. Shapes/path nodes are editable, with point insertion/removal, simple smooth/corner/symmetric modes, line patterns and endpoint styles.
- Separate smart-shape tool recognizes deliberate lines, circles/ellipses, rectangles and simple polygons/polylines. Recognition never runs on regular ball-pen handwriting.
- Cartesian objects: asymmetric ranges, coherent square units, major/detailed/off grids, tick intervals, labels, axes and arrows. Select and enable Move axes (or Alt-drag) to reposition axes by shifting the ranges.
- Ruler guide: movement, pivot locking, rotation handle and canvas-unit ticks. Pen strokes beginning near its edge stay straight and remain ink.
- Editable text, font family/size, bold, italic, alignment. Local JPEG/PNG/WebP import and browser camera capture, image transforms, opacity, non-destructive percentage crop and locking.
- Infinite pan and anchored zoom; pointer capture and coalesced pointer samples; a separate transient canvas avoids repainting the entire document while handwriting. Two-finger navigation, optional finger drawing, stylus input priority and keyboard shortcuts.
- Local document autosave, JSON backup/import and transaction history. Language, theme and tool preferences persist locally.

## Geometry annotation update

Shapes erase as whole objects when the eraser crosses their visible outline; locked shapes remain protected. New shapes immediately enter selection with edit points. Point options provide clockwise unused-letter suggestions and independent angle arcs with calculated, hidden, x, θ or custom labels. Edge options distinguish label-only values from measured lengths and geometry changes. Accurate triangle construction accepts two sides and their included angle; 5 cm, 6 cm and 70° produces an opposite side of 6.36 cm. Measurements use document units, not physical screen centimetres. This is construction and editing, not a persistent constraints solver. Cartesian planes are transparent and inserted at the back. Double-click/double-tap selection is available across tools.

## Architecture

`dist/core.js` owns serializable object records, validation, document transactions and coordinate transforms. `geometry.js` owns shape creation, hit testing, recognition, snapping and ink splitting. `render.js` draws independent records without flattening document state. `i18n.js` owns paired EN/BM strings. `app.js` connects pointer interactions, contextual settings, files and document history. `styles.css` and `index.html` provide the responsive interface.

The schema remains version 1 and loads existing foundation notebooks. Document edits are undoable; navigation/preferences are not document edits. History is capped at 100 interactions and resets on reload. Source data is not tied to DOM nodes. Image uploads stay in browser storage; publication does not upload notebook content.

## Verification and practical limits

Automated checks cover transforms and zoom anchoring, history branching, serialization, erased fragments and locked ink, shape construction, recognition, equal-unit Cartesian metrics, snapping and translation completeness. Local UI checks verified writing, shape creation/movement, highlighting, partial erase with a single undo, Cartesian insertion, text creation, both themes, BM switching and save/reload. Camera permissions, real stylus pressure and physical multitouch require testing on the intended devices.

This is the basic toolset, not every advanced interaction in the original roadmap. Curve smoothing is node-based; independently draggable Bezier tangent handles and full mixed-segment editing remain future work. Multi-selection supports movement and grouping; resize/rotation handles currently operate on one object at a time. The ruler uses its desktop rotation handle, not two-finger rotation. Snapping currently covers vertices, centres and plane grid points; it is not a constraints engine. Large documents and many high-resolution images may exceed browser local-storage limits; failures are reported and JSON export remains available. Text uses manual line breaks. Finger drawing is opt-in to preserve palm-safe navigation.

## How to test

1. Write with Pen, change width/colour, then Undo and Redo.
2. Highlight ink, switch Eraser to Normal, cross the middle of a stroke, then Undo once.
3. Draw a preset shape: it immediately shows editable points and can be moved. Tap a vertex for names and individual angle options; tap an edge for centimetre labels. Double-click an object from any tool to select it. Try erasing its outline, then Undo.
4. Insert a Cartesian plane, select it, edit ranges/grid and try Move axes.
5. Insert text or a photo; lock a worksheet and draw over it. Select an image for crop margins.
6. Insert a ruler, return to Pen and start near its edge for straight ink.
7. Switch EN/BM and light/dark, refresh and check that objects/preferences survive.
8. Export a JSON backup. On the target tablet, test pen pressure, two-finger pinch/pan, palm contact and optional finger drawing.

No equation recognition, plotting, solving, AI, authentication, cloud document storage or collaboration is included.
