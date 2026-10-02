# Statistics in Maths Workspace

Open **Explore → Statistics → Ungrouped data**. This teaching workspace shares the existing EN/BM language and light/dark theme. It runs locally without a backend or build step. Grouped data and stem-and-leaf are deliberately marked as future work.

**Statistical representations are views of information, not separate topics. When the representation preserves the observations, learners should be able to move both forward and backward between the representation and the underlying dataset.**

## Run and check

From the repository root:

```sh
python3 -m http.server 5177 --directory dist
npm test
node --test tests/statistics.test.mjs
```

The source is the shipped ES-module code in this directory; the existing workspace does not use a compilation pipeline. Browser checks are performed through the app's browser automation tools against localhost. Nothing loads a remote maths service or uploads datasets.

## Teacher controls

- Mean opens with 2–8 simple random number tiles, with no bars until Show bars / Next. Sort, More Questions and Module Questions remain visible. Module Questions opens verified BIJAK presets and custom data. Numerical entry uses an in-app keypad; a physical keyboard also works. Custom data accepts 2–24 non-negative values up to 100, with at most two decimal places.
- On screens at least 760 px wide, Mean uses a right-hand lesson panel. Question buttons and playback remain visible while editing options scroll independently. Existing control elements are moved without replacing their handlers; narrower screens restore the compact stacked layout.
- Number tiles and unit squares grow to use the available diagram height, with a column-width limit to prevent overlap. Comparison datasets keep the same square scale and waiting blocks retain fixed positions.
- Mean: drag a block, or select one and use Move for a keyboard-accessible alternative. Split exchanges a denomination for ten smaller pieces; Regroup reverses it. Total quantity is conserved. Next first turns the number tiles into bars of rounded unit squares. Values such as 11–13 stay as ones, with no automatic tens. Next lifts the blocks into waiting positions above their columns, then distributes one whole layer per step. Waiting blocks retain their positions instead of filling gaps. Remainder, combination, fraction splitting, distribution and formalisation are separate steps. Auto pauses at conceptual boundaries.
- Median: Step/Auto demonstrates selection sort, including every inspection and new minimum. Move the locator in half-tile increments with the arrow buttons or left/right keys. Check pulses/counts each side; incorrect positions show unequal counts. Two middle values enter the same equal-sharing engine used by Mean. Continue to Q1 and Q3 reuses the locator and counting procedure.
- Mode counts individual observations into vertical stacks, then morphs their tiles to dots and a frequency table. Reveal is a separate final action. Tied modes and no unique mode are supported.
- Representations routes transformations through grouped observations. Show Data from dots or frequencies first expands the observations into numbered stacks; Next moves them into the raw list. The original representation is retained in Original/Split. Statistical concept buttons become available after reconstruction for graph-first questions.
- Change data adds or multiplies every input value by a teacher-chosen amount using the shared math keypad. It resets sharing to the bars (or keeps number tiles if they have not been revealed), preserves the question’s original data, and supports Undo. Results must stay within 0–100 and at most two decimal places.
- Another dataset puts the existing dataset on the left and a new set of number tiles on the right. Select either dataset to sort, edit, step or undo independently; Swap sides rearranges the pair and Keep selected dataset returns to one view. Both datasets use the same unit-square scale. Two datasets are supported in this release.
- Original / Current / Split applies to every concept. Mean’s Original view retains the question’s number tiles. Dense datasets may require horizontal scrolling to keep values readable, particularly on phones.
- Present reduces chrome and enlarges labels. Enter advances, Space plays/pauses, R resets, and Ctrl/Cmd+Z undoes while the diagram has focus. Editable controls retain their own keyboard behaviour. Slow/Normal/Fast and reduced-motion preferences are supported.

## Mathematical model

`math.js` reuses the workspace's exact JSON-safe rational arithmetic from `bar-model/domain.js`. It owns parsing, mean, median, frequency/mode, quartile partitions, selection-sort steps and midpoint diagnostics. No calculation derives from SVG coordinates.

`model.js` owns an immutable original dataset, a separate current input dataset, stable observation IDs, sorted data, current concept state and bounded undo snapshots. Current input data and the latest add/multiply operation are included in undo snapshots. Each comparison dataset has its own workspace instance; the UI only routes controls to the selected instance. Reset reinitialises the current concept for the same question. Restore original returns to that question's starting presentation. Loading a question replaces the original dataset and clears the previous question's history. Current session data is serializable but is not yet automatically persisted or shared.

Mean states: tiles → original/manual → pooled → whole-layer distribution → remainder → combined → split → complete → formalised. Pieces store an exact rational quantity, an owner (column or pool), and stable waiting-column/slot coordinates. Sorting changes column order without changing observation values. Pool slots are allocated on lift and are never compacted during distribution. Split children retain their parent ID for animation. Drag previews may temporarily hold a quantity; committing a drop creates one undo operation, and cancelling restores its pre-drag state. Manual redistribution restarts the equal-sharing story at Gather so uneven intermediate states cannot corrupt the automatic sequence.

Median states: selection-sort steps → locating → counting → odd result, or even-value sharing → result → lower-half locating → upper-half locating. Stable extraction of each smallest candidate preserves equal-valued observation IDs. Quartiles use **the median of each half, excluding the middle observation for odd n**, matching the module's Q12–14 answer scheme (70/78.5/88; 46/51/56; 15/21.5/27).

`representations.js` declares recoverability. Lossless raw, sorted, grouped, dot and ungrouped-frequency representations retain stable observation IDs. External frequency/dot counts can reconstruct an exact multiset, but do not claim to recover the original ordering. Box plots, grouped frequencies, histograms, frequency polygons, ogives and equal-share summaries cannot produce invented exact observations. Deferred representations have metadata but do not claim to be implemented.

## Module provenance and generation

`questions.js` transcribes the user's **BIJAK SPM PPDMT 2026 Sukatan Serakan Modul dan Skema v2.1**. It stores question number, printed page, actual starting representation and generator profile. Q6 dot counts were checked visually against the PDF; Q19 starts as its actual ungrouped frequency table. Q12 remains disabled pending stem-and-leaf, rather than being misrepresented as a raw-data question. `MODULE_FORMS` records the exam forms of the other relevant deferred questions. The full PDF is not copied into the public app.

Quick practice uses a seeded generator with 2–8 integer observations (values 3–13); More Questions changes the observation count on each press, generates another simple dataset and starts again with tiles. For module/custom questions, More Questions uses seeded positive translations and shuffling of the module patterns. This preserves observation count, repetition pattern, range width, relative outlier behaviour, clean integer/fractional mean type and starting representation. Each result is parsed, solved and validated. At the full 0–100 bounds, a reflected/shuffled pattern is used if no nonzero shift fits; all quantities remain valid. Generated drills are visibly marked as generated, never as original module questions. This first generator deliberately stays close to the source question structure.

## Rendering and extension

`scene.js` builds mathematical scenes and updates keyed SVG nodes. The same observation node survives raw → grouped → dot/table → raw. Position and rectangle-shape transitions are visual state only; resizing or changing speed does not change the data. `ui.js` owns controls, timers and pointer capture; its disposer cancels animation and listeners when leaving Explore. `style.css` is scoped to Statistics.

To add a representation: declare its recoverability/capabilities, add an encode/recover adapter only if the information is actually lossless, add a route through the common transformation engine and a scene using the existing observation IDs, then add round-trip/identity tests. Do not expose exact reconstruction for a summary-only graphic.

To add a generator profile: record the intended properties, generate reproducibly, validate all constraints and calculated results, preserve the question's starting form and add many-seed tests. Keep any development fixtures separate from verified module presets.

## First milestone boundaries

No grouped-data calculations, variance/standard deviation, box plot, stem-and-leaf renderer, accounts, cloud storage or PWA installation is implemented yet. Negative observations are outside the current positive-quantity block model and are rejected with a clear input message. Dataset bounds keep manipulation and projected labels manageable. Viewport checks do not replace an actual projector rehearsal or physical stylus/multitouch testing.

## Verification for this release

- 118 automated tests pass (100 existing regressions and 18 Statistics tests). New tests cover seeded simple questions, tiles before bars, unit-only bars for 11–13, fixed waiting positions through distribution, exact add/multiply and undo, rejection without mutation, sorting and independent datasets, all question sizes from 2–8, avoiding repeated consecutive counts, and larger squares fitting narrow/tall diagrams without overlapping the waiting blocks. Existing tests cover conservation, manual transfers, fractions, large/zero/decimal datasets, median/quartiles/mode and lossless representation recovery.
- Browser checks cover tiles → bars → lift → share → combine/split → reveal, Auto pauses, fixed waiting positions, drag and undo, keypad arithmetic changes, independent comparison controls, side swaps, keyboard stepping on the second dataset, fresh questions and graph-first module recovery.
- Layouts are checked at laptop, phone and portrait-tablet sizes in EN/light and BM/dark. Browser error logs are checked before release. The earlier milestone also checked the existing angle/transformation explorations and wide/projector layouts.
- Variance is deliberately deferred until the simpler Mean lesson has been tested by the teacher. The next lesson will build from the mean line; this update does not implement variance or label absolute deviation as variance.
- Browser viewport checks do not claim physical iPad, stylus, multitouch or auditorium testing. Teaching state lasts for the open exploration session; large datasets may need scrolling and very small unit squares do not show a numeral inside each square.
