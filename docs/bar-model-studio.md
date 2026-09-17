# Bar Model Studio

Open **Explore → Bar model → Bar Model Studio**. This is a separate Exploration library section; existing angle explorations and workspace documents remain available.

## Implemented

- Build, Solve, Explore and Create tabs, in English and Bahasa Melayu.
- Twelve shared-model families: part–whole, additive comparison, change, transfer, equal groups, multiplicative comparison, fractions, percentages, ratio, rates, average and linear algebra.
- Deterministic seeded generation, Malaysian contexts and exact rational solving. Money uses integer sen. Generated answers are independently checked against the relationship equations.
- Generated questions, reusable numerical examples, positive linear equation entry and a free bar builder. Free models retain their own mode when saved/reopened. Guided solutions require a generated problem or explicit equation.
- Drawing, temporary edit selection, repeated drawing, labels, values, colours, unknowns, equal partitioning, cloning, braces, transfer, freezing, annotations, pan/zoom, undo/redo and local saves. JSON export/import uses a separate versioned studio document.
- Reversible solution steps, playback, scrubbing, speed and reduced-motion support. Transfer keeps the piece identity and width; averaging redistributes excess pieces; algebra removes matching terms on both sides.
- Student relationship construction is checked through equivalent systems of equations, not drawing position. Hints, visual model choices and exact numeric/fraction answers are available. Students must attempt a problem before solution playback is enabled.
- Eight invariant explorations. Rates also support a ratio table and double number line from the same data.
- All five worksheet tiers default to **two questions plus a worked example**. One selected tier creates one student page; the teacher edition appends one answer page per tier. The spacious setting permits one question. Tier 1 provides a model, Tier 2 omits brace labels, and Tiers 3–5 leave construction to the learner.
- Individual question/example value editing, targeted regeneration, ordering within tiers, and reusable JSON question banks. Every accepted edit rebuilds the problem, diagram and answer together.
- Actual PDF preview and downloads, with vector diagrams, shared embedded fonts, whole-question pagination and the same questions in student/teacher editions.
- Mobile tools use a bottom sheet; math fields use the existing custom keypad. Normal text labels remain editable with ordinary text input.

## Coverage boundaries

This release supplies a working path through every family. It does not yet cover every compound subtype in the longer brief: changed/combined ratios, successive fractions of a remainder, target-ratio transfers, compound rate problems and some advanced percentage combinations remain extension work. PDF output is A4 portrait. QR sharing and importing prose as a solved word problem are not implemented. Free drawing does not infer equations from visual positions.

Context templates are intentionally bounded. Supplied parameters that violate whole-item, positivity, exact-money or plausibility constraints are rejected. Very large repeated-unit sets use a compressed representation. Save up to 30 examples and 100 free segments per model.

## Files and architecture

The feature is contained in `dist/bar-model/`: `domain.js`, `context.js`, `generator.js`, `examples.js`, `scene.js`, `renderer.js`, `coordinates.js`, `store.js`, `explore.js`, `ui.js`, `worksheet.js`, `worksheet-editor.js` and `style.css`.

Existing integration changes are limited to `angle-ui.js`, `app.js`, `index.html`, `interaction.js`, `worksheet-ui.js` and `worksheet-pdf.js`. The worksheet adapter keeps the angle worksheet defaults unchanged. The shared gesture owner now recognises SVG descendants as canvas-origin touches.

## Verification

Run `npm test`. Bar tests cover 1,000 seeds per family (12,000 questions), exact substitution, deterministic generation, the supplied numerical fixtures, invalid contexts, semantic equivalence, transfer conservation, average redistribution, fractional algebra cancellation, reversible timelines, coordinate transforms including SVG letterboxing, undo/redo, import validation and worksheet defaults. Existing angle, calculator, geometry and worksheet tests remain in the regression suite.

Browser checks include free drawing → edit → immediate second bar, manual Select override, undo, keypad entry, student answers, student model construction, reveal gating, algebra steps, PDF previews and both PDF variants. PDF generation is checked across all 12 families in both languages and all five tiers, with rendered-page inspection for dense diagrams. Phone-width behaviour is checked in a 390 × 844 embedded viewport.

Physical iPad/stylus and real multi-touch testing is still needed; browser checks cannot prove device OS-keyboard behaviour or stylus characteristics.

## Suggested user checks

1. Load an example in each family and step forwards/backwards through Solve.
2. Draw a free bar, change its value/colour, then draw another without reselecting the tool. Try Undo, save and reload.
3. In Student mode, build a relationship and check it, then enter the answer and open Solve.
4. Move an Explore slider and confirm its stated invariant remains fixed.
5. In Create, select any two tiers and preview Student (2 pages) and Teacher (4 pages) before downloading.
6. On an iPad, check keypad entry, two-finger canvas zoom, the tools sheet, and stylus dragging. The toolbar should not zoom with the model.
