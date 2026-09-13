# Maths Workspace — Milestone 1

Static ES-module application. Serve dist/ with any HTTP server.

Implemented: infinite canvas viewport (10–800% zoom), cursor-anchored zoom, mouse/pointer panning, touch pinch/pan, keyboard navigation, independent serializable document objects, transaction-based undo/redo, local autosave and light/dark themes.

Architecture: dist/core.js contains the DOM-independent document model, object factory, history transactions and coordinate mathematics. dist/app.js owns input and view rendering. Canvas pixels are a display surface only; objects remain serializable records. New object renderers and tool controllers should be added in subsequent milestones. Pan/zoom are view preferences and do not enter document undo history. Title changes demonstrate document history. Continuous editing must call transact once at commit.

Test: drag to pan; scroll or use +/- to zoom; tap Return to origin; rename the title and test undo/redo; refresh to check title and viewport persistence; toggle both themes. On a touch device use two fingers to pinch/pan. Automated core checks live in work/core.test.mjs locally.

Known limitations: no pen or object creation/editing tools by design. Undo history lasts for the current session. Local browser storage is device/origin-specific; clearing site data deletes the notebook. Invalid existing saves are preserved without overwriting, and a status message reports the issue. Physical stylus and multitouch testing remains necessary. Object rendering and performance at thousands of strokes belong to later milestones.

Next: Milestone 2 — Ball Pen.
