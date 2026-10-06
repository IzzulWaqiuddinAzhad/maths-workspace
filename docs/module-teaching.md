# Module teaching: transformations 1–24

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

Translation Questions 1–4, Reflection Questions 5–8, Rotation Questions 9–16 Enlargement Questions 17–20 and Combined Questions 21–24 are included. Physical stylus and multi-touch behaviour still needs actual-device testing. Polygon Questions 25–44 and area demonstrations remain future module work.

## Reflection questions 5–8

Open `module.html?question=5`, use the module activity selector, or Explore → Transformations → Module teaching · Reflection 5–8. These questions come from printed page 2 (PDF page 3), A2, of the same v4.2 booklet:

| Question | Given | Mirror line | Required answer |
| --- | --- | --- | --- |
| 5 | A(−3, 4) | x = 1 | A′(5, 4) |
| 6 | B(4, 3) | y = −2 | B′(4, −7) |
| 7 | C′(5, −2) | y = x | C(−2, 5) |
| 8 | D′(−4, 2) | y = −x | D(−2, 4) |

Every reflection question starts with no trial line selected. The teacher asks whether the given equation describes a horizontal, vertical or slanted line. Any suggestion may be tried. The original question and its equation stay separate from the trial equation.

- Horizontal lines show `y = k`, a dot at the y-axis crossing and a brief pulse around the changed axis value. Up/down on the shared game pad move one unit per tap (hold to repeat). Horizontal and vertical trial lines start at a visible non-zero position in the current camera view.
- Vertical lines provide the equivalent `x = k` behaviour on the x-axis, with left/right buttons. Both use existing pointer capture and graph coordinate conversion, including after pan and zoom. The centre pad button resets the trial line to a visible position.
- Slanted lines support all four pad directions. Dragging the line moves its two pivots together without changing direction; dragging either circle rotates about the other, snapping the moved pivot to the grid. Coincident pivots are rejected. The equation updates live, including horizontal/vertical transitions and fractional coefficients. `y = x` and `y = −x` remain quick presets. The infinite mirror is clipped to the viewport, independently of the printed grid.
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

The construction has no method name in the UI. Mark the centre, then count either horizontally first or vertically first. The first game-pad movement chooses the order; explicit order buttons also let the teacher restart with the alternate construction. Each L is built as two counted segments before moving to the next quarter-turn. Matching first segments are orange and second segments blue, with square ticks and live counts. Both counting orders reach exactly the same four endpoints.

Tap an arrow for one square, hold to repeat, or use Next / Auto current segment for unit-by-unit movement. Once the first segment is correct, a perpendicular pad movement can begin its bend immediately. Next proceeds to the following segment automatically. Wrong counts can be corrected freely; the centre button clears only the current segment, and Previous removes the latest segment. Later segments and answer reveal remain gated by correct earlier lengths. Signed offsets come from the actual centre. Original copies stay visible while the blue copy rotates. Switching the counting order restarts the construction and hides any previous reveal.

After construction, the slider gives full control from 360° clockwise through 0° to 360° anticlockwise. It follows the pointer and stays where released. The shared quarter-turn snapping has a 10° capture range and 18° release range, so 0°, 90°, 180°, 270° and 360° are easy to hold without preventing other angles. Direction buttons preserve the current magnitude; angle shortcuts use the selected direction. Hardware arrows adjust exactly 1°, Page Up/Down adjust 90°, Home returns to zero and End completes a full turn in the selected direction. No software keyboard is required.

The live caption shows the selected angle and its equivalent opposite-direction turn (for example, 270° anticlockwise has the same endpoint as 90° clockwise). A full turn returns to the original position without duplicating the point label. The question's required operation remains visible above the canvas. Trial turns hide the answer; Show question’s turn resets the copy and demonstrates the required rotation before a separate Reveal answer action. Half-turn questions accept either direction. Other equivalent endpoints do not reveal an answer under a different operation. Changing the rotation after a reveal hides the coordinates and final mapping again.

After the construction is complete, the optional Clock guide toggle shows an analogue clock exactly at the rotation centre. It starts off and its hands always move clockwise, independently of the question direction or movement slider. The clock follows pan/zoom while keeping a readable screen size. It does not change answers, progress, objects or Undo history. Going back before the completed construction, Reset or changing question switches it off. Hidden tabs do not continuously redraw the clock. Reduced-motion preferences show a stationary clock and a textual 12 → 3 → 6 → 9 direction guide instead.

`RotationLesson` extends the existing shared point lesson and stores rotation progress in signed degrees. `module-rotation-render.js` paints the construction and clock through the shared renderer's geometry overlay and returns label obstacles. The shared movement control uses pointer capture and the existing `RotationSnap` model; cancellation restores the starting angle. Fixed action widths prevent changing button captions from moving the slider during a drag. The original camera, annotations, question navigation, EN/BM, theme, mapping and Undo/Redo remain shared.

Tests cover all eight independent answers, the rigid lengths and right angles of every copy, centre-relative construction, both full turns, arbitrary trial angles, equivalent endpoints, snapping hysteresis, reveal guards, back/reset behaviour and a clockwise screen-coordinate clock that cannot mutate lesson state. Browser checks include real slider drags through every snap point in both directions, exact keyboard adjustments, return-to-question/reveal, clock toggling, translation/reflection regressions, and desktop, 390px phone and 820px tablet layouts. Physical iPad/stylus/multi-touch testing remains a device check.


## Enlargement questions 17–20

Open `module.html?question=17`, choose Enlargement in the activity selector, or use Explore → Transformations → Module teaching · Enlargement 17–20. The source is A5, printed page 5 (PDF page 6) of the v4.2 booklet. The diagram gives A(3, 2); centre (1, −1), scale factor 2. The image A′(5, 5) was independently calculated and checked against the scheme. The booklet uses points in Questions 17–20 and polygons in Questions 41–44 (B5, printed page 11). All four point lessons use the same staged construction and free scale control.

1. Mark the stated centre, rather than defaulting to the origin.
2. Draw the straight guide through the centre and given point.
3. Count the given horizontal distance one square at a time, then stop.
4. Next counts the given vertical distance separately. The orange construction remains visible.
5. Next counts the image's horizontal distance from the same centre (4 right in Q17), stopping at each square.
6. Next counts the image's vertical distance (6 up in Q17). A hollow blue endpoint remains unlabelled until both distances match; merely reaching the guide at a different scale does not validate it.
7. Reveal adds the final coordinate mapping. Changing either count hides the answer and mapping immediately.

After step 4, a cross-shaped game pad replaces the −1/+1 buttons. Left/right adjusts the horizontal count and up/down the vertical count, one square per tap. Holding an arrow repeats; release, pointer cancellation, focus loss or leaving the lesson stops repetition. Each tap updates immediately, so rapid taps are not lost. The centre 0 button clears the blue path, preserving the orange measurement. Both live direction counts remain beside the pad. Select Horizontal or Vertical to choose the component for Auto; Auto demonstrates only that component's required count. Next follows horizontal → vertical and returns to any component still incorrect. Clear blue path preserves the original orange measurement. Back removes the last construction step; Reset removes both. Counts use the question's direction, including downward movement in Q18 and the reciprocal return in Q20. Manual components are bounded to ±100 units.

Explore scale factor retains the previous slider from −3 to 3, with its shortcuts, snapping and keyboard support. Back to counting restores the teacher's independent component counts. Free scale is optional and does not overwrite those counts. Source/image coordinates, final mappings and reveal validity remain determined by the question model.

`EnlargementLesson` retains source coordinates, computes centre-relative scaling and controls reveal eligibility separately from the trial factor. The rotation range handler is shared with enlargement, including pointer capture, cancellation and the stable slider layout. Bounds expand once when free scale control is selected to include the entire scale range; dragging does not continually refit the camera. Pan, zoom, annotation Undo/Redo, EN/BM, theme and question navigation remain shared. The enlargement overlay uses the existing `LabelLayout` to keep distance labels apart. The shared point renderer accepts optional wider label candidates for crowded diagrams while retaining its previous defaults.

Checks include exact source/answer data, positive/fractional/negative/zero factors, fixed-centre and collinearity properties, reveal protection, stable bounds, snapping and non-mutating rendering. Browser testing covers real pointer drags, keyboard entry, staged reveal/backtracking/reset, annotations, existing activities and desktop/phone/tablet layouts. An actual iPad/stylus remains a device check. Polygon lessons are not yet activated.

### Shared enlargement layout and inverse question

| Question | Given | Centre | Stated factor | Required answer |
| --- | --- | --- | --- | --- |
| 17 | A(3, 2) | (1, −1) | 2 | A′(5, 5) |
| 18 | B(−1, 1) | (−2, 2) | 3 | B′(1, −1) |
| 19 | C(6, 2) | (2, −2) | ½ | C′(4, 0) |
| 20 | D′(5, 5) | (−1, 1) | 2 | D(2, 3) |

Q20 starts from the given image. Its slider explicitly measures the return scale from that image; the required return factor is ½. The staged action demonstrates the reciprocal, and factor 2 is not accepted as the return operation. The final mapping still shows D(2, 3) → D′(5, 5) under the stated enlargement factor 2. Object/image colours and the original question stay correct throughout.

All four share bold, viewport-spanning guides, 24px bold component counts (22px on narrow screens), vertical counts outside their own legs and lower image captions. Label avoidance reserves the actual larger text rectangles and axis numerals; the renderer keeps its original defaults for other activities. Image captions use width-aware candidates below the point, including the given image in Q20. The centre in Q19 is named Centre/Pusat to distinguish it from point C. Zoomed-out enlargement views reduce axis-number density to keep numbers readable.

The regression checks cover all four source diagrams/answers, inverse recovery and reveal gating, image captions below their points, larger count labels and overlap checks on desktop and phone-size canvases.

### Step-by-step counting verification

The count model owns independent given/image x/y distances and the selected component. `squareCountAt` advances one unit, pauses at that square, then continues; reduced-motion preferences apply the chosen component immediately. Only one component animates at a time. Reset/question navigation cancels the animation. During automatic counting the game pad and other count controls are disabled to prevent overlapping actions, while Reset remains available. Manual pad steps update immediately and use the same shared hold/cancellation helper and pad styling as the transformation explorer. Original and image paths reuse the existing enlargement overlay and world-coordinate camera.

Regression checks cover all four staged constructions, no vertical path during a horizontal step, preserved original paths, wrong-scale collinear trials, live reveal invalidation, independent count restoration after free scale, and positive/negative/fractional animation endpoints. Browser verification covers Q17–20, manual corrections, reset during movement, backtracking, pan/zoom, EN/BM, light/dark and phone/tablet layouts. Physical iPad input remains a device check.

## Combined transformations 21–24

A6, printed page 6 (PDF page 7), completes the coordinate section. Open `module.html?question=21`, choose Combined 21–24, or use the new Explore library entry. Original diagrams and both intermediate/final coordinates were checked against the question booklet and answer scheme.

| Question | Original | First operation | Intermediate | Second operation | Final |
| --- | --- | --- | --- | --- | --- |
| 21 · TP | P(−3, 2) | P: reflection in y = 1 | P′(−3, 0) | T: translation (4, −1) | P″(1, −1) |
| 22 · RT | Q(4, 3) | T: translation (−2, 1) | Q′(2, 4) | R: 90° clockwise about (1, 1) | Q″(4, 0) |
| 23 · RP | R(−2, 4) | P: reflection in y = −x | R′(−4, 2) | R: 90° anticlockwise about (2, −1) | R″(−1, −7) |
| 24 · K² | S(−5, 5) | K: translation (3, −2) | S′(−2, 3) | K: translation (3, −2) | S″(1, 1) |

Begin with the question only. The first Next draws two arrows, connecting the original coordinate to an unknown intermediate point and an unknown final point. The next click moves the actual composition letters onto their arrows: the right-hand letter lands on the first arrow, followed by the left-hand letter on the second. Transformation descriptions appear above each arrow. K² expands to KK and follows the same two-step presentation. A separate Next begins the first lesson; no teaching stage advances automatically.

Each operation uses its existing teacher-controlled lesson: trial mirror lines and flip, component translation, or counted rotation construction with both counting orders, clock and free angles. The first result must be explicitly revealed before the second operation is available. Its coordinate animates into the middle of the overview while the final coordinate stays unknown. The final reveal fills the last coordinate. Wrong reflection lines or rotation angles cannot unlock the next step.

The original point remains black/light; the intermediate image is orange; the final image is blue. During the second step, the intermediate point becomes the new object while the original stays visible. The question card reserves its answer for the final point. The complete overview stays visible throughout: initially enlarged over the graph, then compactly above it during teaching. On narrow screens the chain runs vertically, with transformation descriptions beside the downward arrows. The introduction replaces the graph temporarily so its controls remain close; each explicit coordinate reveal brings the overview into view before animating. The graph uses its own camera; manual pan/zoom remain available. A stable initial camera includes the original, both images and the rotation sweep without revealing their labels early.

First/Then controls revisit the operations. Reviewing a completed step preserves both revealed coordinates, but changing the first operation clears the second lesson and both results from the overview. Back from the start of the second lesson returns to the first; back from the first lesson returns to the introduction. Reset restarts the whole question, using the existing undoable ink reset. Navigation and browser history keep annotation histories separate per module question. Reset, navigation and leaving the page cancel pending overview animations. Reduced-motion settings keep the same teacher-paced stages without movement.

`CombinedLesson` composes two existing lesson instances instead of duplicating geometry, drag handlers or transformation engines. Its question data explicitly stores execution order; labels use one prime for the intermediate point and a double prime for the final point. Its `overviewPoints` projection contains only revealed coordinates. `module-sequence-view.js` renders and animates that projection using stable DOM nodes, without a separate answer engine. Next and step navigation wait for an animation to finish; Reset remains available. The shared renderer retains previous colours for all other callers. No worksheet PDFs are changed.

Verification of this overview revision: all 174 automated checks pass, including nine combined-lesson checks for source answers, staged introduction, independent coordinate reveals, invalidation, camera bounds and colour roles. Browser checks completed all four questions through both transformations, visibly checked arrow drawing and letter movement, reset during introduction, and first-step review/edit invalidation. Question 22 retained the vertical-first rotation construction. The overview was inspected in EN/BM and light/dark themes, at desktop width and a 500 CSS-pixel-wide window; Question 24 verified both coordinate reveals stay in view at the narrow width. Earlier regression checks covered annotation history and the Explore entry. Physical iPad/stylus testing and narrower phone sizes remain actual-device checks.
