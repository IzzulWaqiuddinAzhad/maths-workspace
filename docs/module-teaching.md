# Module teaching: translation 1–4, reflection 5–8 and rotation 9–16

Open `module.html?question=1`, or Explore → Transformations → Module teaching · Translation 1–4. This separate full-page teaching view preserves the existing free exploration.

## Source and scope

Questions 1–4 come from BIJAK SPM PPDMT 2026 Transformasi Bengkel v4.2, printed page 1 (PDF page 2), section A1. The coordinates, translation vectors, grid −8…8 and EN/BM prompts follow the booklet. Answers agree with the matching v4.2 scheme. The source PDFs are not shipped with the app.

| Question | Given point | Translation vector | Required point |
| --- | --- | --- | --- |
| 1 | A(−4, 3) | (6, −2) | A′(2, 1) |
| 2 | B(3, −2) | (−5, 6) | B′(−2, 4) |
| 3 | C′(5, 4) | (3, −2) | C(2, 6) |
| 4 | D′(−3, −4) | (−4, 3) | D(1, −7) |

Numbered buttons, the Next question action and direct `?question=1` through `?question=4` links select a question. Browser Back/Forward is supported. Switching questions starts an unrevealed walkthrough; annotations and their Undo/Redo histories remain separate for each question during the current page session.

## Teaching flow

The given point stays fixed. Start teaching reveals its coordinates; subsequent steps demonstrate horizontal and vertical movement before a separate answer reveal. Questions 3 and 4 explicitly use the inverse vector to recover the original point. Original points remain black (light in dark mode), and images remain blue, including inverse questions.

The movement slider provides reversible, continuous teacher control. It demonstrates the two vector components of one translation. Scrubbing hides the answer, and completing an unfinished movement does not skip the answer-reveal step.

The final reveal shows the original point → image on the graph, with the question's translation column vector above the arrow. For inverse questions, this final mapping still uses the forward vector: C(2, 6) → C′(5, 4) under (3, −2), and D(1, −7) → D′(−3, −4) under (−4, 3). The mapping adapts to the available space and pan/zoom, avoids point labels and controls, and hides again on back-step, scrub or reset. It does not intercept canvas gestures.

## Interaction and architecture

The question card collapses to enlarge the graph. Fit restores the printed grid. Pan, anchored wheel/pinch zoom, pen, whole-stroke eraser and ink Undo/Redo reuse the workspace geometry, renderer, annotation utilities, DocumentStore and gesture ownership. Reset clears only the current question's ink as an undoable operation. Teacher progress and camera movements do not create document edits. Language/theme preferences are shared; lesson ink is session-only and never overwrites notebook or exploration documents.

`module-lesson.js` stores the immutable question bank and computes forward/inverse lesson geometry. `module-ui.js` renders the shared teaching flow and mapping. The existing transformation renderer retains its normal defaults; module teaching supplies printed grid bounds, larger point labels and explicit object/image roles.

## Checks and limitations

Run `npm test`. In a browser, check all four direct links, question navigation and browser Back; verify hidden answers, every teaching step, forward final mappings, reverse/scrub/reset, separate annotation histories, pan/zoom, EN/BM and light/dark. Inspect desktop, tablet and phone layouts, collapsed questions and fullscreen.

Translation Questions 1–4, Reflection Questions 5–8 and Rotation Questions 9–16 are included. Physical stylus and multi-touch behaviour still needs actual-device testing. Enlargement, combined transformations and area demonstrations remain future module work.

## Reflection questions 5–8

Open `module.html?question=5`, use the module activity selector, or Explore → Transformations → Module teaching · Reflection 5–8. These questions come from printed page 2 (PDF page 3), A2, of the same v4.2 booklet:

| Question | Given | Mirror line | Required answer |
| --- | --- | --- | --- |
| 5 | A(−3, 4) | x = 1 | A′(5, 4) |
| 6 | B(4, 3) | y = −2 | B′(4, −7) |
| 7 | C′(5, −2) | y = x | C(−2, 5) |
| 8 | D′(−4, 2) | y = −x | D(−2, 4) |

Every reflection question starts with no trial line selected. The teacher asks whether the given equation describes a horizontal, vertical or slanted line. Any suggestion may be tried. The original question and its equation stay separate from the trial equation.

- Horizontal lines show `y = k`, a dot at the y-axis crossing and a brief pulse around the changed axis value. Up/down buttons move one unit. Dragging the line in Move mode snaps to integer y values.
- Vertical lines provide the equivalent `x = k` behaviour on the x-axis, with left/right buttons. Both use the existing pointer capture and graph coordinate conversion, including after pan and zoom. Positions are bounded to −8…8.
- Slanted lines offer `y = x` and `y = −x`; arbitrary slope/intercept editing is outside this release.
- Changing the line resets the moving copy and hides the answer. The teacher can keep the perpendicular guide visible while comparing lines.
- The independent reflection slider uses the existing book-flip geometry. It follows the user's movement, then completes toward the last deliberate direction on release. Keyboard arrows, Home and End control the same range. No editable field or software keyboard is needed.
- Guide mode shows the perpendicular and a rotating square right-angle marker. Matching equal-distance ticks appear only at the completed reflection, never during unequal intermediate positions. A point on the mirror remains fixed.
- Wrong suggestions can be reflected and discussed, but never populate the module answer. Reveal becomes available only after the trial line matches the question and reflection is complete. Returning the slider or changing the line hides the reveal.
- Questions 7–8 start from the given image and recover the object. The final graph mapping still reads object → image under the stated reflection line.

The activity selector switches between Translation 1–4 and Reflection 5–8. Next question proceeds in module order. Question navigation resets the teaching state while keeping separate session ink histories. Trial results outside the original grid get an expanded view when needed; the initial question preserves the original grid. On phones, a minimum canvas height keeps labels readable; the question and lesson area can scroll vertically, or the question can collapse for more diagram space.

### Implementation and verification

`PointLesson` shares object/image identity between translation and reflection. `ReflectionLesson` owns trial line, guide, progress and reveal validity. The mathematical reflection and flip calculations reuse `transform-model.js`. `module-reflection-render.js` uses the shared right-angle marker and returns geometry obstacles to the existing renderer so point labels avoid the mirror and guides. Pointer handling, annotation history, pan/zoom and final mapping remain in the shared module UI.

The reflection tests check all four independent scheme answers, wrong-line reveal guards, reset/scrub behaviour, equal perpendicular distances, stationary points, diagonal clipping, grid expansion and pan/zoom coordinate invariants. Browser checks cover trial switching, arrow nudges, line dragging after zoom/pan, lever reversal, both diagonals, EN/BM, dark/light, translation regression and phone/tablet/desktop layouts. Physical multi-touch and stylus hardware still require device testing.


## Rotation questions 9–16

Open `module.html?question=9`, choose Rotation in the module selector, or use Explore → Transformations → Module teaching · Rotation 9–16. Source: A3–A4, printed pages 3–4 (PDF pages 4–5) of the same question booklet. Starting points were read from the diagrams; calculated answers were checked against the scheme.

| Question | Given | Centre | Rotation | Answer |
| --- | --- | --- | --- | --- |
| 9 | A(3, 2) | (0, 0) | 90° clockwise | A′(2, −3) |
| 10 | B(−2, 5) | (−3, 2) | 90° anticlockwise | B′(−6, 3) |
| 11 | C(5, 4) | (2, 1) | 90° clockwise | C′(5, −2) |
| 12 | D(−4, −1) | (−1, −2) | 90° anticlockwise | D′(−2, −5) |
| 13 | E(5, −2) | (2, −3) | 180° | E′(−1, −4) |
| 14 | F(−2, 6) | (2, 3) | 180° | F′(6, 0) |
| 15 | G(5, −1) | (1, 2) | 90° clockwise | G′(−2, −2) |
| 16 | H(−5, 3) | (0, −1) | 90° anticlockwise | H′(−4, −6) |

The construction has no method name in the UI. Teacher-paced steps mark the centre, draw the first horizontal arm, copy three quarter-turned arms, bend to the given point, then copy the other three bends. Signed offsets are measured from the actual centre; leftward and downward first paths work without a quadrant-specific shortcut. The original construction stays visible while the blue copy turns. A reversible slider controls the stated turn, and a separate reveal shows the coordinates and the final mapping on the graph. Half-turn questions explicitly explain that either direction reaches the same endpoint.

After the construction is complete, the optional Clock guide toggle shows an analogue clock exactly at the rotation centre. It starts off and its hands always move clockwise, independently of the question direction or movement slider. The clock follows pan/zoom while keeping a readable screen size. It does not change answers, progress, objects or Undo history. Going back before the completed construction, Reset or changing question switches it off. Hidden tabs do not continuously redraw the clock. Reduced-motion preferences show a stationary clock and a textual 12 → 3 → 6 → 9 direction guide instead.

`RotationLesson` extends the existing shared point lesson. `module-rotation-render.js` paints the construction and clock through the shared renderer's geometry overlay and returns label obstacles. No new pointer handler or editable input is introduced. The original camera, annotations, question navigation, EN/BM, theme, mapping and Undo/Redo remain shared.

Tests cover all eight independent answers, the rigid lengths and right angles of every copy, centre-relative construction, bounded rotation paths, reveal/scrub/back/reset behaviour and a clockwise screen-coordinate clock that cannot mutate lesson state. Browser checks include the eight complete walkthroughs, clock toggling, reverse scrubbing, 180° turns, off-origin centres, translation/reflection regressions, desktop, phone and tablet layouts. Physical iPad/stylus/multi-touch testing remains a device check.
