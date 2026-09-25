# Interior-angle proof polish

Open **Explore → Interior angles → Triangles, quadrilaterals and more**.

## Changes

- Diagonals split the angle wedges at their endpoints as soon as the cut is accepted. This also works during incomplete triangulation: the triangle and the remaining polygon each show their own corner angles. Removing a cut merges the sectors again.
- Each wedge and its value share a stable face/vertex identity. The label anchor follows the wedge's translation, rotation and change in size; the text remains upright. Forward/reverse scrubbing and replay use the same calculation. Original angle labels are not left behind during extraction.
- Result groups use their available width and height, selecting a suitable number of columns and rows. Sparse proofs have much larger half-turn diagrams. Dense proofs retain readable labels and scroll within the result area. Resizing or revealing the formula recalculates the layout.
- One-decimal values reuse the existing angle-sum rounding helper so a triangle's displayed values total 180.0°. The same values appear on the source wedges and moving/result wedges.
- Existing diagonal validation, vertex editing, right-angle markers, triangle numbering, highlighting, reveal controls and EN/BM controls remain in place. Bar Model Studio and saved notebook data are unchanged.

## Implementation

- `dist/polygon-proof.js`: shared face sectors and attached-label motion.
- `dist/proof-layout.js`: responsive result grid and diagram dimensions.
- `dist/proof-ui.js`, `dist/proof.css`: existing renderer and result layout integration.
- `dist/angle-ui.js`, `dist/app.js`, `dist/index.html`: refreshed asset references.
- `tests/proof-animation.test.mjs`: split-angle conservation, continuous reversible label motion and sparse/dense layout checks.

## Verification

The automated suite contains 79 passing tests. New geometry checks cover every intermediate cut for 3–20 sided polygons, both windings and a concave polygon. They verify that each vertex's sectors retain its original angle, and that each accepted cut introduces exactly two additional sectors. Motion checks sample forward and reverse progress and resized destinations. Layout checks cover 1–18 contributions and narrow through desktop result regions.

Browser checks include manual quadrilateral and partial hexagon cuts, live vertex edits, pointer and keyboard lever control, reverse/replay, the angle-label toggle, revealed relationships, enlarged triangle results, and scrolling to the eighteenth contribution. Responsive checks use 390×844 and 1024×768 embedded viewports, with EN/dark and BM/light coverage. Existing regression tests cover the other explorations, geometry, calculators and worksheets.

Physical touch-device/stylus testing remains a user-device check. Dense constructions can still be crowded on the source polygon; the result panel scrolls rather than shrinking its text below 12px.

## Quick check

1. Choose four sides and start Visual Proof. Connect opposite vertices: each affected 90° corner should show two 45° sectors.
2. Move a vertex and confirm those values change with the geometry.
3. Pull the lever slowly in both directions. Values should travel with their wedges and return to their original positions.
4. Try three, six and twenty sides. Compare result sizes and scroll to the last group for the dense proof.
5. Reveal the relationship/formula, resize the window, then replay. The diagrams should rearrange and the reveal controls should reset normally.
