# Cartesian graph controls and complete PNG export

Implemented locally on 16 September 2026. No source push or deployment was performed.

## Baseline

The starting checkout passed 47 tests. Browser inspection confirmed that graph creation automatically opened the equation editor, the default graph was a square major grid, and resizing changed only graph dimensions. Pen strokes were independent document objects. The existing expression parser, explicit sampler, implicit contour engine and inequality shading were retained.

## Changes

- Cartesian toolbar selection inserts portrait graph paper: 9 × 13 major squares, ten minor divisions per square, centred axes. Existing saved graphs retain their ranges and grid settings.
- Three mutually exclusive grid buttons: No Grid, Detailed Grid, Major Grid. Existing tick, label, interval, axis and arrow controls remain.
- Axis pad shifts the origin by one major interval per press. Extent pad adds right/top or crops left/bottom by one major interval, preserving square size and retained world positions. Minimum extent is one major square; existing 200-coordinate-unit maximum remains.
- Graph selection no longer opens equation entry. Insert function explicitly opens the existing keyboard and function list. Pen, text and navigation gestures on graph background remain owned by their active tools.
- Arrow tips end at grid boundaries. Terminal ticks within the arrowhead are omitted; x/y sit beside their tips. Axes outside the visible range are not drawn.
- Strict inequalities use dotted boundaries; inclusive inequalities use solid ones. The continuous explicit boundary path no longer restarts its dash pattern at every sample.
- Graph annotations remain ordinary editable document objects with an optional graphId. Newly created intersecting content is associated; existing intersecting ink is captured when moving/resizing/cropping or exporting a graph. Whole-graph resize uses a uniform transform, including annotation positions, handwriting pressure and stroke scaling. Move/rotation follow the same association. Copied graphs relink copied annotations to avoid clipping against their originals.
- Cropping changes graph bounds without deleting stored ink or functions. Associated content is clipped to the graph frame; hidden portions are excluded from picking. Undo restores the previous bounds and visible content.
- Download PNG composites the graph, all visible plotted functions and shading, separate pen strokes, text, shapes and their labels, and intersecting images. It uses the workspace renderer, white background, and an extra margin; no handles or UI are exported. Default output is 1728 × 2368 pixels, capped at 4096 pixels on the longest side for large grids. Export is independent of camera pan/zoom.
- Document schema remains version 1; optional association/grid fields are validated. All changes to stored graph settings use the existing history and local save system.

## Verification

55 tests pass (47 original plus eight graph regression cases); syntax checks and git diff whitespace checks pass. Added coverage includes portrait defaults, both pads, extent guards, rotated/scaled coordinate preservation, sparse crossing ink association, proportional resize, history/serialization, strict/inclusive boundaries, representative existing equations, arrow endpoints, export compositor, copied associations, and non-accumulating drag movement.

Browser interaction checks completed:

1. Insert graph: correct portrait detailed grid; no automatic equation editor.
2. Explicitly open Insert function; enter y=x² and x<2 through the on-screen keys.
3. Draw three pen strokes on graph; select and enlarge graph; strokes remain aligned with proportional weights.
4. Download and visually inspect the actual PNG: quadratic, dotted x=2 boundary, left shading, grid, axes and all pen marks present on white background.
5. Switch No Grid/Major Grid/Detailed Grid; axes and plotted content remain.
6. Exercise all four directions on both pads; verify ranges and retained ink placement. Undo/Redo extent changes.
7. Add visible text y=x² with Text Tool, export again and visually verify text plus ink and plots.
8. Reload notebook: graph, both functions, ink, text and changed ranges persist; selecting graph still leaves keyboard closed.
9. Change x<2 to x≤2: solid boundary, unchanged shading side.
10. Move graph, zoom canvas to 80%, switch dark mode: graph, ink and text stay aligned and readable. No browser errors recorded.
11. Phone-width layout (390 × 844): controls, both pads and download button fit the viewport. This was responsive layout testing, not real touch hardware testing.

Actual PNGs inspected: Downloads/cartesian-graph.png and Downloads/cartesian-graph (1).png. A review copy of the second export is in work/cartesian-export-qa.png (ignored, not part of deployment).

## Remaining verification / limits

- Physical iPad/Android finger/stylus gestures and native keyboard suppression were not tested on hardware. Existing shared pointer/touch ownership and custom equation keyboard are reused.
- Implicit curves/inequality fills keep the existing numerical sampling limits; this is not a new symbolic graphing engine.
- Export contains the current visible graph frame. Annotation portions outside that frame are clipped, and unrelated objects outside it are excluded. Stored cropped content is retained.
- The default detailed grid matches the reference's 9 × 13 grid density; it is a graph object, not an A4 PDF/page export feature.

## Files

Main changes: dist/app.js, dist/render.js, dist/algebra.js, dist/function-panel.js, dist/functions.css, dist/core.js, dist/index.html.
New shared graph helpers: dist/graph-model.js, dist/graph-render.js.
Tests: tests/graph-controls.test.mjs.
Import-version refresh only: dist/geometry.js, dist/annotations.js, dist/angle-model.js, dist/angle-ui.js, dist/proof-ui.js.

## Suggested device check

Insert a graph, choose Pen and enable Draw with touch for finger drawing (stylus input uses the existing stylus path). Scribble, select graph and resize it, try both pads, then Download PNG. Confirm no equation keyboard opens until Insert function is pressed; inspect the downloaded PNG for the complete ink and graph. Check a saved/reopened notebook and Undo/Redo before publishing.
