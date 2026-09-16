# Reference controls and Cartesian graphing

## What changed

- Scientific and Natural calculator modes now follow the reference's primary key positions: SHIFT/ALPHA, central replay arrows, MENU/ON, OPTN/CALC/integral/x, three six-key function rows, and the five-column numeric block. The display is green, numeric keys light and DEL/AC blue. Existing Basic mode remains available.
- Working controls include fractions, roots, powers, log with a base, degrees/minutes/seconds, variables A–F/x/y/M, STO/recall, memory addition/subtraction, engineering notation, S⇔D and CALC substitution. Definite integral and derivative use numerical approximations. Natural templates retain editable structure and cursor navigation.
- The Interior angles library entry is now “Triangles, quadrilaterals and more” / “Segi tiga, segi empat dan banyak lagi.” The actual activity retains its Visual Proof heading.
- The separate Smart Shape tool is removed from the toolbar. All three pens have Hold to snap, enabled initially. A roughly 650ms hold previews a recognized shape; release commits it. Resuming drawing cancels that preview. Small stationary pointer jitter does not keep restarting the timer. Recognition resamples the stroke uniformly, distinguishes corners from ellipses, handles rotated shapes, and chooses between polylines and smoothed curves. Recognized shapes temporarily select for editing, then an empty-canvas gesture resumes Pen.
- Undo/Redo remain in their separate header controls, including the compact mobile arrangement.
- Selecting or drawing a Cartesian plane opens a nearby Functions panel. Its non-editable display and on-screen keyboard support x, y, constants, roots, powers, trig/log functions, parentheses and =, <, >, ≤, ≥. The Functions property button reopens a closed panel. Functions are attached to that plane and participate in save/load, Undo/Redo, moving and resizing.
- Explicit y=f(x), x=f(y), implicit equations and inequalities are supported. Strict inequalities have dashed boundaries. Trigonometry in graphs uses radians, stated in the panel. Expressions are parsed through a restricted grammar rather than executable JavaScript.
- The numerical keypad uses C, 0, Delete beneath 1, 2, 3, followed by a full-width Enter button. Decimal/sign options occupy a balanced extra row when needed.

## Verification

47 automated tests pass, including new cases for rotated ellipses, triangles, quadrilaterals starting midway along an edge, polylines, smoothed curves, algebra parsing, relations, graph persistence/Undo and calculator calculus/templates.

Browser checks completed:
- Fraction 3/4 + 5 returns 5.75; S⇔D shows 23/4.
- Base-two logarithm of 8 returns 3. Integral of x² from 0 to 3 returns 9.
- Store 7 in C, then Alpha C + 2 returns 9. CALC with 2x and x=4, entered through the custom numeric keypad, returns 8.
- Plot y=x² and y≤2x+1 using only the in-app keyboard; inspect the parabola and correct inequality region.
- Undo removes the inequality, Redo restores it, and both functions survive reload.
- Library wording and the numerical keypad layout inspected; Enter regenerates a polygon immediately.
- Calculator and graph keypad layouts inspected at desktop and 390×844 phone dimensions; Undo/Redo remain outside the tools column.

## Limits and testing on a device

This matches the reference's primary scientific key layout and calculation workflow, not every fx-991EX mode or every secondary shortcut. Spreadsheet, matrix, statistics, equation-solver and other advanced mode screens are not implemented. The scope clarification received no answer during this update, so the scientific-layout-first option was used.

Graphs and calculus are numerical approximations, not a symbolic algebra system. Plotting is limited to 12 expressions per plane. Implicit boundaries use a finite sampling grid and may miss features narrower than the grid. Functions with discontinuities or singularities need mathematical judgement; calculus may reject undefined samples. Trigonometry on Cartesian graphs is in radians.

No physical stylus or touchscreen was available for a genuine draw-and-hold gesture. Test Pen → draw a circle/triangle/rectangle → hold briefly without lifting → release. Confirm the shape becomes editable and that drawing again resumes Pen. Repeat with Hold to snap disabled and with a ruler. Test native keyboard suppression and touch target comfort on the intended iPad/Android hardware. Recognition is approximate; ambiguous scribbles can remain ink.

## Files

New: dist/algebra.js, dist/function-panel.js, dist/functions.css, tests/workspace-inputs.test.mjs.

Updated: app, geometry, interaction, math-input, calculator engine/tree/UI/styles, core document validation, Cartesian renderer, exploration library, index/styles and dependent module cache references. Existing saved notebooks remain compatible; graph entries are optional additions to Cartesian objects.
