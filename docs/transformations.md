# Transformations exploration

Open Explore → Transformations → Translation, reflection and rotation. EN/BM and the workspace theme carry into the exploration.

## Teaching interactions

- Add a point, line, triangle, rectangle, square or custom polygon. Custom polygons close at the first vertex or with Finish polygon. Concave polygons are supported; crossing and flattened polygons are rejected. Drag vertices or the whole selected object, or edit vertex coordinates through the shared maths keypad. Names and labels use ordinary text fields.
- Translation: the four blue arrows change the vector by one mathematical unit, hold to repeat, edit the column vector, or drag the preview image. The original remains visible.
- Reflection: draw a mirror line or enter an affine equation with the on-screen keypad. Examples: `x=3`, `y=-2`, `y=x`, `y=2x+1`, `2x+3y=4`. Preparing the line does not transform the object. Pull the lever upward to flip about that line; while held it follows continuous progress. On release it finishes in the last deliberate direction, including a short pull. Pull downward to return to the original position. The midpoint is an edge-on view of the page turn. Moving the mirror or a handle resets the preview. Arrow Up/End and Arrow Down/Home provide keyboard equivalents.
- Rotation: choose the centre on the graph or enter its coordinates. The lever starts at zero, goes up anticlockwise to +360° and down clockwise to −360°. Three-degree detents help select quarter turns; exact angle input also supports other angles. Changing the centre resets to zero. Arrow keys change 1°, Page Up/Down 90°, Home resets, End selects +360°.
- Optional guides show translation components, equal reflection distances or the rotation arc. Vertex labels stay upright; coordinates can be shown.
- Keep image stores the preview as a new selectable object for successive transformations. Uncommitted previews do not replace the original.
- Graph-edge arrows pan the view. Fit includes the origin, objects and current preview. Zoom, wheel and canvas-only pinch affect the graph, not the controls. One square remains one mathematical unit.
- Pen and whole-stroke Eraser annotate the graph. Annotations follow pan/zoom, stay separate from transformation geometry, and support Undo/Redo. Undo also covers object edits and kept images.
- Enlargement is intentionally marked “Coming next”. There are no transformation quizzes or PDFs in this release.

## Architecture

`transform-model.js` contains pure mathematical-coordinate geometry, camera conversion through core.js, affine parsing, reflection scrub state, annotation hit testing and saved-document validation. The reflection is an orthographic page-turn projection, not a perspective 3D renderer. All preview transformations are recalculated from the source, avoiding accumulated drift.

`transform-ui.js` uses the existing DocumentStore and maths keypad. One completed document gesture is one history entry; preview, lever and camera movements are UI state. A single canvas pointer layer uses pointer capture and the existing installCanvasOwnership helper for mixed-origin touch gestures. Resize preserves the view centre. Levers stay beside the graph; narrow/portrait displays put properties below the graph.

`transform-render.js` renders unit grids, complete grid boundaries, axes, upright labels, source/image, guides and ink. It reuses LabelLayout and reserves space around axis numerals and graph controls. `transform.css` is scoped to this exploration.

Data is isolated under `maths-workspace:transformations:v1` in localStorage. Existing notebook/angle/bar-model data is unchanged. Objects and annotations persist; camera, unfinished constructions, transformation previews and undo history reset on reopening. A storage failure keeps work in memory and shows a status message. Limits: 100 objects, 30 polygon vertices, 1,000 strokes and 10,000 samples per stroke; screen zoom is 50–250%.

## Verification

Run `npm test`. The transformation tests check trial-paper coordinate examples, distance preservation, inverse reflections, hinge and flip endpoints, affine parsing/rejection, signed rotations and detents, release direction, transformed coordinates after pan/zoom, concave/crossing polygons, annotation erasing, image labels, saved-document validation and storage failure handling. The existing regression suite covers angle activities, proof rendering, calculator, worksheets, keypad and gesture ownership.

Browser interaction checks performed locally:

- Translation arrows and keypad, preview dragging after pan/zoom.
- Drawn vertical mirror and on-screen diagonal equation, original retained, lever release completing upward/downward, guides and Fit.
- Rotation centre placement/editing, 90°/180°/270°/360° and clockwise angles, centre reset, kept images, Undo/Redo and reload.
- Point, line, triangle, rectangle, square and concave polygon creation, labels/vertex properties.
- Pen, eraser, restored strokes, pan/zoom anchoring.
- English/Malay, light/dark; desktop 1280×720, tablet portrait 820×1180 and phone 390×844 layouts; read-only numeric fields and custom keypad.

Real iPad/Android stylus, native-keyboard suppression and simultaneous physical multi-touch still need device testing. Browser viewport testing is not a substitute for real touch hardware. Very dense overlapping objects may still require panning/zooming or hiding coordinate labels for clarity.
