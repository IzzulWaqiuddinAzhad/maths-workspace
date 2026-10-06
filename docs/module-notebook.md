# Module notebook prototype

Open `dist/notebook.html` through an HTTP server. All 23 original student-module pages are loaded, with 63 interactive Cartesian graphs across 64 questions. The production entry point remains `index.html`. This stays on `codex/module-notebook`, published independently under `/maths-workspace/notebook/notebook.html`; the main workspace remains at its original URL.

## Teacher workflow

- Scroll through the paper, or choose a section using the page picker. Previous/next arrows change pages. Page fits the current page width; Fit graph enlarges the selected graph.
- The existing pens, highlighter, eraser, ruler, text, shapes, images and calculator remain available. Undo/Redo changes writing independently of graph demonstrations. Apple Pencil draws; one finger pans when using the pen with Draw with touch off. Hand pans in any context. Two fingers zoom the paper, demonstrations and ink together.
- Tap Demo on any Cartesian graph. Choose a printed object and one of the four transformation tools. Use Select to move geometry handles, or switch to Pen to annotate. Each graph remembers its own objects and tool settings.
- **Translation:** freely move the image with the game pad. Tap for one square, hold to repeat, or slide between arrows. Horizontal and vertical distances update on the graph and panel. No guided steps are required.
- **Rotation of a point:** locate the centre, then move freely with the pad. The active endpoint pulses. Next keeps the current arm and bend and returns the pulsing point to the centre. Repeat for four arms; the pulse then stops and the rotation lever becomes available. Trial counts are allowed; an incorrect construction does not enable the question-angle shortcut. Back clears the active arm or reopens the previous one. The optional clock and quarter-turn presets remain available.
- **Rotation of a polygon:** pick or enter the centre, then use the lever. A reference ray and angle arc follow the farthest vertex. Moving the centre resets the turn. Quarter turns snap in either direction.
- **Reflection:** choose a horizontal, vertical or slanted mirror, draw one on the graph, or enter an equation with the in-app equation keypad. The straight presets start away from the axes. Use the pad or drag the line to shift it parallel to itself; drag either endpoint to change its slope. The displayed equation updates. The lever follows the drag and finishes the flip toward the last deliberate direction on release. Guides are optional.
- **Enlargement:** point questions retain centre, guide and across/up counting steps. Then use the pad freely to count the image, or switch to the scale-factor lever. Polygon questions use the centre and scale-factor controls directly. Negative factors are supported.
- **Question summary:** Demo opens a compact summary above the graph. Tap a point/object name to read its coordinates. Tap Centre to plot the current centre, or tap the centre itself to read it. Centre coordinates persist after the guides fade. Combined steps are stacked in application order; question-part selectors cover the practice-page subparts. Describe questions do not disclose their hidden transformation parameters.
- **Combined transformations:** Tap a live image, select its “current image” entry, or use Use image to keep the current result and selects it as the next source. Choose the next transformation. The original printed object remains unchanged. Delete image removes only a generated copy.
- **Read coordinates:** tap a source/image vertex or use Read object / Read image. The point blinks, the guide reaches the x-axis, the number appears there and moves into its coordinate slot; y follows. Only the guides fade. Coordinates stay visible, move with the image and survive reload. For a polygon, the vertex selector chooses which coordinate to read.
- Full screen hides toolbar and panels for a clean projected page. Tools brings them back. Safari versions without the fullscreen API use the clean viewport layout but may retain browser chrome.

## Architecture and preservation

`workspace-host.js` configures the existing drawing engine. The optional geometry interaction hook in `app.js` uses its existing pointer capture, world conversion and pinch cancellation. The normal app supplies no hook. Demonstrations are drawn beneath annotations and never become erasable document objects.

`notebook-model.js` stacks the pages and maps each printed grid into the common world. `notebook-assets/module-pages.js` stores geometry extracted from the editable student-module builder. Page SVGs are copied directly from its original HTML; questions, axes and source shapes are not redrawn or replaced. `scripts/extract-notebook-module.py` documents extraction and does not save or overwrite the source PDF.

`notebook-session.js` adapts the existing four transformation models and keeps per-object/per-tool state. `notebook-render.js` reuses the existing geometry and coordinate animation renderers. `line-equation-input.js` shares the existing reflection equation editor with the workspace. `notebook.js` connects these to page navigation and the shared workspace tools.

Writing and demonstrations save locally under separate module prototype keys. Earlier A3 ink and its camera are translated into the corresponding page position once; earlier rotation states migrate separately. The old save keys and the main workspace document remain intact. Reset demo affects only the selected object/tool.

## Validation and limits

Run `npm test`. Coverage includes all page/grid bounds, all source objects in all four transformations, positive/negative/inverse point results, free rotation arm commits and cursor reset, finite rendering coordinates, image chaining, persistent vertex readouts, portrait/landscape fit, migration, camera transforms, coordinate-animation timing and writing-history isolation.

Browser checks cover free translation, four rotation arms and reset-to-centre, mirror dragging/tilting/flipping, enlargement counting, later polygon pages, coordinate persistence, writing/Undo/Redo, calculator, page navigation and clean layout. Physical iPad/Pencil/Safari gesture testing still requires the device.

Area-only questions without Cartesian graphs retain the printed diagrams and writing tools. This release does not add new area/tessellation lessons, arbitrary PDF import, annotated PDF export or cross-device sync. Off-grid trial geometry is clipped to the printed graph. The Pages workflow combines the unchanged main workspace with this branch in a separate notebook subdirectory. Local HTTP previews use random-byte UUID generation when the secure-context UUID API is unavailable. Startup failures display Reload instead of an endless loading message.


## Finding rotation centres

The existing trial rotation and its chosen centre stay independent from **Find centre**. Hide trial removes its overlays; returning to Trial rotation shows the preserved trial again. Neither operation changes ink or its undo history.

Available wherever the printed question contains matching rotation polygons: Q33–40, Q47, Q49 (Q → R), Q50, Q60, Q62(i) (ABCD → EFGH), and Q64(ii). Availability checks all vertices against quarter/half-turn geometry, excluding translation, reflection and enlargement pairs.

1. Choose **Find centre**, then tap a vertex on either printed polygon. Its corresponding vertex pulses too. **Choose vertex pair** stays active so another tap can change the pair. Using the game pad or changing the square step starts construction. The printed source → image direction stays unchanged when the image supplies the controlled tip.
2. Move with the shared game pad (1 square by default, optionally ½ square). The other tip moves oppositely. Press **Next arms** only after the tips meet at their midpoint M.
3. Construct the other two arms from M with quarter-turned lengths. Press **Check centres** once their tips reach the two 90° candidates. Undo move backs through movement and construction stages; Reset demo clears only this study.
4. Choose M (180°), C₁ or C₂ (90°), then tap any vertex to pulse its matching pair. **Next: first distance** draws one radius; **Next: matching distance** draws the other. Lengths appear progressively in the graph summary and controls, without a comparison circle. Tapping a different vertex restarts only this reading, preserving the construction and chosen centre. The summary also supplies Next in clean view.
5. Test clockwise/anticlockwise 90°, or 180° at M. A faint whole polygon rotates; a match requires every corresponding vertex to coincide. Equal radii on one pair never count as proof by themselves. Hide test removes this trial while preserving the construction.

Candidate centres come from M ± a quarter-turn of the selected half-vector; no answer-key coordinates seed the construction. Half-square midpoints, zero-length components, saved intermediate stages, reversed tip selection, and centres outside the printed grid are supported. Off-grid tips/candidates have an edge arrow and candidate buttons identify them as beyond the grid. Older saved comparisons restore with both radii complete; a new pair starts at the pulse stage.

Architecture: `notebook-centre.js` owns pure construction/verification state; `NotebookSession` saves it alongside existing engines. `notebook-centre-render.js` uses the shared notebook label collector, graph coordinates and clip. The host's existing pointer intent, animation loop and game pad route input, so pen, pinch and ink undo remain shared.

Validation: 242 automated tests cover every supported graph, all Q33–40 vertex pairs, both controlled sides, half-square movement, 180° rejection of 90° candidates, incomplete-step gating, save/restore, staged radii and circle removal. Browser checks cover pair switching, progressive distance lines, selection continuity and mixed-question availability in the tablet layout. Physical iPad/Safari touch and Apple Pencil remain device checks.

## Describing enlargement: construct the centre from vertex pairs

For every printed enlargement pair, Demo opens **Find centre** without automatic guides or a trial image. Tap a vertex on either printed shape to pulse the corresponding pair. **Add line** first joins those vertices, then extends the line in both directions to the graph edges. Each added line remains while the teacher chooses another pair. Once two completed lines have a unique intersection, **Reveal centre** marks that intersection as C with its coordinates; the centre stays hidden until the teacher presses it. The reveal is calculated from the added lines, not the answer key. Overlapping or parallel lines do not enable the reveal.

The panel and graph summary both offer Add line and Reveal centre, including clean view. After revealing, the same button becomes Hide centre. Choose vertex pair stays active after each line. Undo line removes the latest added line and hides the centre if the remaining lines no longer define an intersection; Reset demo clears the line study independently of ink and trial enlargement. Trial enlargement retains the existing centre/scale controls; returning to Find centre restores the construction. Saved studies restore completed lines, the selected pair and whether the centre was revealed. Coincident corresponding vertices may be selected but cannot define a line; the UI requests another pair.

This applies to Q41–50, Q55–60, Q61(ii), Q62 graph 1 (EFGH → JKLM), Q63(ii), and Q64(ii), selecting the printed enlargement stage inside mixed questions. Mixed questions retain their existing starting transformation; choose Enlargement to enter the study.

`notebook-enlargement.js` owns validated printed-pair detection and persisted line state. `notebook-enlargement-render.js` reuses the existing infinite-line clipping utility and shared label collector. Pointer routing, animation, page transforms, pens, and pinch remain in the notebook's existing shared layers.

Validation: 256 tests pass, including no automatic strokes, explicit line/reveal gating, both-end extension for all line directions, intersection geometry for every supported pair, coincident/parallel lines, centre visibility after Undo/Reset, save/restore and trial independence. Browser verification covers tablet layout, pair selection from both shapes, staged drawing, persistent lines, centre reveal/hide, Undo line and clean-view controls. Physical iPad/Pencil validation remains a device check.
