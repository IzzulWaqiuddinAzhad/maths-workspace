# Visual Proof, Natural Calculator and geometry labels

## Changes

Confirming the side count immediately regenerates the polygon and clears cuts, progress, selection and revealed conclusions. Every triangular face receives a stable circled number as soon as it is formed. Numbers survive subsequent cuts and valid vertex movement and match their proof results. Selecting either representation highlights the other.

Desktop results use two columns, increasing to three when there is enough width. The polygon keeps the larger area. Compact results form progressively with the lever. At completion, only the observation prompt and Reveal relationship are available. Multiplication, optional expanded addition and the general formula are separate steps; reversing the lever hides the conclusions again. Small phones scroll inside the result grid.

The fraction bug came from empty cursor positions before and after a structured fraction being drawn like editable placeholders. These positions now remain navigation stops without visible boxes. A fraction has exactly two visible slots. The existing expression tree now supports mixed fractions, nested templates, operand-aware powers, directional navigation, Shift + left/right to exit a structure, and recoverable deletion. The keypad groups navigation, templates, functions and arithmetic while retaining the existing colours. Review also fixed sign toggling after subtraction and preserves shape annotation opacity.

The reference was Casio's [Natural Textbook input guidance](https://support.casio.com/global/en/calc/manual/fx-570CW_991CW_en/inputting_expressions_and_values/inputting_an_expression_using_natural_textbook_format.html) and [fx-570/991EX manual](https://www.casio.com/content/dam/casio/global/support/manuals/calculators/pdf/004-en/f/fx-570_991EX_EN.pdf). This is a calculator with familiar grouped controls, not a complete hardware emulator.

A shared screen-coordinate label layout checks edges, diagonals, vertices, arcs, other labels and viewport boundaries. It searches nearby candidates, flips side labels where useful and retains a previous readable candidate to reduce jitter. Workspace annotations render after the objects, so later shapes do not cover earlier labels. Exploration and proof labels use the same placement helper.

## Files

- `dist/calculator-tree.js`, `dist/calculator-ui.js`, `dist/calculator.css`: structured editing and key layout.
- `dist/polygon-proof.js`, `dist/proof-ui.js`, `dist/proof.css`: stable triangle identity, generation, results and progressive reveal.
- `dist/label-layout.js`, `dist/annotations.js`, `dist/angle-ui.js`: shared label placement and integration.
- `dist/app.js`, `dist/calculator-panel.js`, `dist/index.html`: rendering and refreshed asset references.
- `tests/refinement.test.mjs`: nine new behavioural regression tests.
- `docs/touch-and-visual-proof.md`: updated usage notes.

Saved notebook format and the existing ray-dragging geometry are preserved. Layout positions, triangle IDs and calculator editing state are session state rather than document changes.

## Verification

All 42 automated tests pass. Added coverage includes two-slot fractions, nested and mixed fractions, all mathematical key operations, operand-aware powers, signed operands, cursor/deletion recovery, invalid mixed whole parts, stable triangle identities, collision avoidance, hysteresis and viewport containment. Existing quizzes, ray geometry, keypad validation, gestures, undo/serialization, erasing and triangulation tests remain green.

Browser interaction checks:

- Keypad confirmation generates a decagon immediately; changing the sides after a completed proof resets the activity.
- Manually cutting a triangle displays its circled ID before the remaining polygon is triangulated.
- A decagon produces eight numbered results. At 1280×720 the dialog has equal client and scroll heights (689px), with all results visible. The 1024×768 layout uses two columns and fits the revealed formula.
- Result selection highlights the matching triangle. Phone-sized 390×844 results scroll independently and the last result remains selectable.
- Reversing the lever hides the relationship and formula; returning to completion requires explicit reveal.
- EN/light and BM/dark layouts checked.
- Natural calculator: `3/4 + 5 = 5.75`, `2 + 3/(4+5) = 2.33333333333`, and `sqrt(3+2/5) = 1.84390889146` entered through the visible buttons.
- Mixed `2 1/3`, shifted nth root of 27, physical arrow navigation and Shift+Right exit tested. An incomplete fraction reports a friendly error and can be deleted and replaced.
- Existing straight-line handle drag updates labels and the visible equation continuously, with the total remaining 180°.
- No browser runtime errors were recorded during these checks.

## Testing the release

1. Open Explore → Interior angles → Visual Proof. Enter 10 sides and confirm. Draw diagonals or use the teacher auto-complete control. Pull the lever and match each circled number to its result.
2. Reveal the relationship, then the formula. Reverse the lever, or confirm a different side count; the conclusions should disappear.
3. Open the workspace calculator, choose Natural, press AC then Fraction. Enter 3, Down, 4, OUT, +, 5, =. Try the other expressions above, nested templates, Shift functions and deletion.
4. Move labelled geometry near edges and other labels, then zoom. Labels should seek nearby clear positions while staying associated with their geometry.

## Limits

Physical iPad/iPhone/Android hardware was not available. Responsive previews do not certify native keyboard suppression, stylus or multi-finger behaviour; those still need real-device checks.

Label placement is a bounded local search. Very small or crowded geometry can have no fully collision-free position; zooming in or hiding optional labels improves those cases. Very small phone landscapes and high polygon counts may need internal scrolling. Proof state remains temporary when leaving the activity. Mixed fractions require an integer whole-number part. The scientific engine's existing function set is unchanged.
