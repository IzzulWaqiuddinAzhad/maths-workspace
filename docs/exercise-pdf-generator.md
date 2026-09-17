# Exercise PDF generator

Open Explore → either Lines and Angles activity → Generate Exercise PDF.
Select tiers, generate an actual PDF preview, then download Student or Teacher.
The topic and EN/BM language come from the activity. All tiers are selected initially.

## Shared architecture

- `worksheet-model.js`: seeded existing quiz engine, config validation, solutions, stable question model, page blocks.
- `worksheet-diagram.js`: print diagrams using shared angle markers and collision-aware label placement. Searches rotations and nearby label positions; refuses unresolved collisions.
- `worksheet-pdf.js`: embedded Unicode fonts, A4 worksheet pages and additional answer pages. The Teacher document extends the same rendered Student pages.
- `worksheet-ui.js`: configuration, cached PDF buffers, actual PDF.js preview, pagination, exact-buffer downloads, disposal and asynchronous rendering guards.
- `worksheet.css`: responsive layout matching the existing dialog.

Defaults: 4 questions in tiers 1–2, 2 in tiers 3–5. Standard limits are 4 and 3 respectively; more-space limits are 2. Counts never create extra worksheet pages. Each tier adds exactly one worksheet page and one Teacher answer page. Validation offers an explicit fitting-count adjustment. The seed reproduces questions given the same topic, tiers and counts. Regenerate assigns a new seed; preview switching/downloads never generate questions.

Dependencies are bundled in `dist/vendor` with licenses; no external PDF service is used. Preview requires a modern browser supporting PDF.js. Diagrams are high-resolution raster images; text is embedded-font vector text.

## Validation

`npm test`: 61 checks, including deterministic generation, tier ordering, positive integer angle solutions, layout limits and collision-free dense layouts across 100 seeds for each topic (4,400 diagrams).

Browser checks: both topic entry points; empty/all/subset tier selection; configuration limits and explicit adjustment; numeric keypad; generation; Student/Teacher switch; page navigation; downloads; regeneration; 390px iframe responsive layout. Physical iPad/Android devices were not available.

Rendered and visually reviewed all 20 pages of maximum-density English straight-line and Malay around-point Teacher PDFs. Student worksheet text matches the corresponding Teacher pages; automated PDF inspection checked A4 dimensions and text margins. These local QA PDFs are not production assets.
