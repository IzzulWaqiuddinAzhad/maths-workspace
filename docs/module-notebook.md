# Module notebook prototype

Open `dist/notebook.html` through an HTTP server. All 23 original student-module pages are loaded, with 63 interactive Cartesian graphs across 64 questions. The production entry point remains `index.html`. Keep this work on `codex/module-notebook` until reviewed.

## Teacher workflow

- Scroll through the paper, or choose a section using the page picker. Previous/next arrows change pages. Page fits the current page width; Fit graph enlarges the selected graph.
- The existing pens, highlighter, eraser, ruler, text, shapes, images and calculator remain available. Undo/Redo changes writing independently of graph demonstrations. Apple Pencil draws; one finger pans when using the pen with Draw with touch off. Hand pans in any context. Two fingers zoom the paper, demonstrations and ink together.
- Tap Demo on any Cartesian graph. Choose a printed object and one of the four transformation tools. Use Select to move geometry handles, or switch to Pen to annotate. Each graph remembers its own objects and tool settings.
- **Translation:** freely move the image with the game pad. Tap for one square, hold to repeat, or slide between arrows. Horizontal and vertical distances update on the graph and panel. No guided steps are required.
- **Rotation of a point:** locate the centre, then move freely with the pad. The active endpoint pulses. Next keeps the current arm and bend and returns the pulsing point to the centre. Repeat for four arms; the pulse then stops and the rotation lever becomes available. Trial counts are allowed; an incorrect construction does not enable the question-angle shortcut. Back clears the active arm or reopens the previous one. The optional clock and quarter-turn presets remain available.
- **Rotation of a polygon:** pick or enter the centre, then use the lever. A reference ray and angle arc follow the farthest vertex. Moving the centre resets the turn. Quarter turns snap in either direction.
- **Reflection:** choose a horizontal, vertical or slanted mirror, draw one on the graph, or enter an equation with the in-app equation keypad. The straight presets start away from the axes. Use the pad or drag the line to shift it parallel to itself; drag either endpoint to change its slope. The displayed equation updates. The lever follows the drag and finishes the flip toward the last deliberate direction on release. Guides are optional.
- **Enlargement:** point questions retain centre, guide and across/up counting steps. Then use the pad freely to count the image, or switch to the scale-factor lever. Polygon questions use the centre and scale-factor controls directly. Negative factors are supported.
- **Combined transformations:** Use image keeps the current result and selects it as the next source. Choose the next transformation. The original printed object remains unchanged. Delete image removes only a generated copy.
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

Area-only questions without Cartesian graphs retain the printed diagrams and writing tools. This release does not add new area/tessellation lessons, arbitrary PDF import, annotated PDF export or cross-device sync. Off-grid trial geometry is clipped to the printed graph. The main GitHub Pages workflow is unchanged.
