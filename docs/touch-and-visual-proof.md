# Touch UX and Visual Proof release

## Input system changes
Mathematical number fields share MathKeypad, a readonly focus-safe value field, a common edit reducer, and range/sign/integer validation. On-screen and physical keys use the same path. Units are displayed separately. Ordinary text editing, document titles and annotations remain editable.

## Calculator changes
All three modes now use state-controlled, non-editable displays. Natural input still supports structured fractions and roots. Physical keys are handled inside the calculator, without hidden inputs. Clear, Delete, cursor movement and mode switching keep focus in the calculator. The workspace toolbar button opens/closes the floating calculator.

## Touch/browser-selection changes
Selection and callouts are suppressed only on canvas and interaction surfaces. Canvas native drag is prevented; images are drawn into canvas rather than draggable DOM images. Text dialogs retain native editing behaviour.

## Canvas pinch-zoom changes
Touch origin tracking distinguishes two fingers starting on the canvas from mixed canvas/panel gestures. Mixed gestures cancel canvas actions and stay blocked until all fingers release. Page touch movement is prevented only for multi-touch gestures involving that canvas. Unrelated outside gestures retain browser behaviour. Existing pointer capture and screen/world transforms are preserved. The workspace and angle exploration cameras zoom around the gesture midpoint; UI panels are not transformed.

## Tool-state / repeated-shape changes
A separate, unsaved ToolContinuity state remembers the creation tool. Auto-selection after creation is temporary; the next empty-canvas press starts a new shape with that same press. Vertex/resize/rotation handles and existing objects take priority. Explicitly choosing Select cancels automatic continuation. Polygon completion and Smart Shape use the same creation path. Only document edits enter Undo history. Undo and Redo are now above the workspace, outside the tool column.

## Right-angle-renderer changes
A shared angleMark renderer switches between arcs and ray-oriented corner markers within 0.1° of 90°. General geometry defaults to marker-only; exploration retains the numerical value. Per-angle rightAngleDisplay supports marker-only or marker-and-value. Proof corner pieces use the same renderer.

## Visual Proof
Explore → Interior angles → Visual Proof. Generate 3–20-sided polygons and drag vertices into irregular or concave shapes. Choose Visual Proof, then tap pairs of non-adjacent vertices to draw cuts. Dragging vertices is supported even in cutting mode; Move vertices makes the intention explicit. Hint highlights one valid next diagonal; Auto-complete is available for teacher demonstrations.

The model validates simple polygons, interior diagonals, crossings and complete triangulation. The reversible lever extracts and rotates each triangle's corners into a separate half-turn. The completed result gives n−2 contributions; the general formula appears only after completion and when requested. Valid cuts survive vertex edits; invalidated cuts are cleared with feedback. Vertex selection and arrow buttons offer keyboard-accessible geometry editing; the lever supports arrow keys, Home and End.

## Architecture and files changed
New reusable modules:
- dist/math-input.js — numeric field adapter, keypad and validation.
- dist/interaction.js — temporary creation state and scoped gesture ownership.
- dist/angle-renderer.js — shared right-angle/arc rendering.
- dist/polygon-proof.js — polygon validation, face splitting, triangulation and angle-piece interpolation.
- dist/proof-ui.js — exploratory proof interface and continuous lever.
- dist/touch.css — scoped interaction and responsive proof styling.

Integrated changes:
- dist/app.js — numeric properties, temporary selection, touch ownership, header history.
- dist/annotations.js — shared marker rendering.
- dist/angle-ui.js — proof library entry, camera gestures, numeric quiz input.
- dist/calculator-ui.js — non-editable display and physical keyboard handling.
- dist/calculator-panel.js — refreshed module dependency.
- dist/index.html and dist/styles.css — header Undo/Redo, new styles and cache versions.
- tests/touch-proof.test.mjs — new behavioural and geometric regression tests.

Saved notebook geometry retains the existing schema. Transient input, gesture and creation states are not serialized.

## Verification
33 automated tests pass. These include existing quiz, calculator, geometry, persistence/Undo and eraser tests plus keypad validation, temporary tool state, right-angle geometry, mixed touch ownership, convex and concave triangulation in both winding directions, area conservation, exact half-turn alignment, invalid polygons and invalid cuts. Polygon coverage includes 3–20 sides and an obtuse triangle.

Browser interaction checks completed:
- Custom numeric keypad changes and confirms polygon side count; physical numeric keys also work.
- Scientific physical-key calculation 5+6 returns 11.
- Natural keypad fraction 1/2 returns 0.5; no calculator input/textarea/contenteditable fields exist.
- Rectangle creation → vertex edit → immediate second rectangle works.
- Circle, Line and Square each create a second shape without toolbar reselection.
- Explicit Select prevents creation; Undo restores the original object count.
- Manual quadrilateral diagonal produces two half-turns and 360°.
- Pentagon teacher triangulation produces three half-turns and 540°, remains valid after a vertex nudge.
- Lever mouse dragging follows intermediate progress; reversing hides the summary.
- Straight-line handle dragging updates the revealed equation live.
- Quiz answer opens the custom keypad; the relationship remains hidden.
- Desktop and 390px phone layouts inspected. No runtime errors observed during these checks.

## Known limitations
Physical iPad/iPhone/Android devices were not available in this session. Native keyboard suppression, stylus palm behaviour and genuine multi-finger pinch require the device checklist below; viewport resizing is not a substitute for those tests. The proof generator currently exposes 3–20 sides for legibility; the geometry engine is general. Proof activity state is temporary and resets when leaving the activity, like the exploration session; it is not saved into the main notebook. Freehand polygon drawing is not included: start with a generated polygon and move its vertices.

## How to test on desktop
1. Create a rectangle, edit a corner and its properties, then drag empty canvas. Repeat with Circle, Line and Square. Verify manual Select stops continuation and Undo removes only real edits.
2. Open a numeric geometry property, enter a value using the keypad or physical keys, confirm, and test an out-of-range value.
3. Open the toolbar calculator; test 5+6, sin(30) in DEG, and a natural 1/2 fraction. Toggle the toolbar button to close it.
4. In angle exploration, add rays, drag them to and away from 90°, and show/hide the relationship. Test again after pan and zoom.
5. In Visual Proof, try 3, 4, 5 and 6 sides. Draw cuts manually, try a crossing cut, use Undo/Hint, and scrub both directions. Move a vertex at full progress. Create a concave polygon and triangulate it. Cross the outside edges and verify a friendly error disables the proof.
6. Switch EN/BM and light/dark modes. Text Tool editing should still permit caret selection and copy/paste.

## How to test on iPad/mobile
1. Tap an angle, length or quiz numeric field: only the app keypad should appear, with no viewport resize. Confirm a value. Then open Text Tool: the native text keyboard should work normally.
2. Open the calculator, tap its display and enter a calculation using its buttons. No OS keyboard or page shift should occur. Repeat with a hardware keyboard if available.
3. Draw, drag vertices, move shapes and operate the ruler. No blue browser text selection or native image drag should appear.
4. Start two fingers inside the canvas: only the drawing zooms and the midpoint stays anchored. Continue with a finger outside the boundary. Start one finger on a panel and one on canvas: canvas pinch must not start. Check ordinary browser accessibility gestures outside the canvas remain available.
5. Repeat create → edit → empty-canvas drag with touch drawing enabled. Verify Manual Select still overrides continuation.
6. Use the proof lever and vertex handles on a real touchscreen in portrait and landscape. Large polygons may require scrolling the proof activity.
