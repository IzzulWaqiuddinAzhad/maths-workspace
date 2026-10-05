# Module teaching: translation questions 1–4

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

Only translation-coordinate Questions 1–4 are included. Physical stylus and multi-touch behaviour still needs actual-device testing. Other coordinate questions and area demonstrations are future work.
