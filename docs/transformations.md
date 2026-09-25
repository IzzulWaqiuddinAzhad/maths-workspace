# Transformations exploration

Open Explore → Transformations → Translation, reflection and rotation. EN/BM and the workspace theme carry into the exploration.

## Teaching interactions

- Add a point, line, triangle, rectangle, square or custom polygon. Custom polygons close at the first vertex or with Finish polygon. Concave polygons are supported; crossing and flattened polygons are rejected. Drag vertices or the whole selected object, or edit vertex coordinates through the shared maths keypad. Names and labels use ordinary text fields.
- Translation: the floating cross-shaped gamepad changes the vector by one mathematical unit; hold a direction to repeat. Its centre button resets the vector. Drag the pad heading to reposition it within the graph (or focus the heading and use arrow keys; Home restores its default bottom-right position). You can also edit the column vector or drag the preview image. The original remains visible.
- Reflection: draw a mirror line or enter an affine equation with the on-screen keypad. Examples: `x=3`, `y=-2`, `y=x`, `y=2x+1`, `2x+3y=4`. Preparing the line does not transform the object. Pull the lever upward to flip about that line; while held it follows continuous progress. On release it finishes in the last deliberate direction, including a short pull. Pull downward to return to the original position. The midpoint is an edge-on view of the page turn. Drag the line body or central diamond to slide both endpoints together without changing direction. Drag either circular endpoint to turn the line around the other endpoint. Editing the mirror resets the preview and lever. Arrow Up/End and Arrow Down/Home provide keyboard equivalents.
- Rotation: choose the centre on the graph or enter its coordinates. The lever starts at zero, goes up anticlockwise to +360° and down clockwise to −360°. It captures quarter turns within 10° and holds them until the pointer moves more than 18° away, reducing jitter. Exact input and keyboard nudges bypass snapping. Changing the centre resets to zero. Arrow keys change 1°, Page Up/Down 90°, Home resets, End selects +360°.
- The rotation guide is visible by default: a dashed line runs from the centre to the farthest source vertex, a solid line follows its image, and a directed wedge shows the angle and direction, including reflex angles and full turns. The reference vertex stays stable during rotation. Use Show rotation angle to hide it. Optional translation/reflection guides show vector components or equal reflection distances. Vertex labels stay upright; coordinates can be shown.
- Tap a completed preview image, or use Keep image, to store and select it for the next transformation. Translation preview dragging still adjusts the vector; a tap is distinguished from a drag by a six-pixel movement threshold. Incomplete reflection previews cannot be kept. Originals and intermediate images remain independent objects with unique prime labels, so a sequence can be reviewed without changing earlier steps.
- Delete beside the object selector removes only the selected item. Delete/Backspace also works while the graph has keyboard focus. Undo restores deleted items; editing a text or numeric field does not trigger canvas deletion.
- Contextual instructions appear on the graph for drawing, setting a reflection line, choosing a centre and using each transformation. The banner does not intercept graph gestures.
- Graph-edge arrows pan the view. Fit includes the origin, objects and current preview. Zoom, wheel and canvas-only pinch affect the graph, not the controls. One square remains one mathematical unit.
- Pen and whole-stroke Eraser annotate the graph. Annotations follow pan/zoom, stay separate from transformation geometry, and support Undo/Redo. Undo also covers object edits and kept images.
- Enlargement is intentionally marked “Coming next”. There are no transformation quizzes or PDFs in this release.

## Architecture

`transform-model.js` contains pure mathematical-coordinate geometry, camera conversion through core.js, affine parsing, reflection scrub state, rotation snapping/guide geometry, parallel mirror movement, independent image snapshots, annotation hit testing and saved-document validation. The reflection is an orthographic page-turn projection, not a perspective 3D renderer. All preview transformations are recalculated from the source, avoiding accumulated drift.

`transform-ui.js` uses the existing DocumentStore and maths keypad. One completed document gesture is one history entry; preview, lever and camera movements are UI state. A single canvas pointer layer uses pointer capture and the existing installCanvasOwnership helper for mixed-origin touch gestures. Resize preserves the view centre. Levers stay beside the graph; narrow/portrait displays put properties below the graph.

`transform-render.js` renders unit grids, complete grid boundaries, axes, upright labels, source/image, guides and ink. It reuses LabelLayout and reserves label space around axis numerals, graph controls and visible instruction/gamepad overlays. The gamepad position is screen-space UI state; moving it never changes the graph camera. `transform.css` is scoped to this exploration.

Data is isolated under `maths-workspace:transformations:v1` in localStorage. Existing notebook/angle/bar-model data is unchanged. Objects and annotations persist; camera, unfinished constructions, transformation previews and undo history reset on reopening. A storage failure keeps work in memory and shows a status message. Limits: 100 objects, 30 polygon vertices, 1,000 strokes and 10,000 samples per stroke; screen zoom is 50–250%.

## Verification

Run `npm test`. The transformation tests check trial-paper coordinate examples, distance preservation, inverse reflections, hinge and flip endpoints, affine parsing/rejection, signed rotations and detents, release direction, transformed coordinates after pan/zoom, concave/crossing polygons, annotation erasing, image labels, saved-document validation and storage failure handling. Added regression cases check snap capture/release, stable farthest-vertex selection, parallel mirror movement, composed independent images, deletion with Undo/Redo, and signed reflex/full-turn wedge rendering and hiding. The existing regression suite covers angle activities, proof rendering, calculator, worksheets, keypad and gesture ownership.

Browser interaction checks performed locally:

- Translation gamepad directions, reset and repositioning; keypad and preview dragging after pan/zoom; graph pan controls remain accessible on phone layouts.
- Drawn vertical mirror and on-screen diagonal equation, original retained, lever release completing upward/downward, guides and Fit. Line-body and centre-grip movement preserve direction; endpoint movement turns the line; edits reset reflection.
- Rotation centre placement/editing, 90°/180°/270°/360° and clockwise angles, centre reset, stronger snapping, exact 89° input, directed wedges and visibility toggle.
- Tap-to-select completed translation, rotation and reflection images; a sequence through all three transformations; independent originals; deletion with Undo/Redo and reload.
- Point, line, triangle, rectangle, square and concave polygon creation, labels/vertex properties.
- Pen, eraser, restored strokes, pan/zoom anchoring.
- English/Malay, light/dark; desktop 1280×720, tablet portrait 820×1180 and phone 390×844 layouts; read-only numeric fields and custom keypad.

Real iPad/Android stylus, native-keyboard suppression and simultaneous physical multi-touch still need device testing. Browser viewport testing is not a substitute for real touch hardware. Very dense overlapping objects may still require panning/zooming or hiding coordinate labels for clarity.
